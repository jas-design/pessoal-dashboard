import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

import ExcelJS from "exceljs";

import {
  extractFinancialXlsx,
  XLSX_MIME_TYPE,
  type FinancialXlsxBinary,
} from "../../src/services/financial/financial-xlsx-adapter";
import { listFinancialXlsxMappings } from "../../src/services/financial/financial-xlsx-mappings";
import { parseKawanaWorkbook } from "../../src/services/financial/kawana-xlsx-parser";
import { prepareFinancialReviewPersistence } from "../../src/services/financial/financial-review-persistence";

const SUMMARY_MONTH_COLUMNS = ["C", "D", "E", "F", "G", "H", "I", "J", "K"] as const;
const EXPENSE_MONTH_COLUMNS = ["D", "F", "H", "J", "L", "N", "P", "R", "T"] as const;

const SHEETS = [
  "CAPA", "Resumo", "Fluxo de Caixa 2026", "ATIVO X PASSIVO KWN",
  "ATIVOS KWN", "PASSIVO KWN", "RECEITAS KWN", "DESPESAS KWN",
  "Itaú Kawana ", "Bradesco Invest Fácil Kawana ", "Bradesco Kawana ", "Caixa Kawana ",
] as const;

async function createSyntheticWorkbook() {
  const workbook = new ExcelJS.Workbook();
  for (const name of SHEETS) workbook.addWorksheet(name);

  const summary = workbook.getWorksheet("Resumo")!;
  summary.getCell("A1").value = "Relatório sintético - 01/01/2026 a 30/09/2026";
  summary.getCell("B4").value = { formula: "SUM(B5:B8)", result: 350.8 };
  [100, 80, 90, 80.8].forEach((value, index) => {
    summary.getCell(`A${index + 5}`).value = `Banco sintético ${index + 1}`;
    summary.getCell(`B${index + 5}`).value = value;
  });
  summary.getCell("A66").value = "Total";
  summary.getCell("K66").value = { formula: "K85-K68", result: 75.15 };
  summary.getCell("A68").value = "Total Despesas";
  summary.getCell("K68").value = 45.1;
  summary.getCell("A85").value = "Total Receitas";
  summary.getCell("K85").value = 120.25;

  const revenue = workbook.getWorksheet("RECEITAS KWN")!;
  revenue.getCell("A4").value = "TOTAL GERAL";
  revenue.getCell("K4").value = 120.25;
  revenue.getCell("A6").value = "RECEITAS";
  revenue.getCell("K6").value = 120.25;
  revenue.getCell("A7").value = "Receita sintética A";
  revenue.getCell("K7").value = "70,20";
  revenue.getCell("A8").value = "Receita sintética B";
  revenue.getCell("K8").value = 50.05;
  revenue.getCell("A9").value = "Receita sintética repetida";
  revenue.getCell("K9").value = "70,20";

  const expense = workbook.getWorksheet("DESPESAS KWN")!;
  expense.getCell("A4").value = "TOTAL GERAL";
  expense.getCell("T4").value = -45.1;
  expense.getCell("A6").value = "CATEGORIA SINTÉTICA";
  expense.getCell("T6").value = -45.1;
  expense.getCell("A7").value = "Detalhe sintético";
  expense.getCell("T7").value = -45.1;
  expense.getCell("U7").value = 1;

  const cashFlow = workbook.getWorksheet("Fluxo de Caixa 2026")!;
  ["C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N"].forEach(
    (column, index) => { cashFlow.getCell(`${column}8`).value = new Date(Date.UTC(2026, index, 1)); },
  );
  cashFlow.getCell("K10").value = 350.8;
  cashFlow.getCell("K12").value = 5;
  cashFlow.getCell("L10").value = 400;
  cashFlow.getCell("L12").value = 49.2;
  cashFlow.getCell("L14").value = 10;
  cashFlow.getCell("L32").value = 59.2;
  for (const row of [4, 6]) {
    for (let column = 2; column <= 14; column += 1) {
      cashFlow.getCell(row, column).value = { error: "#REF!" };
    }
  }

  const equity = workbook.getWorksheet("ATIVO X PASSIVO KWN")!;
  [[6, "Resultado", 25], [8, "Ativo", 100], [10, "Passivo", 75]].forEach(
    ([row, label, value]) => {
      equity.getCell(`A${row}`).value = label;
      equity.getCell(`K${row}`).value = value;
    },
  );
  const assets = workbook.getWorksheet("ATIVOS KWN")!;
  assets.getCell("A4").value = "TOTAL GERAL";
  assets.getCell("K4").value = 100;
  assets.getCell("A6").value = "ATIVO SINTÉTICO";
  assets.getCell("K6").value = 100;
  const liabilities = workbook.getWorksheet("PASSIVO KWN")!;
  liabilities.getCell("A4").value = "TOTAL GERAL";
  liabilities.getCell("K4").value = 75;
  liabilities.getCell("A6").value = "APORTE SINTÉTICO";
  liabilities.getCell("K6").value = 75;

  [100, 80, 90, 80.8].forEach((balance, index) => {
    const bank = workbook.getWorksheet(SHEETS[index + 8])!;
    bank.getCell("A4").value = new Date(Date.UTC(2026, 8, 30));
    bank.getCell("C4").value = "Movimento sintético";
    bank.getCell("D4").value = "09/2026";
    bank.getCell("G4").value = index === 0 ? "APORTE" : "CATEGORIA A REVISAR";
    bank.getCell("H4").value = balance;
    bank.getCell("J4").value = balance;
  });
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

async function createSyntheticWorkbookForPeriod(periodMonth: string) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Uint8Array.from(await createSyntheticWorkbook()).buffer);
  const year = Number(periodMonth.slice(0, 4));
  const month = Number(periodMonth.slice(5, 7));
  const summaryColumn = SUMMARY_MONTH_COLUMNS[month - 1];
  const expenseColumn = EXPENSE_MONTH_COLUMNS[month - 1];
  if (!summaryColumn || !expenseColumn) throw new Error("Mes sintetico nao configurado.");

  const summary = workbook.getWorksheet("Resumo")!;
  const finalDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  summary.getCell("A1").value = `Relatorio sintetico - 01/01/${year} a ${String(finalDay).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
  for (const address of ["K66", "K68", "K85"]) summary.getCell(address).value = null;
  summary.getCell(`${summaryColumn}66`).value = 75.15;
  summary.getCell(`${summaryColumn}68`).value = 45.1;
  summary.getCell(`${summaryColumn}85`).value = 120.25;

  const revenue = workbook.getWorksheet("RECEITAS KWN")!;
  revenue.getCell("K4").value = null;
  revenue.getCell(`${summaryColumn}4`).value = 120.25;

  const expense = workbook.getWorksheet("DESPESAS KWN")!;
  expense.getCell("T4").value = null;
  expense.getCell(`${expenseColumn}4`).value = -45.1;

  const cashFlow = workbook.getWorksheet("Fluxo de Caixa 2026")!;
  cashFlow.name = `Fluxo de Caixa ${year}`;
  ["C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N"].forEach(
    (column, index) => { cashFlow.getCell(`${column}8`).value = new Date(Date.UTC(year, index, 1)); },
  );
  cashFlow.getCell("K10").value = null;
  cashFlow.getCell(`${summaryColumn}10`).value = 350.8;

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

async function createSyntheticConsolidatedWorkbook(periodMonth = "2026-01") {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Uint8Array.from(
    await createSyntheticWorkbookForPeriod(periodMonth),
  ).buffer);

  const summary = workbook.getWorksheet("Resumo")!;
  summary.name = "RESUMO KWM";
  summary.getCell("A2").value = "RESUMO FINANCEIRO - 01/01/2026 - 31/01/2026";
  summary.getCell("A10").value = "TOTAL";
  summary.getCell("B10").value = 350.8;

  const combined = workbook.addWorksheet("RECEITAS X DESPESAS KWN");
  combined.getCell("A2").value = "Resultado de Receitas e Despesas - 01/01/2026 - 31/01/2026";
  combined.getCell("A6").value = "Resultado";
  combined.getCell("B6").value = 75.15;
  combined.getCell("A8").value = "Despesa";
  combined.getCell("B8").value = -45.1;
  combined.getCell("A23").value = "Receita";
  combined.getCell("B23").value = 120.25;

  workbook.getWorksheet("RECEITAS KWN")!.getCell("B6").value = 120.25;
  workbook.getWorksheet("DESPESAS KWN")!.getCell("B6").value = -45.1;

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

const context = {
  company: { id: "company-test", name: "Empresa Sintética" },
  document: {
    id: "document-test",
    fileName: "fixture-sintetica.xlsx",
    externalFileId: "external-test",
    etag: "fixture-etag",
  },
  expectedPeriod: "2026-09",
  extractedAt: "2026-10-17T12:00:00.000Z",
};

function adapterRequest(binary: FinancialXlsxBinary, mappingVersion = "1") {
  return {
    binary,
    mimeType: XLSX_MIME_TYPE,
    mapping: { id: "kawana-management-report", version: mappingVersion },
    company: context.company,
    document: context.document,
    periodMonth: context.expectedPeriod,
    extractedAt: context.extractedAt,
  };
}

test("extrai KPIs, fórmulas calculadas e conciliações sem duplicar totais", async () => {
  const result = await parseKawanaWorkbook(await createSyntheticWorkbook(), context);
  assert.equal(result.metadata.sheetCount, 12);
  assert.equal(result.status, "needs_review");
  assert.equal(result.publishable, false);
  assert.equal(result.statistics.formulaErrorCount, 26);
  assert.equal(result.facts.find((fact) => fact.evidence.sheet === "Resumo" && fact.evidence.cellAddress === "K85")?.amount, "120.25");
  assert.equal(result.facts.find((fact) => fact.evidence.sheet === "Resumo" && fact.evidence.cellAddress === "K68")?.amount, "45.10");
  assert.equal(result.facts.find((fact) => fact.evidence.sheet === "Resumo" && fact.evidence.cellAddress === "K66")?.amount, "75.15");
  assert.equal(result.facts.find((fact) => fact.evidence.sheet === "RECEITAS KWN" && fact.evidence.cellAddress === "K7")?.amount, "70.20");
  assert.equal(result.facts.some((fact) => fact.evidence.cellAddress === "U7"), false);
  assert.ok(result.reconciliations.every((item) => item.status === "passed"));
  assert.equal(result.facts.filter((fact) => fact.metricCode === "revenue" && fact.periodMonth === "2026-09"
    && fact.includedInConsolidatedKpi).length, 1);
  assert.equal(result.facts.filter((fact) => fact.evidence.sheet === "RECEITAS KWN"
    && fact.amount === "70.20").length, 2);
  assert.ok(result.facts.filter((fact) => fact.evidence.sheet === "RECEITAS KWN"
    && fact.amount === "70.20").every((fact) => !fact.includedInConsolidatedKpi));
  assert.equal(result.facts.find((fact) => fact.evidence.sheet === "RECEITAS KWN"
    && fact.evidence.cellAddress === "K4")?.includedInConsolidatedKpi, false);
});

test("separa forecast e mantém lançamentos ambíguos bloqueados", async () => {
  const result = await parseKawanaWorkbook(await createSyntheticWorkbook(), context);
  const octoberFacts = result.facts.filter((fact) => fact.evidence.sheet === "Fluxo de Caixa 2026"
    && fact.periodMonth === "2026-10");
  assert.ok(octoberFacts.length > 0);
  assert.ok(octoberFacts.every((fact) => fact.category === "forecast"));
  assert.equal(result.bankTransactions.length, 4);
  assert.ok(result.bankTransactions.every((transaction) => transaction.reviewStatus === "needs_review"));
  assert.ok(result.bankTransactions.every((transaction) => !transaction.includedInConsolidatedKpi));
  assert.ok(result.facts.filter((fact) => fact.category === "equity")
    .every((fact) => fact.sourceScope === "pending_review"));
});

test("sinaliza estrutura incompleta e não inventa reconciliações", async () => {
  const workbook = new ExcelJS.Workbook();
  workbook.addWorksheet("Resumo").getCell("K85").value = 10;
  const result = await extractFinancialXlsx(
    adapterRequest(Buffer.from(await workbook.xlsx.writeBuffer())),
  );
  assert.ok(result.warnings.some((warning) => warning.code === "unexpected_sheet_structure"));
  assert.ok(result.reconciliations.some((item) => item.status === "unavailable"));
  assert.equal(result.publishable, false);
});

test("adaptador preserva metadados e seleciona mapeamento versionado", async () => {
  const result = await extractFinancialXlsx(adapterRequest(await createSyntheticWorkbook()));
  assert.equal(result.schemaVersion, "financial-extraction.v1");
  assert.deepEqual(result.metadata.company, context.company);
  assert.deepEqual(result.metadata.document, context.document);
  assert.equal(result.metadata.periodMonth, context.expectedPeriod);
  assert.deepEqual(result.metadata.mapping, {
    id: "kawana-management-report",
    version: "1",
    parserVersion: "06A.1",
  });
  assert.deepEqual(listFinancialXlsxMappings(), [
    {
      id: "kawana-management-report",
      version: "1",
      parserVersion: "06A.1",
    },
    {
      id: "kawana-management-report",
      version: "2",
      parserVersion: "12A.2",
    },
  ]);
});

test("adaptador rejeita entrada vazia, conteúdo inválido e MIME incorreto", async () => {
  await assert.rejects(
    extractFinancialXlsx(adapterRequest(Buffer.alloc(0))),
    (error: Error) => error.name === "empty_file",
  );
  await assert.rejects(
    extractFinancialXlsx(adapterRequest(Buffer.from("não é xlsx"))),
    (error: Error) => error.name === "invalid_xlsx",
  );
  await assert.rejects(
    extractFinancialXlsx(adapterRequest(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00]))),
    (error: Error) => error.name === "invalid_xlsx",
  );
  await assert.rejects(
    extractFinancialXlsx({
      ...adapterRequest(await createSyntheticWorkbook()),
      mimeType: "application/octet-stream",
    }),
    (error: Error) => error.name === "invalid_mime_type",
  );
});

test("adaptador rejeita versão desconhecida e arquivo acima do limite", async () => {
  const binary = await createSyntheticWorkbook();
  await assert.rejects(
    extractFinancialXlsx(adapterRequest(binary, "999")),
    (error: Error) => error.name === "unsupported_mapping",
  );
  await assert.rejects(
    extractFinancialXlsx({ ...adapterRequest(binary), maxFileSize: 10 }),
    (error: Error) => error.name === "file_too_large",
  );
});

test("mapping v2 exige competencia explicita", async () => {
  const request = adapterRequest(await createSyntheticWorkbook(), "2");
  await assert.rejects(
    extractFinancialXlsx({ ...request, periodMonth: undefined }),
    (error: Error) => error.name === "invalid_metadata",
  );
});

test("adaptador mantém erros de fórmula e escopo ambíguo em revisão", async () => {
  const result = await extractFinancialXlsx(adapterRequest(await createSyntheticWorkbook()));
  assert.equal(result.statistics.formulaErrorCount, 26);
  assert.ok(result.warnings.some((warning) => warning.code === "spreadsheet_formula_errors"));
  assert.ok(result.warnings.some((warning) => warning.code === "scope_requires_human_review"));
  assert.equal(result.status, "needs_review");
  assert.equal(result.publishable, false);
});

test("mapping v2 seleciona e concilia exatamente a competencia de janeiro a setembro", async (t) => {
  const companyId = "00000000-0000-4000-8000-000000000921";
  const documentId = "00000000-0000-4000-8000-000000000922";
  const sourceEtag = "synthetic-kawana-v2-etag";

  for (let month = 1; month <= 9; month += 1) {
    const periodMonth = `2026-${String(month).padStart(2, "0")}`;
    await t.test(periodMonth, async () => {
      const result = await extractFinancialXlsx({
        binary: await createSyntheticWorkbookForPeriod(periodMonth),
        mimeType: XLSX_MIME_TYPE,
        mapping: { id: "kawana-management-report", version: "2" },
        company: { id: companyId, name: "Kawana" },
        document: {
          id: documentId,
          fileName: `${String(month).padStart(2, "0")}.2026 Relatorio Gerencial Kawana.xlsx`,
          etag: sourceEtag,
        },
        periodMonth,
        extractedAt: "2026-11-09T12:00:00.000Z",
      });

      const canonicalFacts = result.facts.filter(
        (fact) => fact.includedInConsolidatedKpi && fact.aggregationLevel === "canonical",
      );
      assert.equal(result.metadata.mapping.version, "2");
      assert.equal(result.metadata.mapping.parserVersion, "12A.2");
      assert.equal(canonicalFacts.length, 4);
      assert.ok(canonicalFacts.every((fact) => fact.periodMonth === periodMonth));
      assert.deepEqual(
        new Set(canonicalFacts.map((fact) => fact.metricCode)),
        new Set(["revenue", "expense", "net_result", "cash_available"]),
      );
      assert.ok(result.reconciliations.every((item) => item.status === "passed"));

      const plan = prepareFinancialReviewPersistence(result, {
        companyId,
        documentId,
        sourceEtag,
      });
      assert.equal(plan.facts.length, 4);
      assert.ok(plan.facts.every((fact) => fact.periodMonth === periodMonth));
      assert.ok(plan.deferredFacts.length > 0);
      assert.equal(plan.publishable, false);
    });
  }
});

test("mapping v2 reconhece o layout consolidado e preserva as quatro origens", async () => {
  const companyId = "00000000-0000-4000-8000-000000000961";
  const documentId = "00000000-0000-4000-8000-000000000962";
  const sourceEtag = "synthetic-kawana-consolidated-etag";
  const result = await extractFinancialXlsx({
    binary: await createSyntheticConsolidatedWorkbook(),
    mimeType: XLSX_MIME_TYPE,
    mapping: { id: "kawana-management-report", version: "2" },
    company: { id: companyId, name: "Kawana" },
    document: {
      id: documentId,
      fileName: "01.2026 Relatorio Gerencial Kawana.xlsx",
      etag: sourceEtag,
    },
    periodMonth: "2026-01",
  });

  const canonical = result.facts.filter(
    (fact) => fact.includedInConsolidatedKpi && fact.aggregationLevel === "canonical",
  );
  assert.deepEqual(
    canonical.map((fact) => [
      fact.metricCode,
      fact.amount,
      fact.evidence.sheet,
      fact.evidence.cellAddress,
    ]),
    [
      ["cash_available", "350.80", "RESUMO KWM", "B10"],
      ["revenue", "120.25", "RECEITAS X DESPESAS KWN", "B23"],
      ["expense", "45.10", "RECEITAS X DESPESAS KWN", "B8"],
      ["net_result", "75.15", "RECEITAS X DESPESAS KWN", "B6"],
    ],
  );
  assert.equal(canonical.find((fact) => fact.metricCode === "expense")?.originalSign, "negative");
  assert.ok(result.reconciliations.every((item) => item.status === "passed"));
  assert.equal(prepareFinancialReviewPersistence(result, {
    companyId,
    documentId,
    sourceEtag,
  }).facts.length, 4);
});

test("mapping v2 rejeita layout consolidado incompleto e despesa sem sinal negativo", async () => {
  const request = {
    mimeType: XLSX_MIME_TYPE,
    mapping: { id: "kawana-management-report", version: "2" },
    company: { id: "00000000-0000-4000-8000-000000000971", name: "Kawana" },
    document: {
      id: "00000000-0000-4000-8000-000000000972",
      fileName: "01.2026 Relatorio Gerencial Kawana.xlsx",
      etag: "synthetic-kawana-invalid-consolidated-etag",
    },
    periodMonth: "2026-01",
  };
  const incomplete = new ExcelJS.Workbook();
  await incomplete.xlsx.load(Uint8Array.from(await createSyntheticConsolidatedWorkbook()).buffer);
  const cashSheet = incomplete.worksheets.find((sheet) => sheet.name.trim() === "Caixa Kawana");
  assert.ok(cashSheet);
  incomplete.removeWorksheet(cashSheet.id);
  await assert.rejects(
    extractFinancialXlsx({
      ...request,
      binary: Buffer.from(await incomplete.xlsx.writeBuffer()),
    }),
    (error: Error) => error.name === "invalid_xlsx",
  );

  const invalidSign = new ExcelJS.Workbook();
  await invalidSign.xlsx.load(Uint8Array.from(await createSyntheticConsolidatedWorkbook()).buffer);
  invalidSign.getWorksheet("RECEITAS X DESPESAS KWN")!.getCell("B8").value = 45.1;
  await assert.rejects(
    extractFinancialXlsx({
      ...request,
      binary: Buffer.from(await invalidSign.xlsx.writeBuffer()),
    }),
    (error: Error) => error.name === "invalid_xlsx",
  );
});

test("mapping v2 bloqueia persistencia quando a conciliacao da competencia diverge", async () => {
  const binary = await createSyntheticWorkbookForPeriod("2026-01");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Uint8Array.from(binary).buffer);
  workbook.getWorksheet("RECEITAS KWN")!.getCell("C4").value = 119;
  const companyId = "00000000-0000-4000-8000-000000000931";
  const documentId = "00000000-0000-4000-8000-000000000932";
  const sourceEtag = "synthetic-kawana-v2-reconciliation-etag";
  const result = await extractFinancialXlsx({
    binary: Buffer.from(await workbook.xlsx.writeBuffer()),
    mimeType: XLSX_MIME_TYPE,
    mapping: { id: "kawana-management-report", version: "2" },
    company: { id: companyId, name: "Kawana" },
    document: { id: documentId, fileName: "01.2026.xlsx", etag: sourceEtag },
    periodMonth: "2026-01",
  });

  assert.ok(result.reconciliations.some((item) => item.status === "failed"));
  assert.throws(
    () => prepareFinancialReviewPersistence(result, { companyId, documentId, sourceEtag }),
    (error: Error & { code?: string }) => error.code === "invalid_extraction_contract",
  );
});

test("mapping v2 rejeita competencia diferente da declarada no XLSX", async () => {
  await assert.rejects(
    extractFinancialXlsx({
      binary: await createSyntheticWorkbookForPeriod("2026-01"),
      mimeType: XLSX_MIME_TYPE,
      mapping: { id: "kawana-management-report", version: "2" },
      company: { id: "00000000-0000-4000-8000-000000000951", name: "Kawana" },
      document: {
        id: "00000000-0000-4000-8000-000000000952",
        fileName: "01.2026 Relatorio Gerencial Kawana.xlsx",
        etag: "synthetic-kawana-period-mismatch-etag",
      },
      periodMonth: "2026-02",
    }),
    (error: Error) => error.name === "invalid_xlsx",
  );
});

test("mapping v2 deriva a aba de fluxo de caixa do ano solicitado", async () => {
  const result = await extractFinancialXlsx({
    binary: await createSyntheticWorkbookForPeriod("2027-01"),
    mimeType: XLSX_MIME_TYPE,
    mapping: { id: "kawana-management-report", version: "2" },
    company: { id: "00000000-0000-4000-8000-000000000941", name: "Kawana" },
    document: {
      id: "00000000-0000-4000-8000-000000000942",
      fileName: "01.2027 Relatorio Gerencial Kawana.xlsx",
      etag: "synthetic-kawana-2027-etag",
    },
    periodMonth: "2027-01",
  });

  assert.ok(result.metadata.sheets.includes("Fluxo de Caixa 2027"));
  assert.ok(result.reconciliations.every((item) => item.status === "passed"));
  assert.ok(result.facts.filter((fact) => fact.includedInConsolidatedKpi)
    .every((fact) => fact.periodMonth === "2027-01"));
});

const realWorkbookPath = resolve(".local/kawana/09.2026 Relatório Gerencial Kawana.xlsx");
const realJanuaryWorkbookPath = resolve(
  process.env.KAWANA_JANUARY_XLSX_PATH
    ?? ".local/kawana/01.2026 Relatório Gerencial Kawana.xlsx",
);

test("integração local valida o XLSX real de janeiro com mapping v2", {
  skip: process.env.RUN_REAL_FINANCIAL_FIXTURE_TESTS !== "1"
    || !existsSync(realJanuaryWorkbookPath),
}, async () => {
  const companyId = "468978dd-6ffa-440e-9465-df966ba093ee";
  const documentId = "3c96d0f6-0131-400d-a725-df734fdf74b0";
  const sourceEtag = "local-january-integration-test";
  const result = await extractFinancialXlsx({
    binary: await readFile(realJanuaryWorkbookPath),
    mimeType: XLSX_MIME_TYPE,
    mapping: { id: "kawana-management-report", version: "2" },
    company: { id: companyId, name: "Kawana" },
    document: {
      id: documentId,
      fileName: "01.2026 Relatório Gerencial Kawana.xlsx",
      etag: sourceEtag,
    },
    periodMonth: "2026-01",
  });
  const canonical = result.facts.filter(
    (fact) => fact.includedInConsolidatedKpi && fact.aggregationLevel === "canonical",
  );

  assert.equal(result.metadata.sheetCount, 13);
  assert.equal(result.statistics.formulaErrorCount, 0);
  assert.equal(result.statistics.duplicateFactCount, 0);
  assert.equal(canonical.length, 4);
  assert.deepEqual(
    Object.fromEntries(canonical.map((fact) => [fact.metricCode, fact.amount])),
    {
      cash_available: "70823.03",
      revenue: "3924.81",
      expense: "321637.31",
      net_result: "-317712.50",
    },
  );
  assert.ok(result.reconciliations.every((item) => item.status === "passed"));
  assert.equal(prepareFinancialReviewPersistence(result, {
    companyId,
    documentId,
    sourceEtag,
  }).facts.length, 4);
  assert.equal(result.status, "needs_review");
  assert.equal(result.publishable, false);
});

test("integração local processa o XLSX real sem persistência", {
  skip: process.env.RUN_REAL_FINANCIAL_FIXTURE_TESTS !== "1"
    || !existsSync(realWorkbookPath),
}, async () => {
  const binary = await readFile(realWorkbookPath);
  const result = await extractFinancialXlsx({
    ...adapterRequest(binary),
    company: { id: null, name: "Kawana" },
    document: {
      id: null,
      fileName: "09.2026 Relatório Gerencial Kawana.xlsx",
      etag: "local-integration-test",
    },
  });
  assert.equal(result.metadata.sheetCount, 12);
  assert.equal(result.metadata.mapping.version, "1");
  assert.equal(result.statistics.formulaErrorCount, 26);
  assert.ok(result.facts.length > 0);
  assert.ok(result.bankTransactions.length > 0);
  assert.ok(result.reconciliations.every((item) => item.status === "passed"));
  assert.equal(new Set(result.facts.map((fact) => fact.logicalKey)).size, result.facts.length);
  assert.equal(result.status, "needs_review");
  assert.equal(result.publishable, false);
});
