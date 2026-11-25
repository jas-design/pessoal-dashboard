import io
import json
import sys
import unittest
import zipfile
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'workers/document-content'))
from extract import extract,MAX_FILE

class ExtractionTests(unittest.TestCase):
    def test_xlsx_all_sheets_and_cell_references(self):
        from openpyxl import Workbook
        book=Workbook(); book.active.title='Receitas'; book.active['B24']=123.45
        book.create_sheet('Outro ano')['C7']='2024'
        data=io.BytesIO(); book.save(data)
        result=extract(data.getvalue(),'xlsx')
        self.assertIn('B24',result['text']); self.assertIn('C7',result['text'])
        self.assertEqual(result['metadata']['sheets'],['Receitas','Outro ano'])
        self.assertEqual(result['financial_facts_created'],0)
    def test_xlsx_formula_preserved_not_executed(self):
        from openpyxl import Workbook
        book=Workbook(); book.active['A1']='=1+2'; data=io.BytesIO(); book.save(data)
        result=extract(data.getvalue(),'xlsx')
        self.assertIn('=1+2',result['text']); self.assertIn('expressions_only',result['metadata']['formula_policy'])
    def test_xls_multiple_sheets(self):
        import xlwt
        book=xlwt.Workbook(); book.add_sheet('2025').write(2,3,42); book.add_sheet('2026').write(0,0,'Olá')
        data=io.BytesIO(); book.save(data)
        result=extract(data.getvalue(),'xls')
        self.assertIn('D3',result['text']); self.assertIn('Olá',result['text'])
    def test_csv_delimiter_quotes_and_multiline(self):
        result=extract('nome;valor\n"A;B";"1.234,56"\n"duas\nlinhas";7\n'.encode(),'csv')
        rows=[json.loads(x) for x in result['text'].splitlines()]
        self.assertEqual(rows[2]['value'],'A;B'); self.assertEqual(rows[4]['value'],'duas\nlinhas')
        self.assertEqual(rows[4]['at']['record'],3)
    def test_csv_utf16(self):
        self.assertIn('Olá',extract('nome,valor\nOlá,2'.encode('utf-16'),'csv')['text'])
    def test_csv_cp1252(self):
        self.assertEqual(extract('ação;2'.encode('cp1252'),'csv')['metadata']['encoding'],'cp1252')
    def test_csv_formula_is_literal(self):
        self.assertIn('=SUM(A1:A2)',extract(b'=SUM(A1:A2)','csv')['text'])
    def test_invalid_signature(self):
        for kind in ('xlsx','xls','ocr'):
            with self.assertRaises(Exception): extract(b'not a workbook',kind)
    def test_size_limit(self):
        for data in (b'',b'a'*(MAX_FILE+1)):
            with self.assertRaisesRegex(ValueError,'file_size_limit'): extract(data,'csv')
    def test_no_silent_truncation(self):
        with patch('extract.MAX_TEXT',20):
            with self.assertRaisesRegex(ValueError,'content_limit'): extract(b'long content,more content','csv')
    def test_macro_rejected(self):
        data=io.BytesIO()
        with zipfile.ZipFile(data,'w') as z:
            z.writestr('xl/workbook.xml','x'); z.writestr('xl/vbaProject.bin','x')
        with self.assertRaisesRegex(ValueError,'macros_not_supported'): extract(data.getvalue(),'xlsx')
    def test_ocr_actual_scanned_pdf(self):
        from PIL import Image,ImageDraw,ImageFont
        import subprocess
        image=Image.new('RGB',(1400,500),'white'); draw=ImageDraw.Draw(image)
        font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',48)
        draw.text((60,120),'INVOICE TEST 2026 TOTAL 1234',font=font,fill='black')
        data=io.BytesIO(); image.save(data,format='PDF',resolution=150)
        original=subprocess.run
        def run(args,**kwargs):
            # Local runtime has English only; production image installs Portuguese too.
            return original(['eng' if x=='por+eng' else x for x in args],**kwargs)
        with patch('extract.subprocess.run',side_effect=run): result=extract(data.getvalue(),'ocr')
        self.assertIn('INVOICE',result['text']); self.assertEqual(result['metadata']['pages'],1)
        self.assertTrue(result['metadata']['review_required'])
        self.assertGreater(result['metadata']['mean_word_confidence'],50)



class SafeErrorTests(unittest.TestCase):
    def test_only_allowlisted_errors_leave_parser(self):
        from extract import safe_error_code
        import subprocess
        self.assertEqual(safe_error_code(ValueError('content_limit')), 'content_limit')
        self.assertEqual(safe_error_code(ValueError('PRIVATE DOCUMENT')), 'extraction_failed')
        self.assertEqual(safe_error_code(ValueError({'private': 'data'})), 'extraction_failed')
        self.assertEqual(safe_error_code(RuntimeError('content_limit')), 'extraction_failed')
        self.assertEqual(safe_error_code(subprocess.TimeoutExpired('PRIVATE', 30)), 'extraction_timeout')

if __name__=='__main__': unittest.main()
