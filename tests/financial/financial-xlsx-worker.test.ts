import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

import ExcelJS from "exceljs";

import {
  extractFinancialXlsx,
  XLSX_MIME_TYPE,
  type FinancialExtractionV1,
} from "../../src/services/financial/financial-xlsx-adapter";
import {
  createFinancialXlsxWorker,
  type FinancialXlsxParserRunner,
  type FinancialXlsxWorkerOptions,
} from "../../src/services/financial/worker/server";

const SECRET = "local-test-secret-with-at-least-32-bytes";

async function createSmallWorkbook() {
  const workbook = new ExcelJS.Workbook();
  const summary = workbook.addWorksheet("Resumo");
  summary.getCell("A1").value = "Relatório sintético - 01/01/2026 a 30/09/2026";
  summary.getCell("A85").value = "Total Receitas";
  summary.getCell("K85").value = 10;
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

async function createLargeResponseWorkbook() {
  const workbook = new ExcelJS.Workbook();
  const summary = workbook.addWorksheet("Resumo");
  summary.getCell("A1").value = "Relatório sintético - 01/01/2026 a 30/09/2026";
  summary.getCell("A85").value = "Total Receitas";
  summary.getCell("K85").value = 10;
  const bank = workbook.addWorksheet("Itaú Kawana ");
  for (let row = 4; row < 404; row += 1) {
    bank.getCell(`A${row}`).value = new Date(Date.UTC(2026, 8, 30));
    bank.getCell(`C${row}`).value = `Movimento sintético ${row}`;
    bank.getCell(`D${row}`).value = "09/2026";
    bank.getCell(`G${row}`).value = "CATEGORIA A REVISAR";
    bank.getCell(`H${row}`).value = row;
    bank.getCell(`J${row}`).value = row;
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

function requestHeaders(authorization = `Bearer ${SECRET}`) {
  return {
    authorization,
    "content-type": XLSX_MIME_TYPE,
    "x-financial-mapping-id": "kawana-management-report",
    "x-financial-mapping-version": "1",
    "x-financial-company-id": "company-context-test",
    "x-financial-company-name": encodeURIComponent("Empresa Sintética"),
    "x-financial-document-id": "document-test",
    "x-financial-document-name": encodeURIComponent("fixture sintética.xlsx"),
    "x-financial-document-etag": "etag-test",
    "x-financial-period-month": "2026-09",
  };
}

async function startWorker(options: Partial<FinancialXlsxWorkerOptions> = {}) {
  const tempRoot = await mkdtemp(join(tmpdir(), "fabio-worker-test-"));
  const server = createFinancialXlsxWorker({
    secret: SECRET,
    tempRoot,
    ...options,
  });
  await new Promise<void>((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
  const address = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    tempRoot,
    async close() {
      await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
      await rm(tempRoot, { recursive: true, force: true });
    },
  };
}

async function postWorkbook(baseUrl: string, binary: Buffer, headers = requestHeaders()) {
  return fetch(`${baseUrl}/v1/extractions/xlsx`, {
    method: "POST",
    headers,
    body: binary,
  });
}

test("healthcheck e extração HTTP autenticada retornam contrato bloqueado", async () => {
  const worker = await startWorker();
  try {
    const health = await fetch(`${worker.baseUrl}/health`);
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), {
      status: "ok",
      service: "financial-xlsx-worker",
      activeJobs: 0,
      maxConcurrency: 1,
    });

    const response = await postWorkbook(worker.baseUrl, await createSmallWorkbook());
    assert.equal(response.status, 200);
    const result = await response.json() as FinancialExtractionV1;
    assert.equal(result.schemaVersion, "financial-extraction.v1");
    assert.equal(result.status, "needs_review");
    assert.equal(result.publishable, false);
    assert.equal(result.metadata.document.etag, "etag-test");
    assert.equal(result.metadata.mapping.version, "1");
    assert.ok(result.warnings.some((warning) => warning.code === "company_context_unverified"));
    assert.deepEqual(await readdir(worker.tempRoot), []);
  } finally {
    await worker.close();
  }
});

test("worker rejeita autenticação inválida antes do processamento", async () => {
  const worker = await startWorker();
  try {
    const response = await postWorkbook(
      worker.baseUrl,
      await createSmallWorkbook(),
      requestHeaders("Bearer segredo-incorreto"),
    );
    assert.equal(response.status, 401);
    const body = await response.json() as { error: { code: string } };
    assert.equal(body.error.code, "unauthorized");
    assert.deepEqual(await readdir(worker.tempRoot), []);
  } finally {
    await worker.close();
  }
});

test("worker rejeita XLSX corrompido e remove o temporário", async () => {
  const worker = await startWorker();
  try {
    const corrupt = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00]);
    const response = await postWorkbook(worker.baseUrl, corrupt);
    assert.equal(response.status, 422);
    const body = await response.json() as { error: { code: string } };
    assert.equal(body.error.code, "invalid_xlsx");
    assert.deepEqual(await readdir(worker.tempRoot), []);
  } finally {
    await worker.close();
  }
});

test("worker rejeita arquivo acima do limite", async () => {
  const worker = await startWorker({ maxFileSize: 4 });
  try {
    const response = await postWorkbook(worker.baseUrl, Buffer.alloc(5));
    assert.equal(response.status, 413);
    const body = await response.json() as { error: { code: string } };
    assert.equal(body.error.code, "file_too_large");
  } finally {
    await worker.close();
  }
});

test("worker interrompe parsing que excede o timeout", async () => {
  const neverFinishes: FinancialXlsxParserRunner = async () => new Promise(() => {});
  const worker = await startWorker({ timeoutMs: 25, parserRunner: neverFinishes });
  try {
    const response = await postWorkbook(worker.baseUrl, await createSmallWorkbook());
    assert.equal(response.status, 504);
    const body = await response.json() as { error: { code: string } };
    assert.equal(body.error.code, "parse_timeout");
    assert.deepEqual(await readdir(worker.tempRoot), []);
  } finally {
    await worker.close();
  }
});

test("worker não expõe detalhes de erro inesperado do parser", async () => {
  const failingParser: FinancialXlsxParserRunner = async () => {
    throw new Error("conteúdo sensível que não pode sair na resposta");
  };
  const worker = await startWorker({ parserRunner: failingParser });
  try {
    const response = await postWorkbook(worker.baseUrl, await createSmallWorkbook());
    assert.equal(response.status, 500);
    const responseText = await response.text();
    assert.match(responseText, /internal_error/);
    assert.doesNotMatch(responseText, /conteúdo sensível/);
  } finally {
    await worker.close();
  }
});

test("worker limita concorrência a um processamento", async () => {
  const binary = await createSmallWorkbook();
  const expectedResult = await extractFinancialXlsx({
    binary,
    mimeType: XLSX_MIME_TYPE,
    mapping: { id: "kawana-management-report", version: "1" },
    company: { id: null, name: "Empresa Sintética" },
    document: { id: null, fileName: "fixture.xlsx", etag: "etag-concurrency" },
    periodMonth: "2026-09",
  });
  let releaseParser!: () => void;
  let markStarted!: () => void;
  const started = new Promise<void>((resolveStarted) => { markStarted = resolveStarted; });
  const release = new Promise<void>((resolveRelease) => { releaseParser = resolveRelease; });
  const heldParser: FinancialXlsxParserRunner = async () => {
    markStarted();
    await release;
    return expectedResult;
  };
  const worker = await startWorker({ parserRunner: heldParser });
  try {
    const firstRequest = postWorkbook(worker.baseUrl, binary);
    await started;
    const secondResponse = await postWorkbook(worker.baseUrl, binary);
    assert.equal(secondResponse.status, 429);
    releaseParser();
    const firstResponse = await firstRequest;
    assert.equal(firstResponse.status, 200);
  } finally {
    releaseParser();
    await worker.close();
  }
});

test("subprocesso conclui o envio de uma resposta maior antes de desconectar o IPC", async () => {
  const worker = await startWorker({ timeoutMs: 30_000 });
  try {
    const response = await postWorkbook(worker.baseUrl, await createLargeResponseWorkbook());
    assert.equal(response.status, 200);
    const result = await response.json() as FinancialExtractionV1;
    assert.equal(result.status, "needs_review");
    assert.equal(result.publishable, false);
    assert.equal(result.bankTransactions.length, 400);
    assert.deepEqual(await readdir(worker.tempRoot), []);
  } finally {
    await worker.close();
  }
});

const realWorkbookPath = resolve(".local/kawana/09.2026 Relatório Gerencial Kawana.xlsx");

test("worker processa o XLSX real por HTTP sem persistência", {
  skip: !existsSync(realWorkbookPath),
}, async () => {
  const worker = await startWorker({ timeoutMs: 30_000 });
  try {
    const response = await postWorkbook(worker.baseUrl, await readFile(realWorkbookPath));
    assert.equal(response.status, 200);
    const result = await response.json() as FinancialExtractionV1;
    assert.equal(result.metadata.sheetCount, 12);
    assert.equal(result.status, "needs_review");
    assert.equal(result.publishable, false);
    assert.ok(result.reconciliations.every((item) => item.status === "passed"));
    assert.deepEqual(await readdir(worker.tempRoot), []);
  } finally {
    await worker.close();
  }
});
