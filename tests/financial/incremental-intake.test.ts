import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const workflow = JSON.parse(readFileSync(new URL('../../n8n/workflows/14-financial-incremental-intake.json', import.meta.url), 'utf8'));
const node = (name: string) => workflow.nodes.find((n: any) => n.name === name);
const run = (name: string, input: any, previous: Record<string, any>) => new Function('$input', '$', node(name).parameters.jsCode)(
  { first: () => ({json: input}), all: () => [{json: input}] },
  (key: string) => ({first: () => ({json:previous[key]}),item:{json:previous[key]}}),
);
test('incremental workflow references resolve and code compiles', () => {
  const names = new Set(workflow.nodes.map((n: any) => n.name));
  for (const [name, routes] of Object.entries(workflow.connections) as any) {
    assert.ok(names.has(name));
    for (const outputs of routes.main) for (const edge of outputs) assert.ok(names.has(edge.node));
  }
  for (const n of workflow.nodes) if (n.type === 'n8n-nodes-base.code') {
    new Function('$input','$',n.parameters.jsCode);
    for (const match of n.parameters.jsCode.matchAll(/\$\('([^']+)'\)/g)) assert.ok(names.has(match[1]));
  }
});
test('unconfigured workflow blocks before download or write', () => {
  assert.equal(workflow.active,false);
  assert.equal(run('Define approved batch inventory',{},{} )[0].json.batchExecutionApproved,false);
  assert.equal(workflow.settings.saveDataSuccessExecution,'none');
  assert.equal(workflow.settings.saveDataErrorExecution,'none');
  assert.ok(!JSON.stringify(workflow).includes('finance_publish_monthly_metrics'));
});
const documentId='00000000-0000-4000-8000-000000000001';
const companyId='00000000-0000-4000-8000-000000000002';
const target={documentId,companyId,companyName:'Synthetic',sourceRoot:'/drive/root:/Fixtures',periodMonth:'2027-02',fileName:'02.2027 Relatório Gerencial Kawana.xlsx',mappingId:'kawana-management-report',mappingVersion:'2',parserVersion:'12A.3',maxFileSize:8388608,sequence:1};
const document={id:documentId,owner_id:'00000000-0000-4000-8000-000000000003',company_id:companyId,provider:'onedrive',is_deleted:false,processing_status:'pending',file_name:target.fileName,file_size:100,source_etag:'synthetic-etag',external_drive_id:'synthetic-drive',external_file_id:'synthetic-file',source_path:'/drive/root:/Fixtures/2027',period_year:2027,period_month:2};
const response=(body:any)=>({statusCode:200,body});
test('catalog generates period from authoritative metadata across years',()=>{
 const result=run('Build catalog targets',response([document]),{'Define approved batch inventory':{...target,targets:[{documentId,sequence:1}]}});
 assert.equal(result[0].json.targets[0].periodMonth,'2027-02');
 assert.equal(result[0].json.targets[0].parserVersion,'12A.3');
});
test('same version skips download; changed version is eligible; partial version is isolated',()=>{
 const previous={'Build catalog targets':{targets:[target]},'Fetch batch catalog metadata':response([document])};
 const facts=['revenue','expense','net_result','cash_available'].map(metric=>({document_id:documentId,source_etag:'synthetic-etag',metric,contract_version:2,review_status:'pending_review'}));
 assert.equal(run('Prepare independent batch items',response(facts),previous)[0].json.outcome,'already_processed');
 assert.equal(run('Prepare independent batch items',response(facts.slice(1)),previous)[0].json.outcome,'isolated');
 assert.equal(run('Prepare independent batch items',response(facts.map(f=>({...f,source_etag:'old'}))),previous)[0].json.outcome,'eligible');
});
test('foreign company and path are isolated',()=>{
 for(const invalid of [{...document,company_id:'other'},{...document,source_path:'/outside'}]) {
 const previous={'Build catalog targets':{targets:[target]},'Fetch batch catalog metadata':response([invalid])};
 assert.equal(run('Prepare independent batch items',response([]),previous)[0].json.outcome,'isolated');
 }
});
