import type {
  FinancialExtractionV1,
} from "./financial-xlsx-adapter";
import type {
  FinancialFact,
} from "./kawana-xlsx-parser";

const supportedMetricCodes = [
  "revenue",
  "expense",
  "net_result",
  "cash_available",
] as const;

export type SupportedFinancialMetricCode = typeof supportedMetricCodes[number];

export interface ExpectedFinancialExtractionIdentity {
  companyId: string;
  documentId: string;
  sourceEtag: string;
}

export interface FinancialReviewPersistenceFact {
  logicalKey: string;
  companyId: string;
  companyName: string;
  documentId: string;
  sourceEtag: string;
  periodMonth: string;
  metricCode: SupportedFinancialMetricCode;
  amount: string;
  amountMinor: string;
  currency: "BRL";
  sheet: string;
  cellAddress: string;
  sourceRow: number;
  reviewStatus: "needs_review";
}

export interface DeferredFinancialFact {
  logicalKey: string;
  metricCode: string;
  reason: "not_canonical" | "outside_initial_scope";
}

export interface FinancialReviewPersistencePlan {
  schemaVersion: "financial-extraction.v1";
  status: "needs_review";
  publishable: false;
  identity: ExpectedFinancialExtractionIdentity & { companyName: string };
  facts: FinancialReviewPersistenceFact[];
  deferredFacts: DeferredFinancialFact[];
  deferredBankTransactionCount: number;
  existingRpcCompatible: false;
  v2RpcCompatible: true;
  targetContract: {
    version: "financial-extraction-persistence.v2";
    rpc: "finance_complete_document_v2";
  };
  contractIssues: string[];
}

export interface FinancialCompleteDocumentV2Row {
  logical_key: string;
  company_id: string;
  company_name: string;
  month: string;
  metric_code: SupportedFinancialMetricCode;
  amount: string;
  currency: "BRL";
  sheet: string;
  source_row: number;
  source_cell: string;
  review_status: "needs_review";
}

export interface FinancialCompleteDocumentV2Request {
  p_document_id: string;
  p_claim_id: string;
  p_source_etag: string;
  p_status: "needs_review";
  p_rows: FinancialCompleteDocumentV2Row[];
  p_note: string;
  p_excerpt: null;
}

export type FinancialReviewPersistenceErrorCode =
  | "invalid_extraction_contract"
  | "identity_mismatch"
  | "duplicate_logical_key"
  | "missing_required_canonical_fact"
  | "invalid_claim_id"
  | "existing_rpc_contract_incompatible";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function persistenceError(
  code: FinancialReviewPersistenceErrorCode,
  message: string,
) {
  const error = new Error(message) as Error & {
    code: FinancialReviewPersistenceErrorCode;
  };
  error.name = "FinancialReviewPersistenceError";
  error.code = code;
  return error;
}

function isSupportedMetricCode(
  metricCode: string,
): metricCode is SupportedFinancialMetricCode {
  return supportedMetricCodes.includes(
    metricCode as SupportedFinancialMetricCode,
  );
}

function sourceRow(cellAddress: string) {
  const match = cellAddress.match(/(\d+)$/);
  const row = match ? Number(match[1]) : 0;

  if (!Number.isSafeInteger(row) || row <= 0) {
    throw persistenceError(
      "invalid_extraction_contract",
      "A origem de um fato financeiro não possui uma linha válida.",
    );
  }

  return row;
}

function validateExtractionHeader(extraction: FinancialExtractionV1) {
  if (
    extraction.schemaVersion !== "financial-extraction.v1"
    || extraction.status !== "needs_review"
    || extraction.publishable !== false
  ) {
    throw persistenceError(
      "invalid_extraction_contract",
      "A resposta do parser não está bloqueada para revisão financeira.",
    );
  }
}

function validateExpectedIdentity(
  extraction: FinancialExtractionV1,
  expected: ExpectedFinancialExtractionIdentity,
) {
  const metadata = extraction.metadata;

  if (
    !uuidPattern.test(expected.companyId)
    || !uuidPattern.test(expected.documentId)
    || expected.sourceEtag.length < 1
    || expected.sourceEtag.length > 512
    || /[\u0000-\u001f\u007f]/.test(expected.sourceEtag)
    || metadata.company.id !== expected.companyId
    || metadata.document.id !== expected.documentId
    || metadata.document.etag !== expected.sourceEtag
  ) {
    throw persistenceError(
      "identity_mismatch",
      "A identidade da extração não corresponde ao documento autorizado.",
    );
  }

  for (const fact of extraction.facts) {
    if (
      fact.companyId !== expected.companyId
      || fact.documentId !== expected.documentId
      || fact.sourceEtag !== expected.sourceEtag
    ) {
      throw persistenceError(
        "identity_mismatch",
        "Um fato extraído não corresponde ao documento autorizado.",
      );
    }
  }
}

function decimalAmountMinor(amount: string) {
  const match = amount.match(/^(-?)(\d+)\.(\d{2})$/);

  if (!match) {
    throw persistenceError(
      "invalid_extraction_contract",
      "Um fato financeiro possui valor decimal inválido.",
    );
  }

  const absoluteMinor = BigInt(match[2]) * 100n + BigInt(match[3]);
  return (match[1] === "-" ? -absoluteMinor : absoluteMinor).toString();
}

function validateLogicalKeys(facts: FinancialFact[]) {
  const logicalKeys = new Set<string>();

  for (const fact of facts) {
    if (!fact.logicalKey.trim()) {
      throw persistenceError(
        "invalid_extraction_contract",
        "Um fato financeiro não possui chave lógica.",
      );
    }

    if (logicalKeys.has(fact.logicalKey)) {
      throw persistenceError(
        "duplicate_logical_key",
        "A extração contém uma chave lógica duplicada.",
      );
    }

    logicalKeys.add(fact.logicalKey);
  }
}

function isCanonicalInitialFact(fact: FinancialFact) {
  return fact.includedInConsolidatedKpi
    && fact.aggregationLevel === "canonical"
    && isSupportedMetricCode(fact.metricCode);
}

function mapFact(fact: FinancialFact): FinancialReviewPersistenceFact {
  if (!isSupportedMetricCode(fact.metricCode)) {
    throw persistenceError(
      "invalid_extraction_contract",
      "Um fato fora do escopo foi enviado para persistência.",
    );
  }

  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(fact.periodMonth)) {
    throw persistenceError(
      "invalid_extraction_contract",
      "Um fato financeiro possui competência inválida.",
    );
  }

  const expectedAmountMinor = decimalAmountMinor(fact.amount);

  if (
    !/^-?\d+$/.test(fact.amountMinor)
    || BigInt(fact.amountMinor).toString() !== expectedAmountMinor
  ) {
    throw persistenceError(
      "invalid_extraction_contract",
      "O valor financeiro diverge de sua representação em centavos.",
    );
  }

  if (fact.metricCode !== "net_result" && fact.amount.startsWith("-")) {
    throw persistenceError(
      "invalid_extraction_contract",
      "Somente o resultado líquido pode possuir valor negativo.",
    );
  }

  const companyName = fact.companyName.trim();
  const sheet = fact.evidence.sheet.trim();
  const cellAddress = fact.evidence.cellAddress;

  if (
    fact.currency !== "BRL"
    || fact.reviewStatus !== "needs_review"
    || fact.sourceScope !== "business"
    || !companyName
    || companyName.length > 200
    || !sheet
    || sheet.length > 120
    || /[\u0000-\u001f\u007f]/.test(sheet)
    || !/^[A-Z]{1,3}[1-9][0-9]*$/.test(cellAddress)
  ) {
    throw persistenceError(
      "invalid_extraction_contract",
      "Um fato canônico possui moeda, revisão ou proveniência inválida.",
    );
  }

  const expectedLogicalKey = [
    fact.documentId,
    fact.sourceEtag,
    sheet,
    cellAddress,
    fact.metricCode,
    fact.periodMonth,
  ].join(":");

  if (fact.logicalKey !== expectedLogicalKey) {
    throw persistenceError(
      "invalid_extraction_contract",
      "A chave lógica não corresponde à proveniência do fato.",
    );
  }

  return {
    logicalKey: fact.logicalKey,
    companyId: fact.companyId!,
    companyName,
    documentId: fact.documentId!,
    sourceEtag: fact.sourceEtag,
    periodMonth: fact.periodMonth,
    metricCode: fact.metricCode,
    amount: fact.amount,
    amountMinor: fact.amountMinor,
    currency: fact.currency,
    sheet,
    cellAddress,
    sourceRow: sourceRow(cellAddress),
    reviewStatus: "needs_review",
  };
}

function deferredFact(fact: FinancialFact): DeferredFinancialFact {
  return {
    logicalKey: fact.logicalKey,
    metricCode: fact.metricCode,
    reason: fact.aggregationLevel !== "canonical"
      || !fact.includedInConsolidatedKpi
      ? "not_canonical"
      : "outside_initial_scope",
  };
}

function validateRequiredFacts(facts: FinancialReviewPersistenceFact[]) {
  const availableMetrics = new Set(facts.map((fact) => fact.metricCode));
  const missingMetrics = supportedMetricCodes.filter(
    (metricCode) => !availableMetrics.has(metricCode),
  );

  if (missingMetrics.length > 0) {
    throw persistenceError(
      "missing_required_canonical_fact",
      `A extração não contém todos os fatos canônicos obrigatórios: ${missingMetrics.join(", ")}.`,
    );
  }
}

export function prepareFinancialReviewPersistence(
  extraction: FinancialExtractionV1,
  expected: ExpectedFinancialExtractionIdentity,
): FinancialReviewPersistencePlan {
  validateExtractionHeader(extraction);
  validateExpectedIdentity(extraction, expected);
  validateLogicalKeys(extraction.facts);

  const facts = extraction.facts
    .filter(isCanonicalInitialFact)
    .map(mapFact);

  validateRequiredFacts(facts);

  return {
    schemaVersion: extraction.schemaVersion,
    status: "needs_review",
    publishable: false,
    identity: {
      ...expected,
      companyName: extraction.metadata.company.name,
    },
    facts,
    deferredFacts: extraction.facts
      .filter((fact) => !isCanonicalInitialFact(fact))
      .map(deferredFact),
    deferredBankTransactionCount: extraction.bankTransactions.length,
    existingRpcCompatible: false,
    v2RpcCompatible: true,
    targetContract: {
      version: "financial-extraction-persistence.v2",
      rpc: "finance_complete_document_v2",
    },
    contractIssues: [
      "finance_complete_document rejeita linhas quando o status é needs_review",
      "financial_extracted_rows.metric não aceita net_result",
      "financial_extracted_rows.metric não aceita cash_available",
      "financial_extracted_rows não aceita net_result negativo",
      "financial_extracted_rows não preserva logical_key",
    ],
  };
}

export function createFinancialCompletionV2Request(
  plan: FinancialReviewPersistencePlan,
  claimId: string,
): FinancialCompleteDocumentV2Request {
  if (!uuidPattern.test(claimId)) {
    throw persistenceError(
      "invalid_claim_id",
      "O claim da extração financeira é inválido.",
    );
  }

  return {
    p_document_id: plan.identity.documentId,
    p_claim_id: claimId,
    p_source_etag: plan.identity.sourceEtag,
    p_status: "needs_review",
    p_rows: plan.facts.map((fact) => ({
      logical_key: fact.logicalKey,
      company_id: fact.companyId,
      company_name: fact.companyName,
      month: `${fact.periodMonth}-01`,
      metric_code: fact.metricCode,
      amount: fact.amount,
      currency: fact.currency,
      sheet: fact.sheet,
      source_row: fact.sourceRow,
      source_cell: fact.cellAddress,
      review_status: fact.reviewStatus,
    })),
    p_note: "financial-extraction.v1 canonical facts",
    p_excerpt: null,
  };
}

export function assertExistingFinancialExtractionRpcCompatible(
  plan: FinancialReviewPersistencePlan,
) {
  if (!plan.existingRpcCompatible) {
    throw persistenceError(
      "existing_rpc_contract_incompatible",
      "O contrato PostgreSQL atual não preserva os quatro fatos canônicos e suas chaves lógicas.",
    );
  }
}
