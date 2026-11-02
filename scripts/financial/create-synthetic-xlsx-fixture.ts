import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import ExcelJS from "exceljs";

const sheetNames = [
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

export async function createSyntheticFinancialXlsx() {
  const workbook = new ExcelJS.Workbook();

  for (const sheetName of sheetNames) {
    workbook.addWorksheet(sheetName);
  }

  const summary = workbook.getWorksheet("Resumo")!;
  summary.getCell("A1").value = "Relatório sintético local - setembro de 2026";
  summary.getCell("B4").value = 350.80;
  summary.getCell("K66").value = 75.15;
  summary.getCell("K68").value = 45.10;
  summary.getCell("K85").value = 120.25;

  const revenue = workbook.getWorksheet("RECEITAS KWN")!;
  revenue.getCell("A7").value = "Receita sintética fora do escopo inicial";
  revenue.getCell("K7").value = 30.00;

  const bank = workbook.getWorksheet("Itaú Kawana")!;
  bank.getCell("A4").value = new Date(Date.UTC(2026, 8, 30));
  bank.getCell("C4").value = "Movimento sintético para revisão futura";
  bank.getCell("D4").value = "09/2026";
  bank.getCell("G4").value = "CATEGORIA SINTÉTICA";
  bank.getCell("H4").value = 10.00;
  bank.getCell("J4").value = 10.00;

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

async function writeFixture() {
  const outputPath = resolve(
    process.argv[2]
      ?? ".local/financial-fixtures/09b-synthetic-financial-report.xlsx",
  );
  const binary = await createSyntheticFinancialXlsx();

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, binary, { mode: 0o600 });

  console.log(JSON.stringify({
    fixture: outputPath,
    synthetic: true,
    bytes: binary.byteLength,
  }));
}

const currentFile = fileURLToPath(import.meta.url);
const invokedFile = process.argv[1] ? resolve(process.argv[1]) : "";

if (currentFile === invokedFile) {
  await writeFixture();
}
