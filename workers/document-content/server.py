"""Private binary HTTP endpoint; each extraction runs in a disposable process."""
import hmac
import json
import os
import signal
import subprocess
import sys
import tempfile
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from extract import MAX_FILE, SAFE_ERRORS
BUSY = threading.Lock()
SECRET = b''

class Handler(BaseHTTPRequestHandler):
    def setup(self):
        super().setup()
        self.connection.settimeout(15)

    def log_message(self, *_args):
        pass

    def reply(self, status, body):
        payload = json.dumps(body).encode()
        self.send_response(status)
        self.send_header('Content-Type','application/json')
        self.send_header('Content-Length',str(len(payload)))
        self.send_header('Connection','close')
        self.end_headers()
        self.wfile.write(payload)

    def do_GET(self):
        self.reply(200 if self.path=='/health' else 404, {'status':'ok'} if self.path=='/health' else {'error':'not_found'})

    def do_POST(self):
        if not SECRET or not hmac.compare_digest(self.headers.get('Authorization','').encode(),b'Bearer '+SECRET):
            return self.reply(401,{'error':'unauthorized'})
        kind = self.path.removeprefix('/extract/')
        if self.path != '/extract/'+kind or kind not in ('xlsx','xls','csv','ocr'):
            return self.reply(404,{'error':'not_found'})
        try:
            length = int(self.headers.get('Content-Length','0'))
        except ValueError:
            length = 0
        if not 0 < length <= MAX_FILE or self.headers.get('Transfer-Encoding'):
            return self.reply(413,{'error':'file_size_limit'})
        if not BUSY.acquire(blocking=False):
            return self.reply(429,{'error':'busy'})
        try:
            data = self.rfile.read(length)
            if len(data)!=length:
                return self.reply(400,{'error':'incomplete_body'})
            with tempfile.TemporaryDirectory() as tmp:
                source, output = Path(tmp)/'input',Path(tmp)/'output.json'
                source.write_bytes(data)
                process = subprocess.Popen([sys.executable,str(Path(__file__).with_name('extract.py')),kind,str(source),str(output)],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,start_new_session=True)
                try:
                    process.wait(timeout=180 if kind=='ocr' else 45)
                except subprocess.TimeoutExpired:
                    os.killpg(process.pid,signal.SIGKILL)
                    process.wait()
                    return self.reply(422,{'error':'extraction_timeout'})
                if process.returncode:
                    code = 'extraction_failed'
                    if output.exists() and output.stat().st_size <= 256:
                        failure = json.loads(output.read_text())
                        candidate = failure.get('error') if isinstance(failure,dict) else None
                        if isinstance(candidate,str) and candidate in SAFE_ERRORS:
                            code = candidate
                    return self.reply(422,{'error':code})
                if not output.exists() or output.stat().st_size>6_000_000:
                    return self.reply(422,{'error':'extraction_failed'})
                self.reply(200,json.loads(output.read_text()))
        except (OSError,ValueError):
            self.reply(422,{'error':'extraction_failed'})
        finally:
            BUSY.release()

if __name__=='__main__':
    SECRET=Path(os.environ['DOCUMENT_WORKER_SECRET_FILE']).read_bytes().strip()
    if len(SECRET)<24:
        raise SystemExit('Worker secret must contain at least 24 bytes')
    ThreadingHTTPServer(('0.0.0.0',8788),Handler).serve_forever()
