import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workflowUrl = new URL(
  "../../n8n/workflows/11d-kawana-real-financial-pilot-v2.json",
  import.meta.url,
);
const hostingerComposeUrl = new URL(
  "../../workers/financial-xlsx/docker-compose.hostinger.example.yml",
  import.meta.url,
);

interface WorkflowNode {
  name: string;
  type: string;
  parameters: Record<string, unknown>;
  credentials?: Record<string, { id: string; name: string }>;
}

interface WorkflowExport {
  name: string;
  active: boolean;
  nodes: WorkflowNode[];
  settings: Record<string, unknown>;
  meta: Record<string, unknown>;
}

async function loadWorkflow() {
  const source = await readFile(workflowUrl, "utf8");
  return { source, workflow: JSON.parse(source) as WorkflowExport };
}

function node(workflow: WorkflowExport, name: string) {
  const match = workflow.nodes.find((item) => item.name === name);
  assert.ok(match, `Nó ausente: ${name}`);
  return match;
}

function runCodeNode(
  code: string,
  input: Record<string, unknown>,
  referencedNodes: Record<string, Record<string, unknown>>,
) {
  const execute = new Function("$input", "$", code);
  const $input = { first: () => ({ json: input }) };
  const $ = (name: string) => ({
    first: () => ({ json: referencedNodes[name] }),
  });
  return execute($input, $) as Array<{ json: Record<string, unknown> }>;
}

const expectedClaim = {
  documentId: "11111111-1111-4111-8111-111111111111",
  companyId: "22222222-2222-4222-8222-222222222222",
  companyName: "Kawana",
  fileName: "09.2026 Relatório Gerencial Kawana.xlsx",
  fileSize: 524760,
  sourceEtag: '"synthetic-etag"',
  periodMonth: "2026-09",
};

const validClaimBody = {
  has_document: true,
  contract_version: 2,
  document_id: expectedClaim.documentId,
  owner_id: "33333333-3333-4333-8333-333333333333",
  company_id: expectedClaim.companyId,
  company_name: expectedClaim.companyName,
  source_etag: expectedClaim.sourceEtag,
  external_drive_id: "synthetic-drive",
  external_file_id: "synthetic-file",
  source_path: "/drive/root:/Deskboard KPIs/Financeiro/report.xlsx",
  file_name: expectedClaim.fileName,
  file_size: expectedClaim.fileSize,
  extension: "xlsx",
  period_month: expectedClaim.periodMonth,
  claim_id: "44444444-4444-4444-8444-444444444444",
};

test("piloto 11D é manual, inativo e bloqueado por preflight", async () => {
  const { workflow } = await loadWorkflow();
  const contractCode = String(
    node(workflow, "Define exact real pilot").parameters.jsCode,
  );

  assert.equal(workflow.active, false);
  assert.equal(workflow.nodes[0]?.type, "n8n-nodes-base.manualTrigger");
  assert.equal(workflow.nodes.some((item) => (
    item.type.includes("scheduleTrigger") || item.type.includes("webhook")
  )), false);
  assert.match(contractCode, /operationalPreflightApproved = false/);
  assert.match(contractCode, /7aa10025-751f-4d8a-947d-5decf1e1dc2d/);
  assert.match(contractCode, /468978dd-6ffa-440e-9465-df966ba093ee/);
  assert.match(contractCode, /periodMonth: '2026-09'/);
  assert.match(contractCode, /maxFileSize: 8388608/);
  assert.match(contractCode, /KAWANA_11D_DOCUMENT_ETAG/);
});

test("claim, Graph, worker e completion usam contratos esperados", async () => {
  const { workflow } = await loadWorkflow();
  const claim = node(workflow, "Claim exact document v2");
  const graph = node(workflow, "Download exact XLSX from Graph");
  const worker = node(workflow, "Invoke private XLSX worker");
  const completion = node(workflow, "Complete exact document v2");
  const failedCompletion = node(
    workflow,
    "Finalize rejected extraction as failed",
  );

  assert.match(String(claim.parameters.url), /finance_claim_document_v2/);
  assert.equal(claim.parameters.authentication, "predefinedCredentialType");
  assert.equal(claim.parameters.nodeCredentialType, "supabaseApi");
  assert.ok(claim.credentials?.supabaseApi);
  assert.equal(claim.parameters.contentType, "json");
  assert.equal(claim.parameters.specifyBody, "json");
  assert.equal(claim.parameters.rawContentType, undefined);
  assert.match(String(claim.parameters.jsonBody), /p_document_id/);
  assert.match(String(claim.parameters.jsonBody), /p_company_id/);
  assert.match(String(claim.parameters.jsonBody), /p_source_etag/);
  assert.match(String(claim.parameters.jsonBody), /p_period_month/);
  assert.match(String(graph.parameters.url), /graph\.microsoft\.com\/v1\.0\/drives/);
  assert.equal(worker.parameters.url, "http://financial-xlsx-worker:8787/v1/extractions/xlsx");
  assert.match(JSON.stringify(worker.parameters), /kawana-management-report/);
  assert.match(JSON.stringify(worker.parameters), /2026-09/);
  assert.match(String(completion.parameters.url), /finance_complete_document_v2/);
  assert.equal(completion.parameters.authentication, "predefinedCredentialType");
  assert.equal(completion.parameters.nodeCredentialType, "supabaseApi");
  assert.equal(completion.parameters.contentType, "json");
  assert.equal(completion.parameters.specifyBody, "json");
  assert.equal(completion.parameters.rawContentType, undefined);
  assert.equal(completion.parameters.jsonBody, "={{ $json.rpcPayload }}");
  assert.ok(completion.credentials?.supabaseApi);
  assert.equal(failedCompletion.parameters.contentType, "json");
  assert.equal(failedCompletion.parameters.specifyBody, "json");
  assert.equal(failedCompletion.parameters.rawContentType, undefined);
  assert.equal(
    failedCompletion.parameters.jsonBody,
    "={{ $json.failurePayload }}",
  );
});

test("RPCs retornam resposta completa em JSON sem transporte raw", async () => {
  const { workflow } = await loadWorkflow();

  for (const name of [
    "Claim exact document v2",
    "Complete exact document v2",
    "Finalize rejected extraction as failed",
  ]) {
    const request = node(workflow, name);
    const parameters = JSON.stringify(request.parameters);

    assert.match(parameters, /"fullResponse":true/);
    assert.match(parameters, /"neverError":true/);
    assert.match(parameters, /"responseFormat":"json"/);
    assert.doesNotMatch(parameters, /"contentType":"raw"/);
    assert.doesNotMatch(parameters, /JSON\.stringify/);
  }
});

test("todas as referências nomeadas apontam para nós existentes", async () => {
  const { source, workflow } = await loadWorkflow();
  const names = new Set(workflow.nodes.map((item) => item.name));
  const references = source.matchAll(/\$\('([^']+)'\)/g);

  for (const reference of references) {
    assert.ok(
      names.has(reference[1]),
      `Referência aponta para nó ausente: ${reference[1]}`,
    );
  }
});

test("validador do claim aceita objeto, JSON string e array unitário", async () => {
  const { workflow } = await loadWorkflow();
  const code = String(
    node(workflow, "Validate exact claim response").parameters.jsCode,
  );
  const referenced = {
    "Define exact real pilot": { expected: expectedClaim },
  };

  for (const body of [
    validClaimBody,
    JSON.stringify(validClaimBody),
    [validClaimBody],
  ]) {
    const result = runCodeNode(code, { statusCode: 200, body }, referenced);
    assert.equal(result[0]?.json.outcome, "claimed");
  }
});

test("validador do claim rejeita shape, status e identidade inválidos", async () => {
  const { workflow } = await loadWorkflow();
  const code = String(
    node(workflow, "Validate exact claim response").parameters.jsCode,
  );
  const referenced = {
    "Define exact real pilot": { expected: expectedClaim },
  };

  for (const input of [
    { statusCode: 200, body: "not-json" },
    { statusCode: 200, body: [] },
    { statusCode: 200, body: [validClaimBody, validClaimBody] },
    { body: validClaimBody },
  ]) {
    const result = runCodeNode(code, input, referenced);
    assert.equal(result[0]?.json.code, "claim_response_shape_invalid");
  }

  const requestFailure = runCodeNode(
    code,
    { statusCode: 401, body: { error: "unauthorized" } },
    referenced,
  );
  assert.equal(requestFailure[0]?.json.code, "claim_request_failed");

  const identityFailure = runCodeNode(
    code,
    { statusCode: 200, body: { ...validClaimBody, file_size: 1 } },
    referenced,
  );
  assert.equal(
    identityFailure[0]?.json.code,
    "claimed_document_identity_mismatch",
  );
});

test("validadores de completion normalizam os mesmos formatos seguros", async () => {
  const { workflow } = await loadWorkflow();
  const successCode = String(
    node(workflow, "Return sanitized needs review result").parameters.jsCode,
  );
  const failureCode = String(
    node(workflow, "Return sanitized rejected result").parameters.jsCode,
  );
  const completionContext = {
    supportedFactCount: 4,
    deferredFactCount: 0,
    deferredBankTransactionCount: 0,
  };
  const successBody = {
    success: true,
    contract_version: 2,
    status: "needs_review",
    requires_approval: true,
    inserted_rows: 4,
    unchanged_rows: 0,
  };
  const failedBody = {
    success: true,
    contract_version: 2,
    status: "failed",
    inserted_rows: 0,
  };

  for (const body of [successBody, JSON.stringify(successBody), [successBody]]) {
    const result = runCodeNode(
      successCode,
      { statusCode: 200, body },
      { "Validate structure and build v2 payload": completionContext },
    );
    assert.equal(result[0]?.json.reviewStatus, "needs_review");
  }

  for (const body of [failedBody, JSON.stringify(failedBody), [failedBody]]) {
    const result = runCodeNode(failureCode, { statusCode: 200, body }, {});
    assert.equal(result[0]?.json.code, "rejected_before_fact_persistence");
  }

  const invalidSuccess = runCodeNode(
    successCode,
    { statusCode: 200, body: [successBody, successBody] },
    { "Validate structure and build v2 payload": completionContext },
  );
  assert.equal(invalidSuccess[0]?.json.code, "completion_response_shape_invalid");

  const invalidFailure = runCodeNode(
    failureCode,
    { statusCode: 200, body: [] },
    {},
  );
  assert.equal(
    invalidFailure[0]?.json.code,
    "failed_completion_response_shape_invalid",
  );
});

test("estrutura, warnings, conciliação e quatro fatos bloqueiam antes da persistência", async () => {
  const { workflow } = await loadWorkflow();
  const code = String(
    node(workflow, "Validate structure and build v2 payload").parameters.jsCode,
  );

  for (const sheet of [
    "CAPA", "Resumo", "Fluxo de Caixa 2026", "ATIVO X PASSIVO KWN",
    "ATIVOS KWN", "PASSIVO KWN", "RECEITAS KWN", "DESPESAS KWN",
    "Itaú Kawana", "Bradesco Invest Fácil Kawana", "Bradesco Kawana", "Caixa Kawana",
  ]) {
    assert.match(code, new RegExp(sheet));
  }
  for (const metric of ["revenue", "expense", "net_result", "cash_available"]) {
    assert.match(code, new RegExp(metric));
  }
  assert.match(code, /warning\?\.severity === 'error'/);
  assert.match(code, /item\?\.status === 'failed'/);
  assert.match(code, /canonical\.length !== 4/);
  assert.match(code, /p_status: 'needs_review'/);
  assert.match(code, /p_status: 'failed'/);
  assert.match(code, /const extraction = response\.body;/);
  assert.match(code, /const statusCode = Number\(response\.statusCode\);/);
  assert.doesNotMatch(code, /statusCode \?\? 200/);
});

test("workflow não contém credenciais, aprovação ou publicação automáticas", async () => {
  const { source, workflow } = await loadWorkflow();

  assert.doesNotMatch(source, /Bearer\s+[A-Za-z0-9._-]+/i);
  assert.doesNotMatch(source, /eyJ[A-Za-z0-9_-]{10,}/);
  assert.doesNotMatch(source, /service_role_key|client_secret|refresh_token/i);
  assert.doesNotMatch(source, /finance_publish_monthly_metrics|financial_monthly_metrics_published/i);
  assert.equal(workflow.meta.automaticApproval, false);
  assert.equal(workflow.meta.automaticPublication, false);
  assert.equal(workflow.settings.saveDataSuccessExecution, "none");
  assert.equal(workflow.settings.saveDataErrorExecution, "none");
});

test("configuração Hostinger limita o worker a 8 MiB", async () => {
  const source = await readFile(hostingerComposeUrl, "utf8");
  assert.match(source, /FINANCIAL_XLSX_MAX_FILE_SIZE:\s*8388608/);
  assert.match(source, /FINANCIAL_XLSX_WORKER_SECRET_FILE:/);
  assert.doesNotMatch(source, /FINANCIAL_XLSX_WORKER_SECRET:\s*[^$\s]/);
});
