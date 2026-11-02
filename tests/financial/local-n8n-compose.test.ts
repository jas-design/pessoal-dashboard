import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const composePath = new URL(
  "../../n8n/local/docker-compose.09e1.yml",
  import.meta.url,
);
const gatewayPath = new URL(
  "../../n8n/local/supabase-rpc-gateway.conf",
  import.meta.url,
);

async function composeSource() {
  return readFile(composePath, "utf8");
}

test("Compose 09E.1 usa nomes e bindings locais sem reutilizar o n8n desconhecido", async () => {
  const source = await composeSource();

  assert.match(source, /^name: fabio-09e1-local$/m);
  assert.match(source, /container_name: fabio-09e1-n8n/);
  assert.match(source, /container_name: fabio-09e1-financial-xlsx-worker/);
  assert.match(source, /"127\.0\.0\.1:5679:5678"/);
  assert.doesNotMatch(source, /"0\.0\.0\.0:567[89]:5678"/);
  assert.match(source, /pull_policy: never/);
  assert.doesNotMatch(source, /n8nio\/n8n:latest/);
});

test("worker fica privado em rede interna e a fixture e somente leitura", async () => {
  const source = await composeSource();

  assert.match(source, /financial_pipeline:[\s\S]*internal: true/);
  assert.match(source, /target: \/fixtures\/09b-synthetic-financial-report\.xlsx\s+read_only: true/);
  assert.match(source, /financial-xlsx-worker:[\s\S]*expose:\s+- "8787"/);
  assert.match(source, /image: fabio-financial-xlsx-worker:09e1-local/);
  assert.doesNotMatch(
    source.match(/financial-xlsx-worker:[\s\S]*?(?=\nnetworks:)/)?.[0] ?? "",
    /\n\s+ports:/,
  );
  assert.match(source, /FINANCIAL_XLSX_WORKER_SECRET_FILE: \/run\/secrets\/financial_xlsx_worker_auth/);
});

test("n8n e worker ficam na rede interna e somente o gateway alcanca a rede Supabase", async () => {
  const source = await composeSource();

  const n8nBlock = source.match(/\n  n8n:[\s\S]*?(?=\n  supabase-rpc-gateway:)/)?.[0] ?? "";
  const workerBlock = source.match(/\n  financial-xlsx-worker:[\s\S]*?(?=\nnetworks:)/)?.[0] ?? "";
  const gatewayBlock = source.match(/\n  supabase-rpc-gateway:[\s\S]*?(?=\n  financial-xlsx-worker:)/)?.[0] ?? "";

  assert.doesNotMatch(n8nBlock, /supabase_local/);
  assert.match(n8nBlock, /financial_pipeline/);
  assert.match(n8nBlock, /n8n_host_access/);
  assert.doesNotMatch(workerBlock, /supabase_local/);
  assert.doesNotMatch(workerBlock, /n8n_host_access/);
  assert.match(gatewayBlock, /financial_pipeline/);
  assert.match(gatewayBlock, /supabase_local/);
  assert.doesNotMatch(gatewayBlock, /n8n_host_access/);
  assert.match(source, /name: supabase_network_kawana-07c11-staging/);
  assert.match(source, /N8N_DIAGNOSTICS_ENABLED: "false"/);
  assert.match(source, /N8N_VERSION_NOTIFICATIONS_ENABLED: "false"/);
  assert.match(source, /N8N_TEMPLATES_ENABLED: "false"/);
  assert.match(source, /N8N_BLOCK_ENV_ACCESS_IN_NODE: "true"/);
  assert.doesNotMatch(source, /https?:\/\/(?!127\.0\.0\.1)/i);
  assert.doesNotMatch(source, /service[_-]?role/i);
  assert.doesNotMatch(source, /eyJ[A-Za-z0-9_-]{10,}/);
  assert.doesNotMatch(source, /Bearer\s+[A-Za-z0-9._-]+/i);
});

test("acesso local do n8n usa bridge exclusiva sem abrir Worker ou gateway", async () => {
  const source = await composeSource();

  assert.match(source, /"127\.0\.0\.1:5679:5678"/);
  assert.match(
    source,
    /n8n_host_access:\s+name: fabio-09e1-n8n-host-access\s+driver: bridge/,
  );
  assert.doesNotMatch(
    source,
    /n8n_host_access:[\s\S]*?internal: true/,
  );
});

test("gateway local permite somente claim e completion v2 sem registrar headers", async () => {
  const source = await readFile(gatewayPath, "utf8");

  assert.match(source, /access_log off;/);
  assert.match(source, /location = \/rest\/v1\/rpc\/finance_claim_next_document/);
  assert.match(source, /location = \/rest\/v1\/rpc\/finance_complete_document_v2/);
  assert.equal((source.match(/limit_except POST/g) ?? []).length, 2);
  assert.equal((source.match(/proxy_pass http:\/\/supabase_rest_kawana-07c11-staging:3000;/g) ?? []).length, 2);
  assert.match(source, /location \/\s*{\s*return 404;/);
  assert.doesNotMatch(source, /proxy_set_header\s+(Authorization|apikey)/i);
  assert.doesNotMatch(source, /https:\/\//i);
});

test("estado do n8n e persistente sem criar diretorio versionado", async () => {
  const source = await composeSource();

  assert.match(source, /source: n8n_data\s+target: \/home\/node\/\.n8n/);
  assert.match(source, /name: fabio-09e1-n8n-data/);
  assert.match(
    source,
    /\/home\/node\/\.cache:size=64m,mode=0700,uid=1000,gid=1000,noexec,nosuid,nodev/,
  );
  assert.match(source, /EXECUTIONS_DATA_SAVE_ON_SUCCESS: none/);
  assert.match(source, /EXECUTIONS_DATA_SAVE_ON_ERROR: none/);
});

test("root filesystems somente leitura usam apenas temporarios explicitamente gravaveis", async () => {
  const compose = await composeSource();
  const gateway = await readFile(gatewayPath, "utf8");

  assert.equal((compose.match(/^    read_only: true$/gm) ?? []).length, 3);
  assert.match(gateway, /^pid \/tmp\/nginx\.pid;/m);
  assert.match(gateway, /client_body_temp_path \/tmp\/client_body;/);
  assert.match(gateway, /proxy_temp_path \/tmp\/proxy;/);
  assert.match(gateway, /fastcgi_temp_path \/tmp\/fastcgi_temp;/);
  assert.match(gateway, /uwsgi_temp_path \/tmp\/uwsgi_temp;/);
  assert.match(gateway, /scgi_temp_path \/tmp\/scgi_temp;/);
  assert.doesNotMatch(gateway, /\/var\/cache\/nginx/);
});
