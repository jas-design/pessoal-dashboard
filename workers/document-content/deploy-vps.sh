#!/usr/bin/env bash
# Runs on the VPS only, after both 13C queues are paused and drained.
set -Eeuo pipefail
umask 077
sha=${1:-}
incoming=${2:-}
[[ "$sha" =~ ^[0-9a-f]{40}$ ]] || { echo 'Invalid commit'; exit 2; }
[[ "$incoming" =~ ^/opt/fabio-document-content/incoming/actions-[0-9]+-[0-9]+$ ]] || exit 2
[[ $EUID == 0 ]] || { echo 'Root required'; exit 2; }
base=/opt/fabio-document-content
container=fabio-document-content-document-content-worker-1
service=document-content-worker
mkdir -p "$base/backups" "$base/releases"
exec 9>"$base/deploy.lock"
flock -n 9 || { echo 'Deployment already running'; exit 1; }
[[ $(docker inspect "$container" --format '{{.State.Health.Status}}') == healthy ]]
export DOCUMENT_WORKER_SECRET_PATH
DOCUMENT_WORKER_SECRET_PATH=$(docker inspect "$container" --format '{{range .Mounts}}{{if eq .Destination "/run/secrets/document_worker_auth"}}{{.Source}}{{end}}{{end}}')
[[ -f "$DOCUMENT_WORKER_SECRET_PATH" ]]
previous_image=$(docker inspect "$container" --format '{{.Image}}')
previous_files=$(docker inspect "$container" --format '{{index .Config.Labels "com.docker.compose.project.config_files"}}')
previous_dir=$(docker inspect "$container" --format '{{index .Config.Labels "com.docker.compose.project.working_dir"}}')
[[ "$previous_dir" == "$base/releases/"* && -d "$previous_dir" ]]
IFS=',' read -r -a files <<< "$previous_files"
old_compose=(docker compose -p fabio-document-content --project-directory "$previous_dir")
for file in "${files[@]}"; do
  [[ "$file" == "$base/releases/"* && -f "$file" ]]
  old_compose+=(-f "$file")
done
backup=$(mktemp -d "$base/backups/actions-${sha:0:12}-XXXXXXXX")
"${old_compose[@]}" config --format json > "$backup/compose.json"
# Freeze the actual prior image ID; rollback never pulls a mutable tag.
python3 - "$backup/compose.json" "$previous_image" <<'PY'
import json,sys
from pathlib import Path
p=Path(sys.argv[1]); config=json.loads(p.read_text())
assert set(config['services'])=={'document-content-worker'}
config['services']['document-content-worker']['image']=sys.argv[2]
p.write_text(json.dumps(config))
PY
release=$(mktemp -d "$base/releases/actions-${sha:0:12}-XXXXXXXX")
mkdir -p "$release/workers"
cp -a "$incoming/workers/document-content" "$release/workers/"
cd "$release/workers/document-content"
image="fabio-document-content-worker:actions-${sha}-$(basename "$release" | awk -F- '{print $NF}')"
printf 'services:\n  document-content-worker:\n    image: %s\n' "$image" > release.yml
compose=(docker compose -p fabio-document-content -f compose.yml -f release.yml)
"${compose[@]}" config --quiet
"${compose[@]}" build "$service" > "$backup/build.log" 2>&1 || { echo "Build failed; inspect $backup/build.log"; exit 1; }
"${compose[@]}" run --rm --no-deps --entrypoint python "$service" -c 'import os,pathlib; from extract import extract; assert os.geteuid()==1000; assert len(pathlib.Path(os.environ["DOCUMENT_WORKER_SECRET_FILE"]).read_bytes().strip())>=24; assert extract(b"name,value\nprobe,1\n","csv")["financial_facts_created"]==0' > "$backup/preflight.log" 2>&1 || { echo "Preflight failed; inspect $backup/preflight.log"; exit 1; }
changed=false
rollback() {
  code=$?
  trap - EXIT TERM INT HUP
  if [[ "$changed" == true && "$code" != 0 ]]; then
    echo 'Deployment failed; restoring previous configuration and image.'
    if docker compose -p fabio-document-content -f "$backup/compose.json" up -d --no-deps --no-build --pull never --wait --wait-timeout 120 "$service" > "$backup/rollback.log" 2>&1; then
      echo 'Rollback healthy. Keep queues paused.'
    else
      echo "ROLLBACK FAILED: inspect $backup/rollback.log; keep queues paused."
    fi
  fi
  exit "$code"
}
trap rollback EXIT
trap 'exit 143' TERM
trap 'exit 130' INT
trap 'exit 129' HUP
changed=true
"${compose[@]}" up -d --no-deps --no-build --pull never --wait --wait-timeout 120 "$service" > "$backup/up.log" 2>&1
[[ $(docker inspect "$container" --format '{{.State.Health.Status}}') == healthy ]]
[[ $(docker inspect "$container" --format '{{.Config.User}}') == '1000:1000' ]]
[[ $(docker inspect "$container" --format '{{json .HostConfig.PortBindings}}') =~ ^(null|\{\})$ ]]
[[ $(docker inspect "$container" --format '{{range .Mounts}}{{if eq .Destination "/run/secrets/document_worker_auth"}}{{.RW}}{{end}}{{end}}') == false ]]
docker exec -i "$container" python - > "$backup/smoke.log" 2>&1 <<'PY'
import json,os,pathlib,urllib.request,urllib.error
base='http://127.0.0.1:8788'
assert json.load(urllib.request.urlopen(base+'/health',timeout=5))=={'status':'ok'}
secret=pathlib.Path(os.environ['DOCUMENT_WORKER_SECRET_FILE']).read_text().strip()
headers={'Authorization':'Bearer '+secret,'Content-Type':'application/octet-stream'}
request=urllib.request.Request(base+'/extract/csv',data=b'name,value\nprobe,1\n',headers=headers)
result=json.load(urllib.request.urlopen(request,timeout=60))
assert result['text'] and result['financial_facts_created']==0
request=urllib.request.Request(base+'/extract/xls',data=b'invalid',headers=headers)
try:
    urllib.request.urlopen(request,timeout=60)
    raise AssertionError('Invalid XLS accepted')
except urllib.error.HTTPError as error:
    assert error.code==422 and json.load(error)=={'error':'invalid_xls'}
print('Health, CSV and safe error passed')
PY
printf '%s\n' "$sha" > "$release/COMMIT"
changed=false
printf 'Healthy release: %s\nBackup: %s\nQueues remain paused.\n' "$release" "$backup"
