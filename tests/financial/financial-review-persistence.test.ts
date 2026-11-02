import assert from "node:assert/strict";
import test from "node:test";

import { createSyntheticFinancialXlsx } from "../../scripts/financial/create-synthetic-xlsx-fixture";
import {
  extractFinancialXlsx,
  XLSX_MIME_TYPE,
} from "../../src/services/financial/financial-xlsx-adapter";
import {
  assertExistingFinancialExtractionRpcCompatible,
  createFinancialCompletionV2Request,
  prepareFinancialReviewPersistence,
} from "../../src/services/financial/financial-review-persistence";

const identity = {
  companyId: "00000000-0000-4000-8000-000000000901",
  documentId: "00000000-0000-4000-8000-000000000902",
  sourceEtag: "synthetic-local-etag-09b-v1",
};

const claimId = "00000000-0000-4000-8000-000000000903";

async function extractSyntheticFixture() {
  return extractFinancialXlsx({
    binary: await createSyntheticFinancialXlsx(),
    mimeType: XLSX_MIME_TYPE,
    mapping: {
      id: "kawana-management-report",
      version: "1",
    },
    company: {
      id: identity.companyId,
      name: "Empresa Sintética Local",
    },
    document: {
      id: identity.documentId,
      fileName: "09b-synthetic-financial-report.xlsx",
      etag: identity.sourceEtag,
    },
    periodMonth: "2026-09",
    extractedAt: "2026-10-28T12:00:00.000Z",
  });
}

test("prepara os quatro fatos canônicos para revisão sem publicar métricas", async () => {
  const extraction = await extractSyntheticFixture();
  const plan = prepareFinancialReviewPersistence(extraction, identity);
  const septemberFacts = plan.facts.filter(
    (fact) => fact.periodMonth === "2026-09",
  );

  assert.equal(plan.status, "needs_review");
  assert.equal(plan.publishable, false);
  assert.deepEqual(plan.identity, {
    ...identity,
    companyName: "Empresa Sintética Local",
  });
  assert.deepEqual(
    new Set(septemberFacts.map((fact) => fact.metricCode)),
    new Set(["revenue", "expense", "net_result", "cash_available"]),
  );
  assert.ok(plan.facts.every((fact) => fact.companyId === identity.companyId));
  assert.ok(plan.facts.every((fact) => fact.documentId === identity.documentId));
  assert.ok(plan.facts.every((fact) => fact.sourceEtag === identity.sourceEtag));
  assert.ok(plan.facts.every((fact) => fact.reviewStatus === "needs_review"));
  assert.equal(new Set(plan.facts.map((fact) => fact.logicalKey)).size, plan.facts.length);
  assert.equal(plan.v2RpcCompatible, true);
  assert.deepEqual(plan.targetContract, {
    version: "financial-extraction-persistence.v2",
    rpc: "finance_complete_document_v2",
  });
});

test("gera o payload v2 completo com revisão e proveniência preservadas", async () => {
  const plan = prepareFinancialReviewPersistence(
    await extractSyntheticFixture(),
    identity,
  );
  const request = createFinancialCompletionV2Request(plan, claimId);

  assert.equal(request.p_document_id, identity.documentId);
  assert.equal(request.p_claim_id, claimId);
  assert.equal(request.p_source_etag, identity.sourceEtag);
  assert.equal(request.p_status, "needs_review");
  assert.equal(request.p_rows.length, plan.facts.length);
  assert.ok(request.p_rows.every((row) => row.review_status === "needs_review"));
  assert.ok(request.p_rows.every((row) => row.month.endsWith("-01")));
  assert.ok(request.p_rows.every((row) => row.logical_key.length > 0));
  assert.ok(request.p_rows.every((row) => row.source_cell.length > 1));
});

test("preserva resultado líquido negativo sem permitir sinal negativo em outras métricas", async () => {
  const extraction = await extractSyntheticFixture();
  const netResult = extraction.facts.find(
    (fact) => fact.metricCode === "net_result"
      && fact.periodMonth === "2026-09",
  )!;
  netResult.amount = "-75.15";
  netResult.amountMinor = "-7515";
  netResult.originalSign = "negative";
  netResult.canonicalSign = "negative";

  const plan = prepareFinancialReviewPersistence(extraction, identity);
  const request = createFinancialCompletionV2Request(plan, claimId);
  const persistedNetResult = request.p_rows.find(
    (row) => row.metric_code === "net_result" && row.month === "2026-09-01",
  );

  assert.equal(persistedNetResult?.amount, "-75.15");

  const revenue = extraction.facts.find(
    (fact) => fact.metricCode === "revenue"
      && fact.periodMonth === "2026-09",
  )!;
  revenue.amount = "-120.25";
  revenue.amountMinor = "-12025";

  assert.throws(
    () => prepareFinancialReviewPersistence(extraction, identity),
    (error: Error & { code?: string }) => (
      error.code === "invalid_extraction_contract"
    ),
  );
});

test("mantém dados fora do escopo explicitamente adiados", async () => {
  const extraction = await extractSyntheticFixture();
  const plan = prepareFinancialReviewPersistence(extraction, identity);

  assert.ok(plan.deferredFacts.length > 0);
  assert.ok(plan.deferredFacts.some(
    (fact) => fact.metricCode.startsWith("revenue_detail_"),
  ));
  assert.equal(plan.deferredBankTransactionCount, 1);
});

test("produz as mesmas chaves lógicas em reprocessamentos idênticos", async () => {
  const first = prepareFinancialReviewPersistence(
    await extractSyntheticFixture(),
    identity,
  );
  const second = prepareFinancialReviewPersistence(
    await extractSyntheticFixture(),
    identity,
  );

  assert.deepEqual(
    first.facts.map((fact) => fact.logicalKey),
    second.facts.map((fact) => fact.logicalKey),
  );
  assert.deepEqual(
    createFinancialCompletionV2Request(first, claimId),
    createFinancialCompletionV2Request(second, claimId),
  );
});

test("rejeita divergência de empresa, documento ou ETag", async () => {
  const extraction = await extractSyntheticFixture();

  assert.throws(
    () => prepareFinancialReviewPersistence(extraction, {
      ...identity,
      companyId: "00000000-0000-4000-8000-000000000999",
    }),
    (error: Error & { code?: string }) => error.code === "identity_mismatch",
  );
});

test("rejeita chaves lógicas duplicadas", async () => {
  const extraction = await extractSyntheticFixture();
  extraction.facts.push({ ...extraction.facts[0] });

  assert.throws(
    () => prepareFinancialReviewPersistence(extraction, identity),
    (error: Error & { code?: string }) => error.code === "duplicate_logical_key",
  );
});

test("rejeita chave lógica que não corresponde à célula de origem", async () => {
  const extraction = await extractSyntheticFixture();
  const canonicalFact = extraction.facts.find(
    (fact) => fact.includedInConsolidatedKpi,
  )!;
  canonicalFact.logicalKey = `${canonicalFact.logicalKey}:altered`;

  assert.throws(
    () => prepareFinancialReviewPersistence(extraction, identity),
    (error: Error & { code?: string }) => (
      error.code === "invalid_extraction_contract"
    ),
  );
});

test("bloqueia a RPC atual porque ela perderia fatos e chaves lógicas", async () => {
  const plan = prepareFinancialReviewPersistence(
    await extractSyntheticFixture(),
    identity,
  );

  assert.equal(plan.existingRpcCompatible, false);
  assert.deepEqual(plan.contractIssues, [
    "finance_complete_document rejeita linhas quando o status é needs_review",
    "financial_extracted_rows.metric não aceita net_result",
    "financial_extracted_rows.metric não aceita cash_available",
    "financial_extracted_rows não aceita net_result negativo",
    "financial_extracted_rows não preserva logical_key",
  ]);
  assert.throws(
    () => assertExistingFinancialExtractionRpcCompatible(plan),
    (error: Error & { code?: string }) => (
      error.code === "existing_rpc_contract_incompatible"
    ),
  );
});
