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
  assert.deepEqual(listFinancialXlsxMappings(), [{
    id: "kawana-management-report",
    version: "1",
    parserVersion: "06A.1",
  }]);
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
    extractFinancialXlsx(adapterRequest(binary, "2")),
    (error: Error) => error.name === "unsupported_mapping",
  );
  await assert.rejects(
    extractFinancialXlsx({ ...adapterRequest(binary), maxFileSize: 10 }),
    (error: Error) => error.name === "file_too_large",
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

const realWorkbookPath = resolve(".local/kawana/09.2026 Relatório Gerencial Kawana.xlsx");

test("integração local processa o XLSX real sem persistência", {
  skip: !existsSync(realWorkbookPath),
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
