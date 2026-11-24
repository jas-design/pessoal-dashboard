"""Bounded, offline document readers. Output is evidence, never financial facts."""
import csv
import hashlib
import io
import json
import subprocess
import tempfile
import zipfile
from pathlib import Path

MAX_FILE = 8 * 1024 * 1024
MAX_TEXT = 900_000
MAX_CELLS = 100_000
MAX_ROWS = 50_000
MAX_COLUMNS = 1024
MAX_SHEETS = 100


SAFE_ERRORS = frozenset({
    'file_size_limit', 'content_limit', 'expanded_size_limit', 'invalid_xlsx',
    'macros_not_supported', 'sheet_limit', 'sheet_dimensions_limit',
    'invalid_xls', 'invalid_csv', 'invalid_pdf', 'page_limit',
    'unsupported_kind', 'no_content', 'extraction_timeout', 'extraction_failed',
})


def safe_error_code(error):
    if isinstance(error, subprocess.TimeoutExpired):
        return 'extraction_timeout'
    # Only exact, known messages can leave the parser; never stringify arbitrary errors.
    if type(error) is ValueError and len(error.args) == 1:
        value = error.args[0]
        if isinstance(value, str) and value in SAFE_ERRORS:
            return value
    return 'extraction_failed'


def extract(data, kind):
    if not 0 < len(data) <= MAX_FILE:
        raise ValueError('file_size_limit')
    lines, count, length = [], 0, 0
    def add(location, value):
        nonlocal count, length
        if value is None or value == '':
            return
        count += 1
        line = json.dumps({'at': location, 'value': value}, ensure_ascii=False, default=str)
        length += len(line) + 1
        if count > MAX_CELLS or length > MAX_TEXT:
            raise ValueError('content_limit')
        lines.append(line)
    metadata = {'kind': kind, 'version': '13c-v1', 'sha256': hashlib.sha256(data).hexdigest()}
    if kind == 'xlsx':
        import openpyxl
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            entries = archive.infolist()
            if len(entries) > 2000 or sum(e.file_size for e in entries) > 64 * 1024 * 1024:
                raise ValueError('expanded_size_limit')
            if 'xl/workbook.xml' not in archive.namelist():
                raise ValueError('invalid_xlsx')
            if any('vbaproject' in e.filename.lower() for e in entries):
                raise ValueError('macros_not_supported')
        # Read expressions as evidence, without evaluating or silently dropping uncached formulas.
        book = openpyxl.load_workbook(io.BytesIO(data), read_only=True, data_only=False, keep_links=False)
        try:
            if len(book.worksheets) > MAX_SHEETS:
                raise ValueError('sheet_limit')
            metadata['sheets'] = book.sheetnames
            metadata['formula_policy'] = 'expressions_only_not_calculated'
            for sheet in book:
                if (sheet.max_row or 0) > MAX_ROWS or (sheet.max_column or 0) > MAX_COLUMNS:
                    raise ValueError('sheet_dimensions_limit')
                for row in sheet.iter_rows():
                    for cell in row:
                        if cell.value is not None:
                            add({'sheet': sheet.title, 'cell': cell.coordinate, 'type': cell.data_type}, cell.value)
        finally:
            book.close()
    elif kind == 'xls':
        import xlrd
        from openpyxl.utils import get_column_letter
        if not data.startswith(bytes.fromhex('d0cf11e0a1b11ae1')):
            raise ValueError('invalid_xls')
        book = xlrd.open_workbook(file_contents=data, on_demand=True, logfile=io.StringIO())
        try:
            if book.nsheets > MAX_SHEETS:
                raise ValueError('sheet_limit')
            metadata['sheets'] = book.sheet_names()
            metadata['formula_policy'] = 'cached_values_not_recalculated'
            for sheet in book.sheets():
                if sheet.nrows > MAX_ROWS or sheet.ncols > MAX_COLUMNS:
                    raise ValueError('sheet_dimensions_limit')
                for r in range(sheet.nrows):
                    for c in range(sheet.ncols):
                        cell = sheet.cell(r,c)
                        value = cell.value
                        if cell.ctype == xlrd.XL_CELL_DATE:
                            value = xlrd.xldate_as_datetime(value, book.datemode).isoformat()
                        add({'sheet':sheet.name,'cell':f'{get_column_letter(c+1)}{r+1}','type':cell.ctype},value)
                book.unload_sheet(sheet.name)
        finally:
            book.release_resources()
    elif kind == 'csv':
        encoding = 'utf-8-sig'
        if data.startswith((b'\xff\xfe',b'\xfe\xff')):
            encoding = 'utf-16'
        try:
            text = data.decode(encoding)
        except UnicodeDecodeError:
            encoding = 'cp1252'
            text = data.decode(encoding)
        if '\x00' in text:
            raise ValueError('invalid_csv')
        try:
            dialect = csv.Sniffer().sniff(text[:8192], delimiters=',;\t|')
        except csv.Error:
            dialect = csv.excel
        metadata.update(encoding=encoding, delimiter=dialect.delimiter)
        for r,row in enumerate(csv.reader(io.StringIO(text,newline=''),dialect,strict=True),1):
            if r > MAX_ROWS or len(row) > MAX_COLUMNS:
                raise ValueError('sheet_dimensions_limit')
            for c,value in enumerate(row,1):
                add({'record':r,'column':c},value)
    elif kind == 'ocr':
        if not data.startswith(b'%PDF-'):
            raise ValueError('invalid_pdf')
        with tempfile.TemporaryDirectory() as tmp:
            source = Path(tmp)/'source.pdf'
            source.write_bytes(data)
            info = subprocess.run(['pdfinfo',str(source)],capture_output=True,timeout=10,check=True).stdout.decode()
            pages = next(int(line.split(':')[1]) for line in info.splitlines() if line.startswith('Pages:'))
            if not 1 <= pages <= 30:
                raise ValueError('page_limit')
            metadata.update(pages=pages, language='por+eng', review_required=True)
            confidences = []
            for page in range(1,pages+1):
                prefix = str(Path(tmp)/'page')
                subprocess.run(['pdftoppm','-f',str(page),'-l',str(page),'-scale-to','2400','-singlefile','-png',str(source),prefix],capture_output=True,timeout=20,check=True)
                result = subprocess.run(['tesseract',prefix+'.png','stdout','-l','por+eng','tsv'],capture_output=True,timeout=30,check=True)
                words = list(csv.DictReader(io.StringIO(result.stdout.decode()),delimiter='\t',quoting=csv.QUOTE_NONE))
                for word in words:
                    if word.get('text','').strip():
                        confidence = float(word['conf'])
                        confidences.append(confidence)
                        add({'page':page,'block':word['block_num'],'line':word['line_num'],'word':word['word_num'],'confidence':confidence},word['text'])
                Path(prefix+'.png').unlink()
            metadata['mean_word_confidence'] = round(sum(confidences)/len(confidences),2) if confidences else None
    else:
        raise ValueError('unsupported_kind')
    text = '\n'.join(lines)
    if not text:
        raise ValueError('no_content')
    metadata['items'] = count
    return {'text': text, 'metadata': metadata, 'financial_facts_created':0}


if __name__ == '__main__':
    import sys
    try:
        result = extract(Path(sys.argv[2]).read_bytes(),sys.argv[1])
        Path(sys.argv[3]).write_text(json.dumps(result,ensure_ascii=False),encoding='utf-8')
    except Exception as error:
        # Only a fixed code is written; stderr and document text remain private.
        Path(sys.argv[3]).write_text(json.dumps({'error': safe_error_code(error)}),encoding='utf-8')
        sys.exit(2)
