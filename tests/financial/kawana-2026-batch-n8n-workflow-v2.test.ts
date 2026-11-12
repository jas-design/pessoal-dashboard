import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workflowUrl = new URL(
  "../../n8n/workflows/12b-kawana-2026-original-reports-batch-v2.json",
  import.meta.url,
);
const verificationSqlUrl = new URL(
  "../../scripts/supabase/12b-kawana-2026-pending-review-verification.sql",
  import.meta.url,
);

interface WorkflowNode {
  name: string;
  type: string;
  typeVersion: number;
  parameters: Record<string, any>;
}

interface WorkflowExport {
  active: boolean;
  nodes: WorkflowNode[];
  connections: Record<string, { main: Array<Array<{ node: string }>> }>;
  settings: Record<string, unknown>;
  meta: Record<string, any>;
}

async function loadWorkflow() {
  const source = await readFile(workflowUrl, "utf8");
  return { source, workflow: JSON.parse(source) as WorkflowExport };
}

function node(workflow: WorkflowExport, name: string) {
  const found = workflow.nodes.find((item) => item.name === name);
  assert.ok(found, `Nó ausente: ${name}`);
  return found;
}

function runCode(
  code: string,
  inputs: Array<Record<string, any>>,
  references: Record<string, Record<string, any>> = {},
) {
  const execute = new Function("$input", "$", code);
  const $input = {
    first: () => ({ json: inputs[0] }),
    all: () => inputs.map((json) => ({ json })),
  };
  const $ = (name: string) => ({
    first: () => ({ json: references[name] }),
    item: { json: references[name] },
  });
  return execute($input, $) as Array<{ json: Record<string, any> }>;
}

const companyId = "468978dd-6ffa-440e-9465-df966ba093ee";
const ids = [
  "3c96d0f6-0131-400d-a725-df734fdf74b0",
  "0f42768b-4874-432e-ad1a-be9d17742fb3",
  "8d8941fd-a8e6-4ac3-a4f3-8db955e2f8b8",
  "e8f068b1-b783-4ac2-aabb-59edced1cec7",
  "14697a01-9c0a-4fb2-80de-aa74ed3a75d4",
  "52099517-2fd8-44cd-b7dd-8b4eb5d6c072",
  "12b33d82-d37a-4ca2-bef7-b86bc0748e12",
  "70873b2c-9059-4a07-b6e5-5b1e566f815b",
];

function catalogDocument(target: Record<string, any>) {
  return {
    id: target.documentId,
    owner_id: "11111111-1111-4111-8111-111111111111",
    company_id: companyId,
    provider: "onedrive",
    is_deleted: false,
    processing_status: "pending",
    file_name: target.fileName,
    file_size: 515388,
    source_etag: `\"etag-${target.periodMonth}\"`,
    external_drive_id: `drive-${target.periodMonth}`,
    external_file_id: `file-${target.periodMonth}`,
    source_path: `/drive/root:/Deskboard KPIs/Financeiro/${target.fileName}`,
    period_year: 2026,
    period_month: Number(target.periodMonth.slice(5, 7)),
  };
}

function workerContext(target: Record<string, any>) {
  const document = catalogDocument(target);
  return {
    outcome: "download_valid",
    sequence: target.sequence,
    target,
    catalog: {
      documentId: document.id,
      ownerId: document.owner_id,
      companyId: document.company_id,
      fileName: document.file_name,
      fileSize: document.file_size,
      sourceEtag: document.source_etag,
      externalDriveId: document.external_drive_id,
      externalFileId: document.external_file_id,
      sourcePath: document.source_path,
      periodMonth: target.periodMonth,
    },
  };
}

const requiredSheets = [
  "CAPA", "RESUMO KWM", "Fluxo de Caixa 2026", "ATIVO X PASSIVO KWN",
  "ATIVOS KWN", "PASSIVO KWN", "RECEITAS X DESPESAS KWN", "RECEITAS KWN",
  "DESPESAS KWN", "Itaú Kawana", "Bradesco Invest Fácil Kawana",
  "Bradesco Kawana", "Caixa Kawana",
];

function validExtraction(context: ReturnType<typeof workerContext>) {
  const values: Record<string, [string, string, string]> = {
    cash_available: ["70000.00", "RESUMO KWM", "B10"],
    revenue: ["400000.00", "RECEITAS X DESPESAS KWN", "B23"],
    expense: ["300000.00", "RECEITAS X DESPESAS KWN", "B8"],
    net_result: ["100000.00", "RECEITAS X DESPESAS KWN", "B6"],
  };
  const facts = Object.entries(values).map(([metricCode, [amount, sheet, cellAddress]]) => ({
    metricCode,
    amount,
    amountMinor: String(BigInt(amount.replace(".", ""))),
    companyId,
    companyName: "Kawana",
    documentId: context.target.documentId,
    sourceEtag: context.catalog.sourceEtag,
    periodMonth: context.target.periodMonth,
    currency: "BRL",
    reviewStatus: "needs_review",
    sourceScope: "business",
    includedInConsolidatedKpi: true,
    aggregationLevel: "canonical",
    evidence: { sheet, cellAddress },
    logicalKey: [
      context.target.documentId, context.catalog.sourceEtag, sheet, cellAddress,
      metricCode, context.target.periodMonth,
    ].join(":"),
  }));
  return {
    schemaVersion: "financial-extraction.v1",
    status: "needs_review",
    publishable: false,
    metadata: {
      mapping: { id: "kawana-management-report", version: "2", parserVersion: "12A.2" },
      company: { id: companyId, name: "Kawana" },
      document: {
        id: context.target.documentId,
        etag: context.catalog.sourceEtag,
        fileName: context.target.fileName,
      },
      periodMonth: context.target.periodMonth,
      sheetCount: 13,
      sheets: requiredSheets,
    },
    statistics: { formulaErrorCount: 0, duplicateFactCount: 0 },
    warnings: [],
    reconciliations: [
      "combined_result_equals_revenue_minus_expense",
      "revenue_detail_matches_combined",
      "expense_detail_matches_combined",
      "summary_bank_components_match_total",
      "bank_statement_balances_match_summary",
    ].map((code) => ({ code, status: "passed" })),
    facts,
    bankTransactions: [],
  };
}

test("12B é manual, inativo e bloqueado por padrão", async () => {
  const { workflow } = await loadWorkflow();
  const code = String(node(workflow, "Define approved batch inventory").parameters.jsCode);
  const result = runCode(code, [{}]);
  assert.equal(workflow.active, false);
  assert.equal(result[0].json.batchExecutionApproved, false);
  assert.equal(workflow.nodes.filter((item) => item.type === "n8n-nodes-base.manualTrigger").length, 1);
  assert.equal(workflow.nodes.some((item) => /scheduleTrigger|webhook/.test(item.type)), false);
});

test("inventário contém exatamente janeiro a agosto e exclui setembro", async () => {
  const { source, workflow } = await loadWorkflow();
  const result = runCode(String(node(workflow, "Define approved batch inventory").parameters.jsCode), [{}]);
  const targets = result[0].json.targets;
  assert.equal(targets.length, 8);
  assert.deepEqual(targets.map((item: any) => item.documentId), ids);
  assert.deepEqual(targets.map((item: any) => item.periodMonth), Array.from({ length: 8 }, (_, i) => `2026-${String(i + 1).padStart(2, "0")}`));
  assert.equal(targets.every((item: any) => item.mappingVersion === "2" && item.parserVersion === "12A.2"), true);
  assert.doesNotMatch(source, /2026-09/);
});

test("nós e versões são compatíveis com o export Community da Hostinger", async () => {
  const { workflow } = await loadWorkflow();
  const versions = new Map(workflow.nodes.map((item) => [item.type, item.typeVersion]));
  assert.equal(versions.get("n8n-nodes-base.manualTrigger"), 1);
  assert.equal(versions.get("n8n-nodes-base.code"), 2);
  assert.equal(versions.get("n8n-nodes-base.if"), 2.2);
  assert.equal(versions.get("n8n-nodes-base.httpRequest"), 4.2);
  assert.equal(versions.get("n8n-nodes-base.splitInBatches"), 3);
  assert.equal(node(workflow, "Process documents sequentially").parameters.batchSize, 1);
});

test("loop processa um documento e reúne todos os resultados independentes", async () => {
  const { workflow } = await loadWorkflow();
  const loop = workflow.connections["Process documents sequentially"].main;
  assert.equal(loop[0][0].node, "Summarize sanitized batch results");
  assert.equal(loop[1][0].node, "Catalog item eligible?");
  for (const name of [
    "Return catalog or duplicate result", "Return preclaim isolated result",
    "Return worker isolated result", "Return claim isolated result",
    "Return independent document result",
  ]) assert.equal(workflow.connections[name].main[0][0].node, "Process documents sequentially");
});

test("catálogo real e fatos existentes controlam identidade, segunda via e idempotência", async () => {
  const { workflow } = await loadWorkflow();
  const define = runCode(String(node(workflow, "Define approved batch inventory").parameters.jsCode), [{}])[0].json;
  const documents = define.targets.map(catalogDocument);
  const code = String(node(workflow, "Prepare independent batch items").parameters.jsCode);
  const refs = {
    "Define approved batch inventory": define,
    "Fetch batch catalog metadata": { statusCode: 200, body: documents },
  };
  const eligible = runCode(code, [{ statusCode: 200, body: [] }], refs);
  assert.equal(eligible.length, 8);
  assert.equal(eligible.every((item) => item.json.outcome === "eligible"), true);
  const target = define.targets[0];
  const document = documents[0];
  const facts = ["revenue", "expense", "net_result", "cash_available"].map((metric) => ({
    document_id: target.documentId,
    source_etag: document.source_etag,
    metric,
    contract_version: 2,
    review_status: "pending_review",
  }));
  const duplicate = runCode(code, [{ statusCode: 200, body: facts }], refs);
  assert.equal(duplicate[0].json.outcome, "already_processed");
  const partial = runCode(code, [{ statusCode: 200, body: facts.slice(0, 3) }], refs);
  assert.equal(partial[0].json.code, "current_etag_has_partial_or_conflicting_facts");
  const secondCopyRefs = { ...refs, "Fetch batch catalog metadata": {
    statusCode: 200,
    body: [{ ...documents[0], file_name: "01.2026 Relatório Gerencial Kawana 2ª via.xlsx" }, ...documents.slice(1)],
  } };
  const secondCopy = runCode(code, [{ statusCode: 200, body: [] }], secondCopyRefs);
  assert.equal(secondCopy[0].json.outcome, "isolated");
});

test("worker é validado antes do claim e gera quatro linhas pending_review", async () => {
  const { workflow } = await loadWorkflow();
  const define = runCode(String(node(workflow, "Define approved batch inventory").parameters.jsCode), [{}])[0].json;
  const context = workerContext(define.targets[7]);
  const code = String(node(workflow, "Validate worker result before claim").parameters.jsCode);
  const result = runCode(code, [{ statusCode: 200, body: validExtraction(context) }], {
    "Validate downloaded original XLSX": context,
  });
  assert.equal(result[0].json.outcome, "worker_valid");
  assert.equal(result[0].json.rows.length, 4);
  assert.equal(result[0].json.rows.every((row: any) => row.review_status === "needs_review"), true);
  assert.equal(workflow.connections["Worker validation passed?"].main[0][0].node, "Claim validated document v2");
});

test("parser, fórmula, conciliação, origem e matemática divergentes isolam sem claim", async () => {
  const { workflow } = await loadWorkflow();
  const define = runCode(String(node(workflow, "Define approved batch inventory").parameters.jsCode), [{}])[0].json;
  const context = workerContext(define.targets[0]);
  const code = String(node(workflow, "Validate worker result before claim").parameters.jsCode);
  const mutations = [
    (value: any) => { value.metadata.mapping.parserVersion = "12A.1"; },
    (value: any) => { value.statistics.formulaErrorCount = 1; },
    (value: any) => { value.reconciliations[0].status = "failed"; },
    (value: any) => { value.facts[0].evidence.cellAddress = "B11"; },
    (value: any) => { value.facts.find((fact: any) => fact.metricCode === "net_result").amount = "999.00"; },
  ];
  for (const mutate of mutations) {
    const extraction = validExtraction(context);
    mutate(extraction);
    const result = runCode(code, [{ statusCode: 200, body: extraction }], {
      "Validate downloaded original XLSX": context,
    });
    assert.equal(result[0].json.outcome, "isolated");
  }
});

test("claim exato monta completion v2 sem aprovação ou publicação", async () => {
  const { workflow } = await loadWorkflow();
  const define = runCode(String(node(workflow, "Define approved batch inventory").parameters.jsCode), [{}])[0].json;
  const context = workerContext(define.targets[0]);
  const validated = runCode(
    String(node(workflow, "Validate worker result before claim").parameters.jsCode),
    [{ statusCode: 200, body: validExtraction(context) }],
    { "Validate downloaded original XLSX": context },
  )[0].json;
  const claim = {
    has_document: true, contract_version: 2, document_id: context.target.documentId,
    owner_id: context.catalog.ownerId, company_id: companyId, company_name: "Kawana",
    source_etag: context.catalog.sourceEtag, file_name: context.target.fileName,
    file_size: context.catalog.fileSize, external_drive_id: context.catalog.externalDriveId,
    external_file_id: context.catalog.externalFileId, source_path: context.catalog.sourcePath,
    extension: "xlsx", period_month: context.target.periodMonth,
    claim_id: "22222222-2222-4222-8222-222222222222",
  };
  const result = runCode(
    String(node(workflow, "Validate claim and build completion").parameters.jsCode),
    [{ statusCode: 200, body: claim }],
    { "Validate worker result before claim": validated },
  );
  assert.equal(result[0].json.outcome, "claim_valid");
  assert.equal(result[0].json.rpcPayload.p_status, "needs_review");
  assert.equal(result[0].json.rpcPayload.p_rows.length, 4);
  assert.equal(result[0].json.rpcPayload.p_excerpt, null);
});

test("completion idempotente e resumo não expõem valores financeiros", async () => {
  const { workflow } = await loadWorkflow();
  const completionCode = String(node(workflow, "Return independent document result").parameters.jsCode);
  const context = { sequence: 1, documentId: ids[0], periodMonth: "2026-01" };
  for (const [inserted_rows, unchanged_rows] of [[4, 0], [0, 4]]) {
    const result = runCode(completionCode, [{ statusCode: 200, body: {
      success: true, contract_version: 2, document_id: ids[0], status: "needs_review",
      inserted_rows, unchanged_rows, requires_approval: true,
    } }], { "Validate claim and build completion": context });
    assert.equal(result[0].json.status, "pending_review");
    assert.equal(result[0].json.publishable, false);
    assert.equal("amount" in result[0].json, false);
  }
  const summary = runCode(
    String(node(workflow, "Summarize sanitized batch results").parameters.jsCode),
    [
      { status: "pending_review", sequence: 1, documentId: ids[0], periodMonth: "2026-01" },
      { status: "already_processed", sequence: 2, documentId: ids[1], periodMonth: "2026-02" },
      { status: "isolated", sequence: 3, documentId: ids[2], periodMonth: "2026-03" },
    ],
  )[0].json;
  assert.deepEqual([summary.pendingReview, summary.alreadyProcessed, summary.isolated], [1, 1, 1]);
  assert.equal(summary.automaticPublication, false);
});

test("workflow não contém secrets, publicação ou contratos genéricos", async () => {
  const { source, workflow } = await loadWorkflow();
  const names = new Set(workflow.nodes.map((item) => item.name));
  const supabaseRequests = workflow.nodes.filter((item) => (
    item.type === "n8n-nodes-base.httpRequest"
    && String(item.parameters.url).includes("supabase.co")
  ));
  for (const reference of source.matchAll(/\$\('([^']+)'\)/g)) {
    assert.ok(names.has(reference[1]), `Referência inválida: ${reference[1]}`);
  }
  assert.equal(supabaseRequests.length, 4);
  assert.equal(supabaseRequests.every((item) => (
    String(item.parameters.url).includes("https://xjxwyzyfnumfphubuize.supabase.co/rest/v1/")
  )), true);
  assert.doesNotMatch(source, /\$vars\.|KAWANA_SUPABASE_URL/);
  assert.doesNotMatch(source, /Bearer\s+[A-Za-z0-9._-]+|eyJ[A-Za-z0-9_-]{10,}/i);
  assert.doesNotMatch(source, /service_role_key|client_secret|refresh_token/i);
  assert.doesNotMatch(source, /finance_claim_next_document/i);
  assert.doesNotMatch(source, /finance_publish_monthly_metrics|financial_monthly_metrics_published/i);
  assert.equal(workflow.meta.automaticApproval, false);
  assert.equal(workflow.meta.automaticPublication, false);
  assert.equal(workflow.settings.saveDataSuccessExecution, "none");
  assert.equal(workflow.settings.saveDataErrorExecution, "none");
});

test("SQL é read-only e verifica oito documentos com quatro pending_review", async () => {
  const sql = await readFile(verificationSqlUrl, "utf8");
  assert.match(sql, /begin transaction read only/i);
  for (const id of ids) assert.match(sql, new RegExp(id, "i"));
  assert.match(sql, /review_status = 'pending_review'/i);
  assert.match(sql, /contract_version = 2/i);
  assert.match(sql, /fact_count = 4/i);
  assert.match(sql, /rollback;\s*$/i);
  assert.doesNotMatch(sql, /\b(insert|update|delete|truncate|alter|drop|create)\b/i);
});
