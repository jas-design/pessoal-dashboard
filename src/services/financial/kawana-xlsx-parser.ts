import ExcelJS, { type Cell, type Worksheet } from "exceljs";

export const KAWANA_PARSER_VERSION = "06A.1";

const EXPECTED_SHEETS = [
  "CAPA",
  "Resumo",
  "Fluxo de Caixa 2026",
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

const MONTH_COLUMNS = [
  ["C", 1], ["D", 2], ["E", 3], ["F", 4], ["G", 5],
  ["H", 6], ["I", 7], ["J", 8], ["K", 9],
] as const;

const EXPENSE_MONTH_COLUMNS = [
  ["D", 1], ["F", 2], ["H", 3], ["J", 4], ["L", 5],
  ["N", 6], ["P", 7], ["R", 8], ["T", 9],
] as const;

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
  const summary = findSheet(workbook, "Resumo");
  if (!summary) return null;
  const title = cellText(summary, "A1");
  const dates = [...title.matchAll(/(\d{2})\/(\d{2})\/(\d{4})/g)];
  const lastDate = dates.at(-1);
  return lastDate ? monthPeriod(Number(lastDate[3]), Number(lastDate[2])) : null;
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

function parseSummary(ws: Worksheet, context: ParserContext, facts: FinancialFact[], seen: Set<string>) {
  const year = Number(context.expectedPeriod?.slice(0, 4) ?? "2026");
  const rows = [
    [85, "revenue", "Receitas realizadas"],
    [68, "expense", "Despesas realizadas"],
    [66, "net_result", "Resultado realizado"],
  ] as const;
  for (const [row, code, indicator] of rows) {
    for (const [column, month] of MONTH_COLUMNS) {
      addCellFact(facts, seen, context, ws, `${column}${row}`, {
        periodMonth: monthPeriod(year, month), metricCode: code, indicator,
        category: "realized", sourceScope: "business", accountingBasis: "unspecified",
        includedInConsolidatedKpi: true, aggregationLevel: "canonical",
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

function parseRevenueDetails(ws: Worksheet, context: ParserContext, facts: FinancialFact[], seen: Set<string>) {
  const year = Number(context.expectedPeriod?.slice(0, 4) ?? "2026");
  for (let row = 7; row <= 9; row += 1) {
    const label = cellText(ws, `A${row}`);
    if (!label) continue;
    for (const [column, month] of MONTH_COLUMNS) {
      addCellFact(facts, seen, context, ws, `${column}${row}`, {
        periodMonth: monthPeriod(year, month), metricCode: `revenue_detail_${slug(label)}_${row}`,
        indicator: label, category: "realized", sourceScope: "pending_review",
        accountingBasis: "unspecified", includedInConsolidatedKpi: false,
        aggregationLevel: "supporting_detail",
      });
    }
  }
}

function parseExpenseDetails(ws: Worksheet, context: ParserContext, facts: FinancialFact[], seen: Set<string>) {
  const year = Number(context.expectedPeriod?.slice(0, 4) ?? "2026");
  for (let row = 6; row <= 107; row += 1) {
    const label = cellText(ws, `A${row}`);
    if (!label) continue;
    for (const [column, month] of EXPENSE_MONTH_COLUMNS) {
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

function parseEquitySummary(ws: Worksheet, context: ParserContext, facts: FinancialFact[], seen: Set<string>) {
  const year = Number(context.expectedPeriod?.slice(0, 4) ?? "2026");
  for (const [row, code] of [[6, "equity_result"], [8, "asset_total"], [10, "liability_total"]] as const) {
    const indicator = cellText(ws, `A${row}`) || code;
    for (const [column, month] of MONTH_COLUMNS) {
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
  kind: "asset" | "liability",
) {
  const year = Number(context.expectedPeriod?.slice(0, 4) ?? "2026");
  for (let row = 4; row <= ws.rowCount; row += 1) {
    const label = cellText(ws, `A${row}`);
    if (!label) continue;
    for (const [column, month] of MONTH_COLUMNS) {
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

function buildReconciliations(facts: FinancialFact[]) {
  const revenue = getFactMinor(facts, "Resumo", "K85");
  const expense = getFactMinor(facts, "Resumo", "K68");
  const result = getFactMinor(facts, "Resumo", "K66");
  const cash = getFactMinor(facts, "Resumo", "B4");
  const sum = (values: Array<number | null>, size: number) => values.length === size
    && values.every((value): value is number => value !== null) ? values.reduce((total, value) => total + value, 0) : null;
  const bankComponents = ["B5", "B6", "B7", "B8"].map((address) => getFactMinor(facts, "Resumo", address));
  const bankStatements = facts.filter((fact) => fact.metricCode.startsWith("bank_statement_final_balance_"))
    .map((fact) => Number(fact.amountMinor));
  return [
    reconciliation("summary_result_equals_revenue_minus_expense", revenue !== null && expense !== null ? revenue - expense : null,
      result, ["Resumo!K85", "Resumo!K68", "Resumo!K66"]),
    reconciliation("revenue_detail_matches_summary", getFactMinor(facts, "RECEITAS KWN", "K4"), revenue,
      ["RECEITAS KWN!K4", "Resumo!K85"]),
    reconciliation("expense_detail_matches_summary", getFactMinor(facts, "DESPESAS KWN", "T4"), expense,
      ["DESPESAS KWN!T4", "Resumo!K68"]),
    reconciliation("cash_flow_balance_matches_summary", getFactMinor(facts, "Fluxo de Caixa 2026", "K10"), cash,
      ["Fluxo de Caixa 2026!K10", "Resumo!B4"]),
    reconciliation("summary_bank_components_match_total", sum(bankComponents, 4), cash, ["Resumo!B5:B8", "Resumo!B4"]),
    reconciliation("bank_statement_balances_match_summary", sum(bankStatements, 4), cash,
      ["quatro abas bancárias!saldo final", "Resumo!B4"]),
  ];
}

export async function parseKawanaWorkbook(
  input: Buffer | Uint8Array | ArrayBuffer,
  context: ParserContext,
): Promise<KawanaParseResult> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(input));
  const parserContext = {
    ...context,
    expectedPeriod: context.expectedPeriod ?? detectReportPeriod(workbook) ?? "2026-09",
  };
  const facts: FinancialFact[] = [];
  const bankTransactions: BankTransaction[] = [];
  const warnings: ValidationWarning[] = [];
  const seen = new Set<string>();
  let duplicateFactCount = 0;
  const addTotal = (ws: Worksheet, address: string, input: FactInput) => {
    if (!addCellFact(facts, seen, parserContext, ws, address, input)) duplicateFactCount += 1;
  };

  const missing = EXPECTED_SHEETS.filter((name) => !findSheet(workbook, name));
  const unexpected = workbook.worksheets.filter((ws) => !EXPECTED_SHEETS.some((name) =>
    normalizeSheetName(name) === normalizeSheetName(ws.name))).map((ws) => ws.name);
  if (workbook.worksheets.length !== EXPECTED_SHEETS.length || missing.length > 0) {
    warnings.push({ code: "unexpected_sheet_structure", severity: "error",
      message: `Esperadas ${EXPECTED_SHEETS.length} abas; encontradas ${workbook.worksheets.length}.`,
      sources: [...missing.map((name) => `ausente:${name}`), ...unexpected.map((name) => `inesperada:${name}`)] });
  }

  const summary = findSheet(workbook, "Resumo");
  if (summary) parseSummary(summary, parserContext, facts, seen);
  const revenue = findSheet(workbook, "RECEITAS KWN");
  if (revenue) {
    parseRevenueDetails(revenue, parserContext, facts, seen);
    addTotal(revenue, "K4", { periodMonth: parserContext.expectedPeriod,
      metricCode: "revenue_reconciliation_total", indicator: "Total de receitas para conciliação",
      category: "realized", sourceScope: "pending_review", accountingBasis: "unspecified",
      includedInConsolidatedKpi: false, aggregationLevel: "supporting_detail" });
  }
  const expense = findSheet(workbook, "DESPESAS KWN");
  if (expense) {
    parseExpenseDetails(expense, parserContext, facts, seen);
    addTotal(expense, "T4", { periodMonth: parserContext.expectedPeriod,
      metricCode: "expense_reconciliation_total", indicator: "Total de despesas para conciliação",
      category: "realized", sourceScope: "pending_review", accountingBasis: "unspecified",
      includedInConsolidatedKpi: false, aggregationLevel: "supporting_detail", canonicalTransform: Math.abs });
  }
  const cashFlow = findSheet(workbook, "Fluxo de Caixa 2026");
  if (cashFlow) parseCashFlow(cashFlow, parserContext, facts, seen);
  const equity = findSheet(workbook, "ATIVO X PASSIVO KWN");
  if (equity) parseEquitySummary(equity, parserContext, facts, seen);
  const assets = findSheet(workbook, "ATIVOS KWN");
  if (assets) parseEquityDetails(assets, parserContext, facts, seen, "asset");
  const liabilities = findSheet(workbook, "PASSIVO KWN");
  if (liabilities) parseEquityDetails(liabilities, parserContext, facts, seen, "liability");
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
    sources: ["RECEITAS KWN", "DESPESAS KWN", "Fluxo de Caixa 2026"] });

  const reconciliations = buildReconciliations(facts);
  for (const item of reconciliations.filter((entry) => entry.status !== "passed")) {
    warnings.push({ code: `reconciliation_${item.code}`, severity: item.status === "failed" ? "error" : "warning",
      message: item.status === "failed" ? "Conciliação financeira divergente." : "Conciliação financeira indisponível.",
      sources: item.sources });
  }
  return {
    schemaVersion: "financial-extraction.v1", parserVersion: KAWANA_PARSER_VERSION,
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
