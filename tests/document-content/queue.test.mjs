// Run with PGLITE_MODULE pointing to a locally installed @electric-sql/pglite module.
import assert from 'node:assert/strict';
import fs from 'node:fs';
const { PGlite } = await import(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const db=new PGlite();
await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
create table public.documents(id uuid primary key, owner_id uuid,provider text,is_deleted boolean,file_name text,file_size bigint,
 external_drive_id text,external_file_id text,source_etag text,source_path text,source_modified_at timestamptz,extracted_text text,metadata jsonb,
 processing_status text,indexed_for_ai boolean);
grant select,update on documents to service_role;`);
await db.exec(fs.readFileSync(new URL('../../supabase/migrations/20261117135912_document_content_queue_v1.sql',import.meta.url),'utf8'));
await db.exec(fs.readFileSync(new URL('../../supabase/migrations/20261123132457_document_content_safe_errors.sql',import.meta.url),'utf8'));
const owner='11111111-1111-4111-8111-111111111111';
const doc='22222222-2222-4222-8222-222222222222';
await db.query(`insert into documents values ($1,$2,'onedrive',false,'report.xlsx',20,'drive','item','v1','/drive/root:/Deskboard KPIs/2025',now(),null,'{}','pending',false)`,[doc,owner]);
const claim=async(mode='spreadsheet')=>(await db.query('select document_content_claim($1,$2) r',[owner,mode])).rows[0].r;
const complete=async(c,status='extracted',etag=c.source_etag)=>(await db.query(`select document_content_complete($1,$2,$3,$4,$5,$6,'test') r`,[c.id,c.claim_id,etag,status,status==='extracted'?'cell evidence':null,status==='extracted'?{kind:c.kind,version:'13c-v1',sha256:'a'.repeat(64)}:{}])).rows[0].r;
await db.exec('set role service_role');
const c=await claim();assert.equal(c.kind,'xlsx');
assert.equal((await claim()).reason,'busy');
await assert.rejects(()=>complete({...c,claim_id:'33333333-3333-4333-8333-333333333333'}));
assert.equal((await complete(c)).status,'extracted');
assert.equal((await complete(c)).already_completed,true);
assert.equal((await claim()).reason,'no_eligible_document');
await db.exec('reset role');
await db.query("update documents set source_etag='v2' where id=$1",[doc]);
const c2=await claim();assert.notEqual(c2.claim_id,c.claim_id);
await db.query("update documents set source_etag='v3' where id=$1",[doc]);
assert.equal((await complete(c2)).status,'stale');
const c3=await claim();await complete(c3,'failed');
assert.equal((await claim()).reason,'no_eligible_document');
for(let i=0;i<2;i++){
 await db.exec("update document_content_jobs set updated_at=now()-interval '20 minutes'");
 const next=await claim();assert.equal(next.has_document,true);await complete(next,'failed');
}
await db.exec("update document_content_jobs set updated_at=now()-interval '20 minutes'");
assert.equal((await claim()).reason,'no_eligible_document');
await db.query(`insert into documents values ('44444444-4444-4444-8444-444444444444',$1,'onedrive',false,'scan.pdf',20,'drive','scan','v1','/drive/root:/Deskboard KPIs',now(),null,'{"text_ingestion":{"status":"needs_ocr","source_etag":"v1"}}','pending',false)`,[owner]);
assert.equal((await claim()).has_document,false);
const ocr=await claim('ocr');assert.equal(ocr.kind,'ocr');await complete(ocr);
const metadata=(await db.query('select metadata from documents where id=$1',[ocr.id])).rows[0].metadata;
assert.equal(metadata.text_ingestion.review_required,true);
assert.equal(metadata.text_ingestion.financial_facts_created,0);
// Errors are allowlisted independently of the worker and workflow.
for (const [candidate,expected] of [['content_limit','content_limit'],['PRIVATE DOCUMENT','extraction_failed'],[null,'extraction_failed'],[{},'extraction_failed']]) {
 await db.query('update documents set source_etag=gen_random_uuid()::text where id=$1',[doc]);
 const c=await claim();
 await db.query("select document_content_complete($1,$2,$3,'failed',null,$4,'safe-error-test')",[c.id,c.claim_id,c.source_etag,{error_code:candidate,untrusted:'PRIVATE DOCUMENT'}]);
 const row=(await db.query('select error_code from document_content_jobs where document_id=$1',[doc])).rows[0];
 assert.equal(row.error_code,expected);
}
await db.exec('set role anon');
await assert.rejects(()=>claim());
await assert.rejects(()=>db.query('select * from document_content_jobs'));
await db.exec('reset role');
assert.equal((await db.query("select relrowsecurity from pg_class where relname='document_content_jobs'")).rows[0].relrowsecurity,true);
console.log('Queue integration passed: claims, overlap, tokens, idempotency, versions, retries, OCR, grants and RLS.');
await db.close();
