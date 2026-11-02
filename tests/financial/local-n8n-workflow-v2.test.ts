import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workflowPath = new URL(
  "../../n8n/workflows/09e4-local-financial-extraction-v2.json",
  import.meta.url,
);
const dockerfilePath = new URL(
  "../../workers/financial-xlsx/Dockerfile",
  import.meta.url,
);

interface WorkflowNode {
  name: string;
  type: string;
  parameters: Record<string, unknown>;
  credentials?: Record<string, { id: string; name: string }>;
}

interface WorkflowExport {
  active: boolean;
  nodes: WorkflowNode[];
  connections: Record<string, {
    main: Array<Array<{ node: string; type: string; index: number }>>;
  }>;
  meta: {
    localOnly: boolean;
    operationalPreflightRequired: boolean;
    contractVersion: string;
    persistenceContract: string;
  };
}

async function loadWorkflow() {
  const source = await readFile(workflowPath, "utf8");
  return {
    source,
    workflow: JSON.parse(source) as WorkflowExport,
  };
}

function node(workflow: WorkflowExport, name: string) {
  const match = workflow.nodes.find((item) => item.name === name);
  assert.ok(match, `Nó ausente: ${name}`);
  return match;
}

test("workflow 09E.4 é manual, local, desativado e bloqueado pelo preflight", async () => {
  const { workflow } = await loadWorkflow();

  assert.equal(workflow.active, false);
  assert.equal(workflow.meta.localOnly, true);
  assert.equal(workflow.meta.operationalPreflightRequired, true);
  assert.equal(workflow.meta.contractVersion, "09E.4");
  assert.equal(
    workflow.meta.persistenceContract,
    "financial-extraction-persistence.v2",
  );
  assert.equal(workflow.nodes[0]?.type, "n8n-nodes-base.manualTrigger");
  assert.equal(workflow.nodes.some((item) => (
    item.type.includes("scheduleTrigger") || item.type.includes("webhook")
  )), false);

  const contractCode = String(
    node(workflow, "Define local-only contract").parameters.jsCode,
  );
  const blockedCode = String(
    node(workflow, "Return blocked preflight result").parameters.jsCode,
  );
  assert.match(contractCode, /operationalPreflightApproved = false/);
  assert.match(blockedCode, /databaseWriteAttempted: false/);
  assert.match(blockedCode, /operational_preflight_required/);
  assert.deepEqual(
    workflow.connections["Operational preflight approved?"]?.main[0]?.[0]?.node,
    "Claim next pilot document",
  );
  assert.deepEqual(
    workflow.connections["Operational preflight approved?"]?.main[1]?.[0]?.node,
    "Return blocked preflight result",
  );
});

test("claim e completion usam somente o gateway e credencial local referenciada", async () => {
  const { source, workflow } = await loadWorkflow();
  const claim = node(workflow, "Claim next pilot document");
  const completion = node(workflow, "Complete document with persistence v2");
  const expectedCredential = {
    httpBearerAuth: {
      id: "SELECT_LOCAL_SUPABASE_CREDENTIAL_AFTER_IMPORT",
      name: "LOCAL_ONLY_SUPABASE_SERVICE_ROLE",
    },
  };

  assert.equal(
    claim.parameters.url,
    "http://supabase-rpc-gateway:8080/rest/v1/rpc/finance_claim_next_document",
  );
  assert.equal(
    completion.parameters.url,
    "http://supabase-rpc-gateway:8080/rest/v1/rpc/finance_complete_document_v2",
  );
  assert.deepEqual(claim.credentials, expectedCredential);
  assert.deepEqual(completion.credentials, expectedCredential);
  assert.match(String(claim.parameters.body), /p_pilot_only: true/);
  assert.doesNotMatch(source, /https:\/\//i);
  assert.doesNotMatch(source, /supabase\.co|hostinger|microsoft\.com|graph\.microsoft/i);
  assert.doesNotMatch(source, /Bearer\s+[A-Za-z0-9._-]+/i);
  assert.doesNotMatch(source, /eyJ[A-Za-z0-9_-]{10,}/);
});

test("workflow restringe fixture, identidade e chamada do worker local", async () => {
  const { workflow } = await loadWorkflow();
  const contractCode = String(
    node(workflow, "Define local-only contract").parameters.jsCode,
  );
  const fixtureNode = node(workflow, "Load approved synthetic XLSX");
  const worker = node(workflow, "Invoke private XLSX worker");

  assert.equal(
    fixtureNode.parameters.fileSelector,
    "/fixtures/09b-synthetic-financial-report.xlsx",
  );
  assert.match(contractCode, /00000000-0000-4000-8000-0000000009e2/);
  assert.match(contractCode, /6faa0c8b-733f-4406-91c9-638a4e93ee11/);
  assert.match(contractCode, /TESTE_FINANCEIRO_09B_SINTETICO\.xlsx/);
  assert.match(contractCode, /2a5a4be80c428acf5c14c21bfc214d8020215ddbc95eb1f74c7161493de9e39a/);
  assert.match(contractCode, /\/drive\/root:\/Deskboard KPIs\/Local Synthetic\//);
  assert.equal(
    worker.parameters.url,
    "http://financial-xlsx-worker:8787/v1/extractions/xlsx",
  );
  assert.deepEqual(worker.credentials, {
    httpHeaderAuth: {
      id: "SELECT_LOCAL_WORKER_CREDENTIAL_AFTER_IMPORT",
      name: "LOCAL_ONLY_FINANCIAL_XLSX_WORKER",
    },
  });
});

test("mapeamento preserva contrato v2, revisão, proveniência e idempotência", async () => {
  const { workflow } = await loadWorkflow();
  const mappingCode = String(
    node(workflow, "Validate extraction and build v2 payload").parameters.jsCode,
  );
  const completionCode = String(
    node(workflow, "Return sanitized completion result").parameters.jsCode,
  );

  for (const metric of ["revenue", "expense", "net_result", "cash_available"]) {
    assert.match(mappingCode, new RegExp(metric));
  }
  assert.match(mappingCode, /logical_key/);
  assert.match(mappingCode, /source_cell/);
  assert.match(mappingCode, /source_row/);
  assert.match(mappingCode, /review_status: 'needs_review'/);
  assert.match(mappingCode, /p_status: 'needs_review'/);
  assert.match(mappingCode, /unsupported_canonical_fact/);
  assert.match(mappingCode, /deferredBankTransactionCount/);
  assert.match(completionCode, /insertedRows \+ unchangedRows === context\.supportedFactCount/);
  assert.match(completionCode, /publishable: false/);
  assert.doesNotMatch(mappingCode, /financial_monthly_metrics|dashboard/i);
});

test("resultados terminais são sanitizados e não retornam payload financeiro", async () => {
  const { workflow } = await loadWorkflow();
  const claimCode = String(
    node(workflow, "Validate claim response").parameters.jsCode,
  );
  const completionCode = String(
    node(workflow, "Return sanitized completion result").parameters.jsCode,
  );

  assert.match(claimCode, /status: 'skipped'/);
  assert.match(claimCode, /status: 'failure'/);
  assert.match(completionCode, /status: 'success'/);
  assert.match(completionCode, /status: 'failure'/);
  assert.doesNotMatch(completionCode, /rpcPayload|p_rows|amount|logical_key/);
});

test("Dockerfile fixa a imagem-base Node aprovada por digest", async () => {
  const source = await readFile(dockerfilePath, "utf8");
  const firstLine = source.split(/\r?\n/, 1)[0];

  assert.equal(
    firstLine,
    "FROM node:22-bookworm-slim@sha256:4b150b48b4116e2a22f2c39cc27025fbf4f153e2078fd3b14d159fdb5c7279da",
  );
  assert.equal((source.match(/^FROM /gm) ?? []).length, 1);
});
