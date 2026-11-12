import ExcelJS, { type Cell, type Worksheet } from "exceljs";

export const KAWANA_PARSER_VERSION = "06A.1";
export const KAWANA_PARSER_V2_VERSION = "12A.2";

const expectedSheets = (year: number) => [
  "CAPA",
  "Resumo",
  `Fluxo de Caixa ${year}`,
  "ATIVO X PASSIVO KWN",
  "ATIVOS KWN",
  "PASSIVO KWN",
  "RECEITAS KWN",
  "DESPESAS KWN",
  "Itaú Kawana",
  "Bradesco Invest Fácil Kawana",
  "Bradesco Kawana",
  "Caixa Kawana",
] as const;

const EXPECTED_SHEETS = expectedSheets(2026);

const expectedConsolidatedSheets = (year: number) => [
  "CAPA",
  "RESUMO KWM",
  `Fluxo de Caixa ${year}`,
  "ATIVO X PASSIVO KWN",
  "ATIVOS KWN",
  "PASSIVO KWN",
  "RECEITAS X DESPESAS KWN",
  "RECEITAS KWN",
  "DESPESAS KWN",
  "Itaú Kawana",
  "Bradesco Invest Fácil Kawana",
  "Bradesco Kawana",
  "Caixa Kawana",
] as const;

const MONTH_COLUMNS = [
  ["C", 1], ["D", 2], ["E", 3], ["F", 4], ["G", 5],
  ["H", 6], ["I", 7], ["J", 8], ["K", 9],
] as const;

const EXPENSE_MONTH_COLUMNS = [
  ["D", 1], ["F", 2], ["H", 3], ["J", 4], ["L", 5],
  ["N", 6], ["P", 7], ["R", 8], ["T", 9],
] as const;

const ALL_MONTH_COLUMNS = [
  ...MONTH_COLUMNS,
  ["L", 10], ["M", 11], ["N", 12],
] as const;

const ALL_EXPENSE_MONTH_COLUMNS = [
  ...EXPENSE_MONTH_COLUMNS,
  ["V", 10], ["X", 11], ["Z", 12],
] as const;

type MonthColumn = readonly [string, number];

type ParserConfiguration = {
  parserVersion: string;
  requireExpectedPeriod: boolean;
  canonicalPeriodOnly: boolean;
  strictStructure: boolean;
  monthColumns: readonly MonthColumn[];
  expenseMonthColumns: readonly MonthColumn[];
};

const BANK_SHEETS = [
  "Itaú Kawana",
  "Bradesco Invest Fácil Kawana",
  "Bradesco Kawana",
  "Caixa Kawana",
] as const;

export type FactCategory = "realized" | "forecast" | "balance" | "equity";
export type ValidationSeverity = "info" | "warning" | "error";

export interface ParserContext {
  company: { id: string | null; name: string };
  document: {
    id: string | null;
    fileName: string;
    externalFileId?: string | null;
    etag: string;
  };
  expectedPeriod?: string;
  extractedAt?: string;
}

export interface FinancialFact {
  logicalKey: string;
  companyId: string | null;
  companyName: string;
  documentId: string | null;
  externalFileId: string | null;
  sourceEtag: string;
  periodMonth: string;
  metricCode: string;
  indicator: string;
  category: FactCategory;
  amount: string;
  amountMinor: string;
  currency: "BRL";
  sourceScope: "business" | "pending_review";
  accountingBasis: "cash" | "unspecified";
  includedInConsolidatedKpi: boolean;
  aggregationLevel: "canonical" | "component" | "supporting_detail";
  originalSign: "positive" | "negative" | "zero";
  canonicalSign: "positive" | "negative" | "zero";
  reviewStatus: "needs_review";
  evidence: {
    sheet: string;
    cellAddress: string;
    sourceValue: string;
    formula: string | null;
  };
}

export interface BankTransaction {
  logicalKey: string;
  companyId: string | null;
  documentId: string | null;
  sourceEtag: string;
  sheet: string;
  row: number;
  date: string | null;
  periodMonth: string | null;
  description: string | null;
  category: string | null;
  direction: "credit" | "debit";
  amount: string;
  amountMinor: string;
  currency: "BRL";
  sourceScope: "pending_review";
  includedInConsolidatedKpi: false;
  reviewStatus: "needs_review";
  evidence: { amountCell: string; balanceCell: string };
}

export interface ValidationWarning {
  code: string;
  severity: ValidationSeverity;
  message: string;
  sources: string[];
}

export interface Reconciliation {
  code: string;
  status: "passed" | "failed" | "unavailable";
  differenceMinor: string | null;
  sources: string[];
}

export interface KawanaParseResult {
  schemaVersion: "financial-extraction.v1";
  parserVersion: string;
  status: "needs_review";
  publishable: false;
  metadata: {
    company: ParserContext["company"];
    document: ParserContext["document"];
    periodMonth: string;
    currency: "BRL";
    extractedAt: string;
    sheetCount: number;
    sheets: string[];
  };
  facts: FinancialFact[];
  bankTransactions: BankTransaction[];
  reconciliations: Reconciliation[];
  warnings: ValidationWarning[];
  statistics: {
    factCount: number;
    bankTransactionCount: number;
    formulaErrorCount: number;
    duplicateFactCount: number;
  };
}

type CellReading = {
  kind: "blank" | "number" | "date" | "text" | "error" | "unsupported";
  value: number | Date | string | null;
  sourceValue: string;
  formula: string | null;
};

type FactInput = {
  periodMonth: string;
  metricCode: string;
  indicator: string;
  category: FactCategory;
  sourceScope: "business" | "pending_review";
  accountingBasis: "cash" | "unspecified";
  includedInConsolidatedKpi: boolean;
  aggregationLevel: "canonical" | "component" | "supporting_detail";
  canonicalTransform?: (value: number) => number;
};

function normalizeSheetName(name: string) {
  return name.trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");
}

function findSheet(workbook: ExcelJS.Workbook, expectedName: string) {
  const normalized = normalizeSheetName(expectedName);
  return workbook.worksheets.find(
    (worksheet) => normalizeSheetName(worksheet.name) === normalized,
  );
}

function readCell(cell: Cell): CellReading {
  const value = cell.value;
  if (value === null || value === undefined || value === "") {
    return { kind: "blank", value: null, sourceValue: "", formula: null };
  }

  if (typeof value === "object" && "formula" in value) {
    const formula = String(value.formula);
    const result = value.result;
    if (result === null || result === undefined || result === "") {
      return { kind: "blank", value: null, sourceValue: "", formula };
    }
    if (typeof result === "object" && result && "error" in result) {
      const error = String(result.error);
      return { kind: "error", value: error, sourceValue: error, formula };
    }
    if (result instanceof Date) {
      return { kind: "date", value: result, sourceValue: result.toISOString(), formula };
    }
    if (typeof result === "number") {
      return { kind: "number", value: result, sourceValue: String(result), formula };
    }
    return { kind: "text", value: String(result), sourceValue: String(result), formula };
  }

  if (typeof value === "object" && "error" in value) {
    const error = String(value.error);
    return { kind: "error", value: error, sourceValue: error, formula: null };
  }
  if (value instanceof Date) {
    return { kind: "date", value, sourceValue: value.toISOString(), formula: null };
  }
  if (typeof value === "number") {
    return { kind: "number", value, sourceValue: String(value), formula: null };
  }
  if (typeof value === "string") {
    return { kind: "text", value, sourceValue: value, formula: null };
  }
  if (typeof value === "object" && "richText" in value) {
    const text = value.richText.map((part) => part.text).join("");
    return { kind: "text", value: text, sourceValue: text, formula: null };
  }
  return { kind: "unsupported", value: null, sourceValue: "", formula: null };
}

function parseLocalizedNumber(value: string) {
  const trimmed = value.trim().replace(/\s/g, "");
  if (!trimmed) return null;
  const normalized = trimmed.includes(",")
    ? trimmed.replace(/\./g, "").replace(",", ".")
    : trimmed;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function readNumericCell(cell: Cell) {
  const reading = readCell(cell);
  if (reading.kind === "number") return { value: reading.value as number, reading };
  if (reading.kind !== "text") return null;
  const parsed = parseLocalizedNumber(reading.value as string);
  return parsed === null ? null : { value: parsed, reading };
}

function toMinorUnits(value: number) {
  return Math.round((value + Math.sign(value) * Number.EPSILON) * 100);
}

function money(value: number) {
  const minor = toMinorUnits(value);
  const sign = minor < 0 ? "-" : "";
  const absolute = Math.abs(minor);
  return {
    amount: `${sign}${Math.floor(absolute / 100)}.${String(absolute % 100).padStart(2, "0")}`,
    amountMinor: String(minor),
    currency: "BRL" as const,
  };
}

function signOf(value: number): "positive" | "negative" | "zero" {
  return value > 0 ? "positive" : value < 0 ? "negative" : "zero";
}

function monthPeriod(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function slug(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 80);
}

function cellText(worksheet: Worksheet, address: string) {
  const reading = readCell(worksheet.getCell(address));
  return reading.kind === "text" ? String(reading.value).trim() : "";
}

function detectReportPeriod(workbook: ExcelJS.Workbook) {
  const candidates = [
    ["Resumo", "A1"],
    ["RESUMO KWM", "A2"],
  ] as const;
  for (const [sheetName, address] of candidates) {
    const summary = findSheet(workbook, sheetName);
    if (!summary) continue;
    const dates = [...cellText(summary, address).matchAll(/(\d{2})\/(\d{2})\/(\d{4})/g)];
    const lastDate = dates.at(-1);
    if (lastDate) return monthPeriod(Number(lastDate[3]), Number(lastDate[2]));
  }
  return null;
}

function periodFromValue(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) {
    return monthPeriod(value.getUTCFullYear(), value.getUTCMonth() + 1);
  }
  if (typeof value !== "string") return null;
  const iso = value.match(/^(\d{4})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}`;
  const br = value.match(/(?:^|\D)(\d{1,2})\/(\d{4})(?:\D|$)/);
  return br ? monthPeriod(Number(br[2]), Number(br[1])) : null;
}

function addCellFact(
  facts: FinancialFact[],
  seenKeys: Set<string>,
  context: ParserContext,
  worksheet: Worksheet,
  address: string,
  input: FactInput,
) {
  const parsed = readNumericCell(worksheet.getCell(address));
  if (!parsed) return false;
  const canonicalValue = input.canonicalTransform?.(parsed.value) ?? parsed.value;
  const logicalKey = [context.document.id ?? "local", context.document.etag,
    worksheet.name.trim(), address, input.metricCode, input.periodMonth].join(":");
  if (seenKeys.has(logicalKey)) return false;
  seenKeys.add(logicalKey);
  facts.push({
    logicalKey,
    companyId: context.company.id,
    companyName: context.company.name,
    documentId: context.document.id,
    externalFileId: context.document.externalFileId ?? null,
    sourceEtag: context.document.etag,
    periodMonth: input.periodMonth,
    metricCode: input.metricCode,
    indicator: input.indicator,
    category: input.category,
    ...money(canonicalValue),
    sourceScope: input.sourceScope,
    accountingBasis: input.accountingBasis,
    includedInConsolidatedKpi: input.includedInConsolidatedKpi,
    aggregationLevel: input.aggregationLevel,
    originalSign: signOf(parsed.value),
    canonicalSign: signOf(canonicalValue),
    reviewStatus: "needs_review",
    evidence: {
      sheet: worksheet.name,
      cellAddress: address,
      sourceValue: parsed.reading.sourceValue,
      formula: parsed.reading.formula,
    },
  });
  return true;
}

function requireCellText(worksheet: Worksheet, address: string, expected: string) {
  if (normalizeSheetName(cellText(worksheet, address)) !== normalizeSheetName(expected)) {
    throw new Error(`A origem ${worksheet.name.trim()}!${address} não possui o rótulo esperado.`);
  }
}

function requireCellFact(
  facts: FinancialFact[],
  seenKeys: Set<string>,
  context: ParserContext,
  worksheet: Worksheet,
  address: string,
  input: FactInput,
) {
  if (!readNumericCell(worksheet.getCell(address))) {
    throw new Error(`A origem ${worksheet.name.trim()}!${address} não possui valor numérico.`);
  }
  if (!addCellFact(facts, seenKeys, context, worksheet, address, input)) {
    throw new Error(`A origem ${worksheet.name.trim()}!${address} foi extraída mais de uma vez.`);
  }
}

function parseConsolidatedCanonicalFacts(
  summary: Worksheet,
  combined: Worksheet,
  context: ParserContext,
  facts: FinancialFact[],
  seen: Set<string>,
) {
  requireCellText(summary, "A10", "TOTAL");
  requireCellText(combined, "A6", "Resultado");
  requireCellText(combined, "A8", "Despesa");
  requireCellText(combined, "A23", "Receita");

  const expense = readNumericCell(combined.getCell("B8"));
  if (!expense || expense.value >= 0) {
    throw new Error("A despesa consolidada deve possuir sinal original negativo.");
  }

  const periodMonth = context.expectedPeriod!;
  requireCellFact(facts, seen, context, summary, "B10", {
    periodMonth, metricCode: "cash_available", indicator: "Disponibilidade",
    category: "balance", sourceScope: "business", accountingBasis: "cash",
    includedInConsolidatedKpi: true, aggregationLevel: "canonical",
  });
  requireCellFact(facts, seen, context, combined, "B23", {
    periodMonth, metricCode: "revenue", indicator: "Receitas realizadas",
    category: "realized", sourceScope: "business", accountingBasis: "unspecified",
    includedInConsolidatedKpi: true, aggregationLevel: "canonical",
  });
  requireCellFact(facts, seen, context, combined, "B8", {
    periodMonth, metricCode: "expense", indicator: "Despesas realizadas",
    category: "realized", sourceScope: "business", accountingBasis: "unspecified",
    includedInConsolidatedKpi: true, aggregationLevel: "canonical", canonicalTransform: Math.abs,
  });
  requireCellFact(facts, seen, context, combined, "B6", {
    periodMonth, metricCode: "net_result", indicator: "Resultado realizado",
    category: "realized", sourceScope: "business", accountingBasis: "unspecified",
    includedInConsolidatedKpi: true, aggregationLevel: "canonical",
  });

  for (let row = 5; row <= 8; row += 1) {
    const label = cellText(summary, `A${row}`) || `Conta ${row - 4}`;
    requireCellFact(facts, seen, context, summary, `B${row}`, {
      periodMonth, metricCode: `bank_balance_${slug(label)}`, indicator: `Saldo bancário: ${label}`,
      category: "balance", sourceScope: "pending_review", accountingBasis: "cash",
      includedInConsolidatedKpi: false, aggregationLevel: "component",
    });
  }
}

function parseSinglePeriodDetails(
  worksheet: Worksheet,
  context: ParserContext,
  facts: FinancialFact[],
  seen: Set<string>,
  kind: "revenue" | "expense",
) {
  for (let row = 7; row <= worksheet.rowCount; row += 1) {
    const label = cellText(worksheet, `A${row}`);
    if (!label || !readNumericCell(worksheet.getCell(`B${row}`))) continue;
    addCellFact(facts, seen, context, worksheet, `B${row}`, {
      periodMonth: context.expectedPeriod!, metricCode: `${kind}_detail_${slug(label)}_${row}`,
      indicator: label, category: "realized", sourceScope: "pending_review",
      accountingBasis: "unspecified", includedInConsolidatedKpi: false,
      aggregationLevel: "supporting_detail", canonicalTransform: kind === "expense" ? Math.abs : undefined,
    });
  }
}

function parseSinglePeriodEquity(
  worksheet: Worksheet,
  context: ParserContext,
  facts: FinancialFact[],
  seen: Set<string>,
  kind: "asset" | "liability",
) {
  for (let row = 4; row <= worksheet.rowCount; row += 1) {
    const label = cellText(worksheet, `A${row}`);
    if (!label || !readNumericCell(worksheet.getCell(`B${row}`))) continue;
    addCellFact(facts, seen, context, worksheet, `B${row}`, {
      periodMonth: context.expectedPeriod!,
      metricCode: `${kind}_${row === 4 ? "total" : "detail"}_${slug(label)}_${row}`,
      indicator: label, category: "equity", sourceScope: "pending_review",
      accountingBasis: "unspecified", includedInConsolidatedKpi: false,
      aggregationLevel: "supporting_detail",
    });
  }
}

function parseSummary(
  ws: Worksheet,
  context: ParserContext,
  facts: FinancialFact[],
  seen: Set<string>,
  configuration: ParserConfiguration,
) {
  const year = Number(context.expectedPeriod?.slice(0, 4) ?? "2026");
  const rows = [
    [85, "revenue", "Receitas realizadas"],
    [68, "expense", "Despesas realizadas"],
    [66, "net_result", "Resultado realizado"],
  ] as const;
  for (const [row, code, indicator] of rows) {
    for (const [column, month] of configuration.monthColumns) {
      const periodMonth = monthPeriod(year, month);
      const isRequestedPeriod = !configuration.canonicalPeriodOnly
        || periodMonth === context.expectedPeriod;
      addCellFact(facts, seen, context, ws, `${column}${row}`, {
        periodMonth, metricCode: code, indicator,
        category: "realized",
        sourceScope: isRequestedPeriod ? "business" : "pending_review",
        accountingBasis: "unspecified",
        includedInConsolidatedKpi: isRequestedPeriod,
        aggregationLevel: isRequestedPeriod ? "canonical" : "supporting_detail",
      });
    }
  }
  const periodMonth = context.expectedPeriod ?? monthPeriod(year, 9);
  addCellFact(facts, seen, context, ws, "B4", {
    periodMonth, metricCode: "cash_available", indicator: "Disponibilidade",
    category: "balance", sourceScope: "business", accountingBasis: "cash",
    includedInConsolidatedKpi: true, aggregationLevel: "canonical",
  });
  for (let row = 5; row <= 8; row += 1) {
    const label = cellText(ws, `A${row}`) || `Conta ${row - 4}`;
    addCellFact(facts, seen, context, ws, `B${row}`, {
      periodMonth, metricCode: `bank_balance_${slug(label)}`, indicator: `Saldo bancário: ${label}`,
      category: "balance", sourceScope: "business", accountingBasis: "cash",
      includedInConsolidatedKpi: false, aggregationLevel: "component",
    });
  }
}

function parseRevenueDetails(
  ws: Worksheet,
  context: ParserContext,
  facts: FinancialFact[],
  seen: Set<string>,
  monthColumns: readonly MonthColumn[],
) {
  const year = Number(context.expectedPeriod?.slice(0, 4) ?? "2026");
  for (let row = 7; row <= 9; row += 1) {
    const label = cellText(ws, `A${row}`);
    if (!label) continue;
    for (const [column, month] of monthColumns) {
      addCellFact(facts, seen, context, ws, `${column}${row}`, {
        periodMonth: monthPeriod(year, month), metricCode: `revenue_detail_${slug(label)}_${row}`,
        indicator: label, category: "realized", sourceScope: "pending_review",
        accountingBasis: "unspecified", includedInConsolidatedKpi: false,
        aggregationLevel: "supporting_detail",
      });
    }
  }
}

function parseExpenseDetails(
  ws: Worksheet,
  context: ParserContext,
  facts: FinancialFact[],
  seen: Set<string>,
  monthColumns: readonly MonthColumn[],
) {
  const year = Number(context.expectedPeriod?.slice(0, 4) ?? "2026");
  for (let row = 6; row <= 107; row += 1) {
    const label = cellText(ws, `A${row}`);
    if (!label) continue;
    for (const [column, month] of monthColumns) {
      addCellFact(facts, seen, context, ws, `${column}${row}`, {
        periodMonth: monthPeriod(year, month), metricCode: `expense_detail_${slug(label)}_${row}`,
        indicator: label, category: "realized", sourceScope: "pending_review",
        accountingBasis: "unspecified", includedInConsolidatedKpi: false,
        aggregationLevel: "supporting_detail", canonicalTransform: Math.abs,
      });
    }
  }
}

function parseCashFlow(ws: Worksheet, context: ParserContext, facts: FinancialFact[], seen: Set<string>) {
  const declaredPeriod = context.expectedPeriod ?? "2026-09";
  const rows = [
    [10, "cash_flow_balance", "Saldo do fluxo de caixa", "balance"],
    [12, "cash_flow_change", "Variação do fluxo de caixa", "realized"],
    [14, "cash_flow_expense", "Despesas do fluxo de caixa", "realized"],
    [32, "cash_flow_revenue", "Receitas do fluxo de caixa", "realized"],
  ] as const;
  for (const column of ["C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N"]) {
    const periodMonth = periodFromValue(readCell(ws.getCell(`${column}8`)).value);
    if (!periodMonth) continue;
    for (const [row, code, indicator, category] of rows) {
      addCellFact(facts, seen, context, ws, `${column}${row}`, {
        periodMonth, metricCode: code, indicator,
        category: periodMonth > declaredPeriod ? "forecast" : category,
        sourceScope: "pending_review", accountingBasis: "cash",
        includedInConsolidatedKpi: false, aggregationLevel: "supporting_detail",
      });
    }
  }
}

function parseEquitySummary(
  ws: Worksheet,
  context: ParserContext,
  facts: FinancialFact[],
  seen: Set<string>,
  monthColumns: readonly MonthColumn[],
) {
  const year = Number(context.expectedPeriod?.slice(0, 4) ?? "2026");
  for (const [row, code] of [[6, "equity_result"], [8, "asset_total"], [10, "liability_total"]] as const) {
    const indicator = cellText(ws, `A${row}`) || code;
    for (const [column, month] of monthColumns) {
      addCellFact(facts, seen, context, ws, `${column}${row}`, {
        periodMonth: monthPeriod(year, month), metricCode: code, indicator,
        category: "equity", sourceScope: "pending_review", accountingBasis: "unspecified",
        includedInConsolidatedKpi: false, aggregationLevel: "canonical",
      });
    }
  }
}

function parseEquityDetails(
  ws: Worksheet, context: ParserContext, facts: FinancialFact[], seen: Set<string>,
  kind: "asset" | "liability", monthColumns: readonly MonthColumn[],
) {
  const year = Number(context.expectedPeriod?.slice(0, 4) ?? "2026");
  for (let row = 4; row <= ws.rowCount; row += 1) {
    const label = cellText(ws, `A${row}`);
    if (!label) continue;
    for (const [column, month] of monthColumns) {
      addCellFact(facts, seen, context, ws, `${column}${row}`, {
        periodMonth: monthPeriod(year, month),
        metricCode: `${kind}_${row === 4 ? "total" : "detail"}_${slug(label)}_${row}`,
        indicator: label, category: "equity", sourceScope: "pending_review",
        accountingBasis: "unspecified", includedInConsolidatedKpi: false,
        aggregationLevel: row === 4 ? "canonical" : "supporting_detail",
      });
    }
  }
}

function parseDate(cell: Cell) {
  const reading = readCell(cell);
  if (reading.kind === "date") return (reading.value as Date).toISOString().slice(0, 10);
  return reading.kind === "text" ? String(reading.value).trim() || null : null;
}

function parseBankSheet(
  ws: Worksheet, context: ParserContext, transactions: BankTransaction[],
  facts: FinancialFact[], seen: Set<string>,
) {
  let finalBalanceRow: number | null = null;
  for (let row = 4; row <= ws.rowCount; row += 1) {
    const credit = readNumericCell(ws.getCell(`H${row}`));
    const debit = readNumericCell(ws.getCell(`I${row}`));
    if (readNumericCell(ws.getCell(`J${row}`))) finalBalanceRow = row;
    const source = credit?.value ? credit : debit?.value ? debit : null;
    if (!source) continue;
    const direction = credit?.value ? "credit" : "debit";
    const date = parseDate(ws.getCell(`A${row}`));
    const competence = readCell(ws.getCell(`D${row}`));
    transactions.push({
      logicalKey: [context.document.id ?? "local", context.document.etag, ws.name.trim(), row, direction].join(":"),
      companyId: context.company.id, documentId: context.document.id, sourceEtag: context.document.etag,
      sheet: ws.name, row, date,
      periodMonth: periodFromValue(competence.value) ?? periodFromValue(date),
      description: cellText(ws, `C${row}`) || null,
      category: cellText(ws, `G${row}`) || null,
      direction, ...money(Math.abs(source.value)), sourceScope: "pending_review",
      includedInConsolidatedKpi: false, reviewStatus: "needs_review",
      evidence: { amountCell: `${direction === "credit" ? "H" : "I"}${row}`, balanceCell: `J${row}` },
    });
  }
  if (finalBalanceRow !== null) {
    addCellFact(facts, seen, context, ws, `J${finalBalanceRow}`, {
      periodMonth: context.expectedPeriod ?? "2026-09",
      metricCode: `bank_statement_final_balance_${slug(ws.name)}`,
      indicator: `Saldo final: ${ws.name.trim()}`, category: "balance",
      sourceScope: "pending_review", accountingBasis: "cash",
      includedInConsolidatedKpi: false, aggregationLevel: "supporting_detail",
    });
  }
}

function scanCellWarnings(workbook: ExcelJS.Workbook) {
  const errors: string[] = [];
  const missingFormulaResults: string[] = [];
  for (const ws of workbook.worksheets) {
    ws.eachRow({ includeEmpty: false }, (row) => row.eachCell({ includeEmpty: false }, (cell) => {
      const reading = readCell(cell);
      if (reading.kind === "error") errors.push(`${ws.name}!${cell.address}:${reading.sourceValue}`);
      if (reading.formula && reading.kind === "blank") missingFormulaResults.push(`${ws.name}!${cell.address}`);
    }));
  }
  return { errors, missingFormulaResults };
}

function getFactMinor(facts: FinancialFact[], sheet: string, address: string) {
  const fact = facts.find((item) => normalizeSheetName(item.evidence.sheet) === normalizeSheetName(sheet)
    && item.evidence.cellAddress === address);
  return fact ? Number(fact.amountMinor) : null;
}

function reconciliation(code: string, left: number | null, right: number | null, sources: string[]): Reconciliation {
  if (left === null || right === null) return { code, status: "unavailable", differenceMinor: null, sources };
  const difference = left - right;
  return { code, status: Math.abs(difference) <= 1 ? "passed" : "failed", differenceMinor: String(difference), sources };
}

function buildLegacyReconciliations(
  facts: FinancialFact[],
  summaryColumn: string,
  expenseColumn: string,
  cashFlowSheet: string,
) {
  const revenueAddress = `${summaryColumn}85`;
  const expenseAddress = `${summaryColumn}68`;
  const resultAddress = `${summaryColumn}66`;
  const revenue = getFactMinor(facts, "Resumo", revenueAddress);
  const expense = getFactMinor(facts, "Resumo", expenseAddress);
  const result = getFactMinor(facts, "Resumo", resultAddress);
  const cash = getFactMinor(facts, "Resumo", "B4");
  const sum = (values: Array<number | null>, size: number) => values.length === size
    && values.every((value): value is number => value !== null) ? values.reduce((total, value) => total + value, 0) : null;
  const bankComponents = ["B5", "B6", "B7", "B8"].map((address) => getFactMinor(facts, "Resumo", address));
  const bankStatements = facts.filter((fact) => fact.metricCode.startsWith("bank_statement_final_balance_"))
    .map((fact) => Number(fact.amountMinor));
  return [
    reconciliation("summary_result_equals_revenue_minus_expense", revenue !== null && expense !== null ? revenue - expense : null,
      result, [`Resumo!${revenueAddress}`, `Resumo!${expenseAddress}`, `Resumo!${resultAddress}`]),
    reconciliation("revenue_detail_matches_summary", getFactMinor(facts, "RECEITAS KWN", `${summaryColumn}4`), revenue,
      [`RECEITAS KWN!${summaryColumn}4`, `Resumo!${revenueAddress}`]),
    reconciliation("expense_detail_matches_summary", getFactMinor(facts, "DESPESAS KWN", `${expenseColumn}4`), expense,
      [`DESPESAS KWN!${expenseColumn}4`, `Resumo!${expenseAddress}`]),
    reconciliation("cash_flow_balance_matches_summary", getFactMinor(facts, cashFlowSheet, `${summaryColumn}10`), cash,
      [`${cashFlowSheet}!${summaryColumn}10`, "Resumo!B4"]),
    reconciliation("summary_bank_components_match_total", sum(bankComponents, 4), cash, ["Resumo!B5:B8", "Resumo!B4"]),
    reconciliation("bank_statement_balances_match_summary", sum(bankStatements, 4), cash,
      ["quatro abas bancárias!saldo final", "Resumo!B4"]),
  ];
}

function buildConsolidatedReconciliations(facts: FinancialFact[]) {
  const revenue = getFactMinor(facts, "RECEITAS X DESPESAS KWN", "B23");
  const expense = getFactMinor(facts, "RECEITAS X DESPESAS KWN", "B8");
  const result = getFactMinor(facts, "RECEITAS X DESPESAS KWN", "B6");
  const cash = getFactMinor(facts, "RESUMO KWM", "B10");
  const sum = (values: Array<number | null>, size: number) => values.length === size
    && values.every((value): value is number => value !== null)
    ? values.reduce((total, value) => total + value, 0)
    : null;
  const bankComponents = ["B5", "B6", "B7", "B8"]
    .map((address) => getFactMinor(facts, "RESUMO KWM", address));
  const bankStatements = facts
    .filter((fact) => fact.metricCode.startsWith("bank_statement_final_balance_"))
    .map((fact) => Number(fact.amountMinor));

  return [
    reconciliation(
      "combined_result_equals_revenue_minus_expense",
      revenue !== null && expense !== null ? revenue - expense : null,
      result,
      [
        "RECEITAS X DESPESAS KWN!B23",
        "RECEITAS X DESPESAS KWN!B8",
        "RECEITAS X DESPESAS KWN!B6",
      ],
    ),
    reconciliation(
      "revenue_detail_matches_combined",
      getFactMinor(facts, "RECEITAS KWN", "B6"),
      revenue,
      ["RECEITAS KWN!B6", "RECEITAS X DESPESAS KWN!B23"],
    ),
    reconciliation(
      "expense_detail_matches_combined",
      getFactMinor(facts, "DESPESAS KWN", "B6"),
      expense,
      ["DESPESAS KWN!B6", "RECEITAS X DESPESAS KWN!B8"],
    ),
    reconciliation(
      "summary_bank_components_match_total",
      sum(bankComponents, 4),
      cash,
      ["RESUMO KWM!B5:B8", "RESUMO KWM!B10"],
    ),
    reconciliation(
      "bank_statement_balances_match_summary",
      sum(bankStatements, 4),
      cash,
      ["quatro abas bancárias!saldo final", "RESUMO KWM!B10"],
    ),
  ];
}

function validateCanonicalFacts(facts: FinancialFact[], periodMonth: string) {
  const expectedMetrics = ["revenue", "expense", "net_result", "cash_available"];
  const canonical = facts.filter((fact) => fact.includedInConsolidatedKpi
    && fact.aggregationLevel === "canonical"
    && fact.periodMonth === periodMonth);
  const counts = new Map<string, number>();
  canonical.forEach((fact) => counts.set(fact.metricCode, (counts.get(fact.metricCode) ?? 0) + 1));
  if (canonical.length !== expectedMetrics.length
    || expectedMetrics.some((metric) => counts.get(metric) !== 1)) {
    throw new Error("O mapping v2 deve produzir exatamente quatro métricas canônicas distintas.");
  }
}

async function parseKawanaWorkbookConfigured(
  input: Buffer | Uint8Array | ArrayBuffer,
  context: ParserContext,
  configuration: ParserConfiguration,
): Promise<KawanaParseResult> {
  const workbook = new ExcelJS.Workbook();
  const workbookBuffer = input instanceof ArrayBuffer
    ? input
    : Uint8Array.from(input).buffer;
  await workbook.xlsx.load(workbookBuffer);
  if (configuration.requireExpectedPeriod && !context.expectedPeriod) {
    throw new Error("A competencia e obrigatoria para o mapping v2.");
  }
  const detectedPeriod = detectReportPeriod(workbook);
  if (
    configuration.requireExpectedPeriod
    && detectedPeriod !== context.expectedPeriod
  ) {
    throw new Error("A competencia declarada no XLSX diverge da competencia autorizada.");
  }
  const parserContext = {
    ...context,
    expectedPeriod: context.expectedPeriod ?? detectedPeriod ?? "2026-09",
  };
  const requestedYear = Number(parserContext.expectedPeriod.slice(0, 4));
  const requestedMonth = Number(parserContext.expectedPeriod.slice(5, 7));
  const extractionMonth = configuration.requireExpectedPeriod ? requestedMonth : 9;
  const requestedMonthColumn = configuration.monthColumns.find(
    ([, month]) => month === extractionMonth,
  )?.[0];
  const requestedExpenseColumn = configuration.expenseMonthColumns.find(
    ([, month]) => month === extractionMonth,
  )?.[0];
  if (!Number.isSafeInteger(requestedYear) || !requestedMonthColumn || !requestedExpenseColumn) {
    throw new Error("A competencia nao possui colunas configuradas no mapping.");
  }
  const cashFlowSheetName = configuration.requireExpectedPeriod
    ? `Fluxo de Caixa ${requestedYear}`
    : "Fluxo de Caixa 2026";
  const consolidatedLayout = configuration.requireExpectedPeriod
    && (findSheet(workbook, "RESUMO KWM") !== undefined
      || findSheet(workbook, "RECEITAS X DESPESAS KWN") !== undefined);
  const requiredSheets = consolidatedLayout
    ? expectedConsolidatedSheets(requestedYear)
    : configuration.requireExpectedPeriod
      ? expectedSheets(requestedYear)
      : EXPECTED_SHEETS;
  const facts: FinancialFact[] = [];
  const bankTransactions: BankTransaction[] = [];
  const warnings: ValidationWarning[] = [];
  const seen = new Set<string>();
  let duplicateFactCount = 0;
  const addTotal = (ws: Worksheet, address: string, input: FactInput) => {
    if (!addCellFact(facts, seen, parserContext, ws, address, input)) duplicateFactCount += 1;
  };

  const missing = requiredSheets.filter((name) => !findSheet(workbook, name));
  const unexpected = workbook.worksheets.filter((ws) => !requiredSheets.some((name) =>
    normalizeSheetName(name) === normalizeSheetName(ws.name))).map((ws) => ws.name);
  const normalizedSheetNames = workbook.worksheets.map((ws) => normalizeSheetName(ws.name));
  const duplicateSheetNames = normalizedSheetNames.filter(
    (name, index) => normalizedSheetNames.indexOf(name) !== index,
  );
  const invalidStructure = workbook.worksheets.length !== requiredSheets.length
    || missing.length > 0
    || unexpected.length > 0
    || duplicateSheetNames.length > 0;
  if (configuration.strictStructure && invalidStructure) {
    throw new Error("A estrutura de abas do XLSX não corresponde ao mapping v2 autorizado.");
  }
  if (invalidStructure) {
    warnings.push({ code: "unexpected_sheet_structure", severity: "error",
      message: `Esperadas ${requiredSheets.length} abas; encontradas ${workbook.worksheets.length}.`,
      sources: [
        ...missing.map((name) => `ausente:${name}`),
        ...unexpected.map((name) => `inesperada:${name}`),
        ...duplicateSheetNames.map((name) => `duplicada:${name}`),
      ] });
  }

  const summary = findSheet(workbook, consolidatedLayout ? "RESUMO KWM" : "Resumo");
  const combined = findSheet(workbook, "RECEITAS X DESPESAS KWN");
  if (consolidatedLayout) {
    parseConsolidatedCanonicalFacts(summary!, combined!, parserContext, facts, seen);
  } else if (summary) {
    parseSummary(summary, parserContext, facts, seen, configuration);
  }
  const revenue = findSheet(workbook, "RECEITAS KWN");
  if (revenue) {
    if (consolidatedLayout) {
      parseSinglePeriodDetails(revenue, parserContext, facts, seen, "revenue");
    } else {
      parseRevenueDetails(revenue, parserContext, facts, seen, configuration.monthColumns);
    }
    addTotal(revenue, consolidatedLayout ? "B6" : `${requestedMonthColumn}4`, { periodMonth: parserContext.expectedPeriod,
      metricCode: "revenue_reconciliation_total", indicator: "Total de receitas para conciliação",
      category: "realized", sourceScope: "pending_review", accountingBasis: "unspecified",
      includedInConsolidatedKpi: false, aggregationLevel: "supporting_detail" });
  }
  const expense = findSheet(workbook, "DESPESAS KWN");
  if (expense) {
    if (consolidatedLayout) {
      parseSinglePeriodDetails(expense, parserContext, facts, seen, "expense");
    } else {
      parseExpenseDetails(expense, parserContext, facts, seen, configuration.expenseMonthColumns);
    }
    addTotal(expense, consolidatedLayout ? "B6" : `${requestedExpenseColumn}4`, { periodMonth: parserContext.expectedPeriod,
      metricCode: "expense_reconciliation_total", indicator: "Total de despesas para conciliação",
      category: "realized", sourceScope: "pending_review", accountingBasis: "unspecified",
      includedInConsolidatedKpi: false, aggregationLevel: "supporting_detail", canonicalTransform: Math.abs });
  }
  const cashFlow = findSheet(workbook, cashFlowSheetName);
  if (cashFlow) parseCashFlow(cashFlow, parserContext, facts, seen);
  const equity = findSheet(workbook, "ATIVO X PASSIVO KWN");
  if (equity) {
    if (consolidatedLayout) {
      parseSinglePeriodEquity(equity, parserContext, facts, seen, "asset");
    } else {
      parseEquitySummary(equity, parserContext, facts, seen, configuration.monthColumns);
    }
  }
  const assets = findSheet(workbook, "ATIVOS KWN");
  if (assets) {
    if (consolidatedLayout) {
      parseSinglePeriodEquity(assets, parserContext, facts, seen, "asset");
    } else {
      parseEquityDetails(assets, parserContext, facts, seen, "asset", configuration.monthColumns);
    }
  }
  const liabilities = findSheet(workbook, "PASSIVO KWN");
  if (liabilities) {
    if (consolidatedLayout) {
      parseSinglePeriodEquity(liabilities, parserContext, facts, seen, "liability");
    } else {
      parseEquityDetails(
        liabilities,
        parserContext,
        facts,
        seen,
        "liability",
        configuration.monthColumns,
      );
    }
  }
  for (const name of BANK_SHEETS) {
    const ws = findSheet(workbook, name);
    if (ws) parseBankSheet(ws, parserContext, bankTransactions, facts, seen);
  }

  const cellWarnings = scanCellWarnings(workbook);
  if (cellWarnings.errors.length) warnings.push({ code: "spreadsheet_formula_errors", severity: "error",
    message: `${cellWarnings.errors.length} célula(s) com erro impedem o uso automático das linhas afetadas.`,
    sources: cellWarnings.errors });
  if (cellWarnings.missingFormulaResults.length) warnings.push({ code: "formula_without_cached_result", severity: "warning",
    message: `${cellWarnings.missingFormulaResults.length} fórmula(s) não possuem resultado calculado armazenado.`,
    sources: cellWarnings.missingFormulaResults });
  warnings.push({ code: "scope_requires_human_review", severity: "warning",
    message: "Detalhes bancários e patrimoniais permanecem sem classificação automática entre escopo pessoal e empresarial.",
    sources: ["ATIVOS KWN", "PASSIVO KWN", ...BANK_SHEETS] });
  warnings.push({ code: "supporting_totals_not_consolidated", severity: "info",
    message: "Totais e detalhes auxiliares foram mantidos para conciliação, sem nova soma nos KPIs consolidados.",
    sources: ["RECEITAS KWN", "DESPESAS KWN", cashFlowSheetName] });

  const reconciliations = consolidatedLayout
    ? buildConsolidatedReconciliations(facts)
    : buildLegacyReconciliations(
      facts,
      requestedMonthColumn,
      requestedExpenseColumn,
      cashFlowSheetName,
    );
  for (const item of reconciliations.filter((entry) => entry.status !== "passed")) {
    warnings.push({ code: `reconciliation_${item.code}`, severity: item.status === "failed" ? "error" : "warning",
      message: item.status === "failed" ? "Conciliação financeira divergente." : "Conciliação financeira indisponível.",
      sources: item.sources });
  }
  if (configuration.requireExpectedPeriod) {
    validateCanonicalFacts(facts, parserContext.expectedPeriod);
  }
  return {
    schemaVersion: "financial-extraction.v1", parserVersion: configuration.parserVersion,
    status: "needs_review", publishable: false,
    metadata: { company: parserContext.company, document: parserContext.document,
      periodMonth: parserContext.expectedPeriod, currency: "BRL",
      extractedAt: parserContext.extractedAt ?? new Date().toISOString(), sheetCount: workbook.worksheets.length,
      sheets: workbook.worksheets.map((ws) => ws.name) },
    facts, bankTransactions, reconciliations, warnings,
    statistics: { factCount: facts.length, bankTransactionCount: bankTransactions.length,
      formulaErrorCount: cellWarnings.errors.length, duplicateFactCount },
  };
}

export async function parseKawanaWorkbook(
  input: Buffer | Uint8Array | ArrayBuffer,
  context: ParserContext,
) {
  return parseKawanaWorkbookConfigured(input, context, {
    parserVersion: KAWANA_PARSER_VERSION,
    requireExpectedPeriod: false,
    canonicalPeriodOnly: false,
    strictStructure: false,
    monthColumns: MONTH_COLUMNS,
    expenseMonthColumns: EXPENSE_MONTH_COLUMNS,
  });
}

export async function parseKawanaWorkbookV2(
  input: Buffer | Uint8Array | ArrayBuffer,
  context: ParserContext,
) {
  return parseKawanaWorkbookConfigured(input, context, {
    parserVersion: KAWANA_PARSER_V2_VERSION,
    requireExpectedPeriod: true,
    canonicalPeriodOnly: true,
    strictStructure: true,
    monthColumns: ALL_MONTH_COLUMNS,
    expenseMonthColumns: ALL_EXPENSE_MONTH_COLUMNS,
  });
}
