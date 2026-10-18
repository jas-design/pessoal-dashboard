import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";

import {
  extractFinancialXlsx,
  XLSX_MIME_TYPE,
} from "../../src/services/financial/financial-xlsx-adapter";

function readArgument(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function requireArgument(name: string) {
  const value = readArgument(name);
  if (!value) throw new Error(`Argumento obrigatório ausente: ${name}`);
  return value;
}

const inputPath = resolve(requireArgument("--input"));
const companyName = requireArgument("--company-name");
const mappingId = requireArgument("--mapping");
const mappingVersion = requireArgument("--mapping-version");
const inputBaseName = basename(inputPath).replace(/\.xlsx$/i, "");
const outputPath = resolve(
  readArgument("--output") ?? `.local/financial-parser/${inputBaseName}-dry-run.json`,
);
const file = await readFile(inputPath);
const result = await extractFinancialXlsx({
  binary: file,
  mimeType: XLSX_MIME_TYPE,
  mapping: {
    id: mappingId,
    version: mappingVersion,
  },
  company: {
    id: readArgument("--company-id") ?? null,
    name: companyName,
  },
  document: {
    id: readArgument("--document-id") ?? null,
    fileName: basename(inputPath),
    etag: readArgument("--etag") ?? createHash("sha256").update(file).digest("hex"),
  },
  periodMonth: readArgument("--period"),
});

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");

console.log(JSON.stringify({
  status: result.status,
  publishable: result.publishable,
  sheets: result.metadata.sheetCount,
  facts: result.statistics.factCount,
  bankTransactions: result.statistics.bankTransactionCount,
  formulaErrors: result.statistics.formulaErrorCount,
  failedOrUnavailableReconciliations: result.reconciliations.filter(
    (item) => item.status !== "passed",
  ).length,
  output: outputPath,
}));
