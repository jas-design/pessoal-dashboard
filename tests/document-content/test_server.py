import http.client
import json
import sys
import threading
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'workers/document-content'))
import server

class ServerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        server.SECRET=b'test-only-secret-with-at-least-24-bytes'
        cls.http=server.ThreadingHTTPServer(('127.0.0.1',0),server.Handler)
        cls.thread=threading.Thread(target=cls.http.serve_forever,daemon=True);cls.thread.start()
    @classmethod
    def tearDownClass(cls):
        cls.http.shutdown();cls.http.server_close();cls.thread.join()
    def request(self,path,body=b'a,b\n1,2',auth=True):
        conn=http.client.HTTPConnection('127.0.0.1',self.http.server_port,timeout=10)
        headers={'Authorization':'Bearer '+server.SECRET.decode()} if auth else {}
        conn.request('POST',path,body,headers);res=conn.getresponse();result=(res.status,json.loads(res.read()));conn.close();return result
    def test_unauthorized(self):self.assertEqual(self.request('/extract/csv',auth=False)[0],401)
    def test_real_subprocess(self):
        status,result=self.request('/extract/csv');self.assertEqual(status,200);self.assertEqual(result['metadata']['kind'],'csv')
    def test_invalid_content_safe_failure(self):
        status,result=self.request('/extract/xls',b'SENSITIVE TEST CONTENT');self.assertEqual(status,422);self.assertNotIn('SENSITIVE',json.dumps(result))
    def test_known_error_code(self):
        self.assertEqual(self.request('/extract/xls',b'SENSITIVE TEST CONTENT'),
                         (422,{'error':'invalid_xls'}))
    def test_content_limit_code(self):
        # A valid CSV whose evidence output exceeds the text limit.
        self.assertEqual(self.request('/extract/csv',b'a,b\n'+b'x,y\n'*20000),
                         (422,{'error':'content_limit'}))
    def test_parser_diagnostic_is_private(self):
        # Invalid ZIP diagnostic is not copied to HTTP output.
        self.assertEqual(self.request('/extract/xlsx',b'PRIVATE DOCUMENT'),
                         (422,{'error':'extraction_failed'}))
    def test_busy(self):
        server.BUSY.acquire()
        try:self.assertEqual(self.request('/extract/csv')[0],429)
        finally:server.BUSY.release()
    def test_unsupported(self):self.assertEqual(self.request('/extract/docx')[0],404)

if __name__=='__main__':unittest.main()
