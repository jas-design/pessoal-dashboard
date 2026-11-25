import assert from 'node:assert/strict';
import fs from 'node:fs';
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
for(const kind of ['spreadsheet','ocr']) {
 const w=JSON.parse(fs.readFileSync(new URL(`../../n8n/workflows/13c-${kind}-content-queue.json`,import.meta.url)));
 const names=new Set(w.nodes.map(n=>n.name));
 assert.equal(w.active,false);
 assert.equal(w.settings.saveDataErrorExecution,'none');assert.equal(w.settings.saveDataSuccessExecution,'none');
 assert.equal(w.settings.saveManualExecutions,false);
 for(const n of w.nodes) if(n.parameters.jsCode) new AsyncFunction(n.parameters.jsCode);
 for(const [from,connections] of Object.entries(w.connections)) {
  assert(names.has(from));for(const outputs of Object.values(connections))for(const edges of outputs)for(const e of edges)assert(names.has(e.node));
 }
 const extract=w.nodes.find(n=>n.name==='Extract document content');
 assert.equal(extract.parameters.contentType,'binaryData');
 assert.equal(extract.onError,'continueErrorOutput');
 assert.equal(extract.parameters.options.response.response.neverError,true);
 assert.equal(w.connections['Worker returned content'].main[1][0].node,'Prepare safe failure');
 const failure=new AsyncFunction('$','$input','$execution',w.nodes.find(n=>n.name==='Prepare safe failure').parameters.jsCode);
 for(const [error,expected] of [['content_limit','content_limit'],['PRIVATE DOCUMENT','extraction_failed'],[{message:'content_limit'},'extraction_failed'],[undefined,'extraction_failed']]) {
  const result=await failure(()=>({first:()=>({json:{id:'doc',claim_id:'claim',source_etag:'v1'}})}),{first:()=>({json:{error,private:'PRIVATE DOCUMENT'}})},{id:'test'});
  assert.equal(result[0].json.p_metadata.error_code,expected);
  assert(!JSON.stringify(result).includes('PRIVATE DOCUMENT'));
 }
 const claim=w.nodes.find(n=>n.name==='Claim next content');
 assert.equal(JSON.parse(claim.parameters.jsonBody).p_mode,kind);
 assert(w.connections['Check unchanged version'].main[0].some(e=>e.node==='Save text with version guard'));
 const validate=new AsyncFunction('$input',w.nodes.find(n=>n.name==='Validate candidates').parameters.jsCode);
 assert.deepEqual(await validate({first:()=>({json:{has_document:false}})}),[]);
 await assert.rejects(()=>validate({first:()=>({json:{has_document:true}})}));
}
console.log('Both workflows passed syntax, routing, privacy and candidate checks.');
