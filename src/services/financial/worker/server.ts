import { randomUUID, timingSafeEqual } from "node:crypto";
import { fork } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import type {
  FinancialExtractionV1,
  FinancialXlsxExtractionRequest,
} from "../financial-xlsx-adapter";

const DEFAULT_MAX_FILE_SIZE = 25 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_OLD_SPACE_MB = 256;
const DEFAULT_MAX_CONCURRENCY = 1;
const XLSX_MIME_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

type ParserInput = Omit<FinancialXlsxExtractionRequest, "binary">;

export interface FinancialXlsxParserRunnerOptions {
  signal: AbortSignal;
  maxOldSpaceMb: number;
}

export type FinancialXlsxParserRunner = (
  filePath: string,
  request: ParserInput,
  options: FinancialXlsxParserRunnerOptions,
) => Promise<FinancialExtractionV1>;

export interface FinancialXlsxWorkerOptions {
  secret: string;
  maxFileSize?: number;
  timeoutMs?: number;
  maxOldSpaceMb?: number;
  maxConcurrency?: number;
  tempRoot?: string;
  parserRunner?: FinancialXlsxParserRunner;
  log?: (entry: Record<string, string | number>) => void;
}

type HttpError = Error & { statusCode: number; code: string };

function httpError(statusCode: number, code: string, message: string) {
  const error = new Error(message) as HttpError;
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function positiveInteger(value: number, field: string) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${field} deve ser um inteiro positivo.`);
  }
  return value;
}

function header(request: IncomingMessage, name: string) {
  const value = request.headers[name];
  if (Array.isArray(value)) {
    throw httpError(400, "invalid_metadata", `Header duplicado: ${name}.`);
  }
  return value;
}

function decodedHeader(request: IncomingMessage, name: string, required = false) {
  const value = header(request, name);
  if (!value) {
    if (required) throw httpError(400, "invalid_metadata", `Header obrigatório ausente: ${name}.`);
    return undefined;
  }
  try {
    const decoded = decodeURIComponent(value);
    if (decoded.length > 2_048 || /[\u0000-\u001f\u007f]/.test(decoded)) {
      throw new Error("invalid header value");
    }
    return decoded;
  } catch {
    throw httpError(400, "invalid_metadata", `Header inválido: ${name}.`);
  }
}

function authorized(request: IncomingMessage, secret: string) {
  const authorization = header(request, "authorization");
  if (!authorization?.startsWith("Bearer ")) return false;
  const received = Buffer.from(authorization.slice(7), "utf8");
  const expected = Buffer.from(secret, "utf8");
  return received.length === expected.length && timingSafeEqual(received, expected);
}

function requestMetadata(request: IncomingMessage): ParserInput {
  const contentType = header(request, "content-type")?.split(";", 1)[0].trim();
  if (contentType !== XLSX_MIME_TYPE) {
    throw httpError(415, "invalid_mime_type", "Content-Type deve ser XLSX.");
  }
  return {
    mimeType: contentType,
    mapping: {
      id: decodedHeader(request, "x-financial-mapping-id", true)!,
      version: decodedHeader(request, "x-financial-mapping-version", true)!,
    },
    company: {
      id: decodedHeader(request, "x-financial-company-id") ?? null,
      name: decodedHeader(request, "x-financial-company-name", true)!,
    },
    document: {
      id: decodedHeader(request, "x-financial-document-id") ?? null,
      fileName: decodedHeader(request, "x-financial-document-name", true)!,
      externalFileId: decodedHeader(request, "x-financial-external-file-id") ?? null,
      etag: decodedHeader(request, "x-financial-document-etag", true)!,
    },
    periodMonth: decodedHeader(request, "x-financial-period-month"),
  };
}

async function readRequestBody(request: IncomingMessage, maxFileSize: number) {
  const contentLength = header(request, "content-length");
  if (contentLength) {
    const declaredSize = Number(contentLength);
    if (!Number.isSafeInteger(declaredSize) || declaredSize < 0) {
      throw httpError(400, "invalid_content_length", "Content-Length inválido.");
    }
    if (declaredSize > maxFileSize) {
      request.resume();
      throw httpError(413, "file_too_large", "O arquivo XLSX excede o limite permitido.");
    }
  }

  const chunks: Buffer[] = [];
  let size = 0;
  let exceeded = false;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > maxFileSize) {
      exceeded = true;
      chunks.length = 0;
      continue;
    }
    if (!exceeded) chunks.push(buffer);
  }
  if (exceeded) {
    throw httpError(413, "file_too_large", "O arquivo XLSX excede o limite permitido.");
  }
  return Buffer.concat(chunks, size);
}

function sendJson(response: ServerResponse, statusCode: number, payload: unknown, requestId: string) {
  const body = JSON.stringify(payload);
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "x-request-id": requestId,
  });
  response.end(body);
}

function statusForParserError(code: string) {
  if (code === "file_too_large") return 413;
  if (code === "invalid_mime_type") return 415;
  if (["empty_file", "invalid_metadata", "invalid_xlsx", "unsupported_mapping"].includes(code)) return 422;
  return 500;
}

export function parseFinancialXlsxInChildProcess(
  filePath: string,
  request: ParserInput,
  options: FinancialXlsxParserRunnerOptions,
) {
  return new Promise<FinancialExtractionV1>((resolve, reject) => {
    const childPath = fileURLToPath(new URL("./parse-child.ts", import.meta.url));
    const child = fork(childPath, [], {
      execArgv: [`--max-old-space-size=${options.maxOldSpaceMb}`, "--import", "tsx"],
      serialization: "advanced",
      stdio: ["ignore", "ignore", "ignore", "ipc"],
    });
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      options.signal.removeEventListener("abort", abort);
      callback();
    };
    const abort = () => {
      child.kill("SIGKILL");
      finish(() => reject(httpError(504, "parse_timeout", "O processamento do XLSX excedeu o tempo limite.")));
    };
    options.signal.addEventListener("abort", abort, { once: true });
    child.once("error", () => finish(() => reject(httpError(500, "parser_process_error", "Falha ao iniciar o parser XLSX."))));
    child.once("exit", (code) => {
      if (!settled && code !== 0) {
        finish(() => reject(httpError(500, "parser_process_error", "O processo do parser foi interrompido.")));
      }
    });
    child.once("message", (message: unknown) => {
      const reply = message as {
        ok: boolean;
        result?: FinancialExtractionV1;
        error?: { name: string; message: string };
      };
      if (reply.ok && reply.result) {
        finish(() => resolve(reply.result!));
        return;
      }
      const code = reply.error?.name ?? "internal_parser_error";
      finish(() => reject(httpError(
        statusForParserError(code),
        code,
        reply.error?.message ?? "Falha interna durante o processamento do XLSX.",
      )));
    });
    child.send({ filePath, request });
  });
}

function runWithTimeout(
  runner: FinancialXlsxParserRunner,
  filePath: string,
  request: ParserInput,
  timeoutMs: number,
  maxOldSpaceMb: number,
) {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(httpError(504, "parse_timeout", "O processamento do XLSX excedeu o tempo limite."));
    }, timeoutMs);
  });
  return Promise.race([
    runner(filePath, request, { signal: controller.signal, maxOldSpaceMb }),
    timeout,
  ]).finally(() => clearTimeout(timer));
}

function safeHttpError(error: unknown) {
  if (error instanceof Error && "statusCode" in error && "code" in error) {
    return error as HttpError;
  }
  return httpError(500, "internal_error", "Falha interna no worker XLSX.");
}

export function createFinancialXlsxWorker(options: FinancialXlsxWorkerOptions) {
  if (!options.secret || Buffer.byteLength(options.secret, "utf8") < 32) {
    throw new Error("FINANCIAL_XLSX_WORKER_SECRET deve possuir ao menos 32 bytes.");
  }
  const maxFileSize = positiveInteger(options.maxFileSize ?? DEFAULT_MAX_FILE_SIZE, "maxFileSize");
  const timeoutMs = positiveInteger(options.timeoutMs ?? DEFAULT_TIMEOUT_MS, "timeoutMs");
  const maxOldSpaceMb = positiveInteger(options.maxOldSpaceMb ?? DEFAULT_MAX_OLD_SPACE_MB, "maxOldSpaceMb");
  const maxConcurrency = positiveInteger(options.maxConcurrency ?? DEFAULT_MAX_CONCURRENCY, "maxConcurrency");
  const tempRoot = options.tempRoot ?? join(tmpdir(), "fabio-financial-xlsx-worker");
  const parserRunner = options.parserRunner ?? parseFinancialXlsxInChildProcess;
  let activeJobs = 0;

  const server = createServer((request, response) => {
    const requestId = randomUUID();
    const startedAt = Date.now();
    void (async () => {
      if (request.method === "GET" && request.url === "/health") {
        sendJson(response, 200, {
          status: "ok",
          service: "financial-xlsx-worker",
          activeJobs,
          maxConcurrency,
        }, requestId);
        return;
      }
      if (request.url !== "/v1/extractions/xlsx") {
        throw httpError(404, "not_found", "Endpoint não encontrado.");
      }
      if (request.method !== "POST") {
        throw httpError(405, "method_not_allowed", "Método não permitido.");
      }
      if (!authorized(request, options.secret)) {
        request.resume();
        throw httpError(401, "unauthorized", "Autenticação inválida.");
      }
      if (activeJobs >= maxConcurrency) {
        request.resume();
        throw httpError(429, "worker_busy", "O worker já está processando outro arquivo.");
      }

      activeJobs += 1;
      let requestDirectory: string | null = null;
      let result: FinancialExtractionV1;
      try {
        const metadata = requestMetadata(request);
        const binary = await readRequestBody(request, maxFileSize);
        await mkdir(tempRoot, { recursive: true, mode: 0o700 });
        requestDirectory = await mkdtemp(join(tempRoot, "job-"));
        const filePath = join(requestDirectory, "input.xlsx");
        await writeFile(filePath, binary, { mode: 0o600 });
        result = await runWithTimeout(parserRunner, filePath, metadata, timeoutMs, maxOldSpaceMb);
      } finally {
        activeJobs -= 1;
        if (requestDirectory) {
          await rm(requestDirectory, { recursive: true, force: true });
        }
      }
      sendJson(response, 200, {
        ...result,
        status: "needs_review",
        publishable: false,
        warnings: [
          ...result.warnings,
          {
            code: "company_context_unverified",
            severity: "warning",
            message: "O contexto da empresa recebido por HTTP ainda deve ser validado pelo serviço autorizado.",
            sources: ["http_request_metadata"],
          },
        ],
      }, requestId);
    })().catch((error) => {
      const safeError = safeHttpError(error);
      if (!response.headersSent) {
        sendJson(response, safeError.statusCode, {
          error: { code: safeError.code, message: safeError.message, requestId },
        }, requestId);
      }
    }).finally(() => {
      options.log?.({
        requestId,
        method: request.method ?? "UNKNOWN",
        path: request.url ?? "",
        statusCode: response.statusCode,
        durationMs: Date.now() - startedAt,
      });
    });
  });

  server.headersTimeout = 5_000;
  server.requestTimeout = Math.max(timeoutMs + 10_000, 40_000);
  server.keepAliveTimeout = 5_000;
  server.maxHeadersCount = 32;
  server.maxRequestsPerSocket = 100;
  return server;
}

export { XLSX_MIME_TYPE };
