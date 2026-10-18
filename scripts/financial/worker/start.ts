import { readFile } from "node:fs/promises";

import { createFinancialXlsxWorker } from "../../../src/services/financial/worker/server";

function positiveIntegerEnvironment(name: string, fallback: number) {
  const rawValue = process.env[name];
  if (!rawValue) return fallback;
  const value = Number(rawValue);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} deve ser um inteiro positivo.`);
  }
  return value;
}

async function readWorkerSecret() {
  const environmentSecret = process.env.FINANCIAL_XLSX_WORKER_SECRET;
  const secretFile = process.env.FINANCIAL_XLSX_WORKER_SECRET_FILE;

  if (environmentSecret && secretFile) {
    throw new Error("Configure somente FINANCIAL_XLSX_WORKER_SECRET ou FINANCIAL_XLSX_WORKER_SECRET_FILE.");
  }
  if (environmentSecret) return environmentSecret;
  if (secretFile) {
    const fileSecret = (await readFile(secretFile, "utf8")).trim();
    if (fileSecret) return fileSecret;
  }
  throw new Error("Segredo do worker XLSX não configurado.");
}

const secret = await readWorkerSecret();

const host = process.env.FINANCIAL_XLSX_WORKER_HOST ?? "127.0.0.1";
const port = positiveIntegerEnvironment("FINANCIAL_XLSX_WORKER_PORT", 8787);
const server = createFinancialXlsxWorker({
  secret,
  maxFileSize: positiveIntegerEnvironment("FINANCIAL_XLSX_MAX_FILE_SIZE", 25 * 1024 * 1024),
  timeoutMs: positiveIntegerEnvironment("FINANCIAL_XLSX_TIMEOUT_MS", 30_000),
  maxOldSpaceMb: positiveIntegerEnvironment("FINANCIAL_XLSX_MAX_OLD_SPACE_MB", 256),
  maxConcurrency: 1,
  log(entry) {
    console.info(JSON.stringify(entry));
  },
});

server.listen(port, host, () => {
  console.info(JSON.stringify({ event: "worker_started", service: "financial-xlsx-worker", host, port }));
});

function shutdown(signal: string) {
  console.info(JSON.stringify({ event: "worker_stopping", signal }));
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.once("SIGTERM", () => shutdown("SIGTERM"));
process.once("SIGINT", () => shutdown("SIGINT"));
