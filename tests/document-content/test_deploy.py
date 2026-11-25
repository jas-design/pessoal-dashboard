"""Exercise deployment/rollback control flow with Docker replaced by a fake executable."""
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
FAKE = r'''#!/usr/bin/env python3
import json,os,sys
from pathlib import Path
a=sys.argv[1:]; base=Path(os.environ['TEST_BASE']); mode=os.environ['TEST_MODE']
with (base/'calls').open('a') as f: f.write(json.dumps(a)+'\n')
if a[0]=='inspect':
 fmt=a[-1]
 if 'Health.Status' in fmt: print('healthy')
 elif '.Source' in fmt: print(base/'secret')
 elif 'config_files' in fmt: print(base/'releases/old/compose.yml')
 elif 'working_dir' in fmt: print(base/'releases/old')
 elif '.Image' in fmt: print('sha256:previous')
 elif '.Config.User' in fmt: print('1000:1000')
 elif 'PortBindings' in fmt: print('{}')
 elif '.RW' in fmt: print('false')
 sys.exit(0)
if a[0]=='exec': sys.exit(1 if mode=='smoke_failure' else 0)
if 'config' in a and '--format' in a:
 print(json.dumps({'services':{'document-content-worker':{'image':'old'}}})); sys.exit(0)
if 'build' in a: sys.exit(1 if mode=='build_failure' else 0)
if 'run' in a: sys.exit(1 if mode=='preflight_failure' else 0)
if 'up' in a:
 rollback=any(x.endswith('/compose.json') for x in a)
 if rollback: sys.exit(1 if mode=='rollback_failure' else 0)
 sys.exit(1 if mode in ('up_failure','rollback_failure') else 0)
'''

class DeploymentTests(unittest.TestCase):
    def run_case(self, mode):
        with tempfile.TemporaryDirectory() as tmp:
            base=Path(tmp); incoming=base/'incoming/actions-1-1'
            source=incoming/'workers/document-content'; source.mkdir(parents=True)
            (source/'compose.yml').write_text('services: {}')
            old=base/'releases/old'; old.mkdir(parents=True)
            (old/'compose.yml').write_text('services: {}')
            (base/'secret').write_text('synthetic-only')
            binary=base/'bin'; binary.mkdir()
            docker=binary/'docker'; docker.write_text(FAKE); docker.chmod(0o700)
            script=base/'deploy.sh'
            script.write_text((ROOT/'workers/document-content/deploy-vps.sh').read_text().replace('/opt/fabio-document-content',str(base)).replace('[[ $EUID == 0 ]]','true'))
            env={**os.environ,'PATH':str(binary)+os.pathsep+os.environ['PATH'],'TEST_BASE':str(base),'TEST_MODE':mode}
            run=subprocess.run(['bash',str(script),'a'*40,str(incoming)],env=env,capture_output=True,text=True)
            calls=[json.loads(line) for line in (base/'calls').read_text().splitlines()]
            ups=[a for a in calls if 'up' in a]
            if mode=='success':
                self.assertEqual(run.returncode,0,run.stderr); self.assertEqual(len(ups),1)
            else:
                self.assertNotEqual(run.returncode,0)
                self.assertEqual(len(ups),0 if mode in ('build_failure','preflight_failure') else 2)
            for a in ups:
                self.assertIn('--no-build',a); self.assertIn('--no-deps',a); self.assertIn('never',a)
            if len(ups)==2:
                backup=next(Path(x) for x in ups[-1] if x.endswith('/compose.json'))
                self.assertEqual(json.loads(backup.read_text())['services']['document-content-worker']['image'],'sha256:previous')
            if mode=='rollback_failure': self.assertIn('ROLLBACK FAILED',run.stdout)
    def test_deployment_scenarios(self):
        for mode in ('success','build_failure','preflight_failure','up_failure','smoke_failure','rollback_failure'):
            with self.subTest(mode=mode): self.run_case(mode)

if __name__=='__main__': unittest.main()
