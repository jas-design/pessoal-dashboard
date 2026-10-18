import {
  getFinancialXlsxMapping,
  type FinancialXlsxMapping,
} from "./financial-xlsx-mappings";
import type {
  KawanaParseResult,
  ParserContext,
} from "./kawana-xlsx-parser";

const DEFAULT_MAX_FILE_SIZE = 25 * 1024 * 1024;
const XLSX_MIME_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export type FinancialXlsxBinary = Buffer | Uint8Array | ArrayBuffer;

export interface FinancialXlsxExtractionRequest {
  binary: FinancialXlsxBinary;
  mimeType?: string;
  mapping: {
    id: string;
    version: string;
  };
  company: ParserContext["company"];
  document: ParserContext["document"];
  periodMonth?: string;
  extractedAt?: string;
  maxFileSize?: number;
}

export type FinancialExtractionV1 = Omit<KawanaParseResult, "metadata"> & {
  metadata: KawanaParseResult["metadata"] & {
    mapping: {
      id: string;
      version: string;
      parserVersion: string;
    };
  };
};

export type FinancialXlsxAdapterErrorCode =
  | "empty_file"
  | "file_too_large"
  | "invalid_metadata"
  | "invalid_mime_type"
  | "invalid_xlsx"
  | "unsupported_mapping";

function adapterError(code: FinancialXlsxAdapterErrorCode, message: string) {
  const error = new Error(message);
  error.name = code;
  return error;
}

function requireText(value: string | null | undefined, field: string) {
  if (typeof value !== "string" || value.trim() === "") {
    throw adapterError("invalid_metadata", `O campo ${field} é obrigatório.`);
  }
}

function validatePeriod(periodMonth: string | undefined) {
  if (periodMonth && !/^\d{4}-(0[1-9]|1[0-2])$/.test(periodMonth)) {
    throw adapterError("invalid_metadata", "A competência deve usar o formato AAAA-MM.");
  }
}

function isFinancialXlsxBinary(value: unknown): value is FinancialXlsxBinary {
  return value instanceof ArrayBuffer || value instanceof Uint8Array;
}

function binaryLength(binary: FinancialXlsxBinary) {
  return binary instanceof ArrayBuffer ? binary.byteLength : binary.byteLength;
}

function hasZipSignature(binary: FinancialXlsxBinary) {
  const bytes = binary instanceof ArrayBuffer
    ? new Uint8Array(binary, 0, Math.min(binary.byteLength, 4))
    : new Uint8Array(binary.buffer, binary.byteOffset, Math.min(binary.byteLength, 4));
  return bytes.length === 4
    && bytes[0] === 0x50
    && bytes[1] === 0x4b
    && bytes[2] === 0x03
    && bytes[3] === 0x04;
}

function validateRequest(request: FinancialXlsxExtractionRequest) {
  if (!request || !isFinancialXlsxBinary(request.binary)) {
    throw adapterError("empty_file", "O arquivo XLSX não foi informado.");
  }
  requireText(request.mapping?.id, "mapping.id");
  requireText(request.mapping?.version, "mapping.version");
  requireText(request.company?.name, "company.name");
  requireText(request.document?.fileName, "document.fileName");
  requireText(request.document?.etag, "document.etag");
  validatePeriod(request.periodMonth);

  if (request.mimeType && request.mimeType !== XLSX_MIME_TYPE) {
    throw adapterError("invalid_mime_type", "O arquivo deve possuir MIME type XLSX.");
  }

  const size = binaryLength(request.binary);
  if (size === 0) {
    throw adapterError("empty_file", "O arquivo XLSX está vazio.");
  }

  const maxFileSize = request.maxFileSize ?? DEFAULT_MAX_FILE_SIZE;
  if (!Number.isSafeInteger(maxFileSize) || maxFileSize <= 0) {
    throw adapterError("invalid_metadata", "O limite de tamanho do arquivo é inválido.");
  }
  if (size > maxFileSize) {
    throw adapterError("file_too_large", "O arquivo XLSX excede o limite permitido.");
  }
  if (!hasZipSignature(request.binary)) {
    throw adapterError("invalid_xlsx", "O conteúdo recebido não é um arquivo XLSX válido.");
  }
}

function resolveMapping(request: FinancialXlsxExtractionRequest) {
  const mapping = getFinancialXlsxMapping(request.mapping.id, request.mapping.version);
  if (!mapping) {
    throw adapterError(
      "unsupported_mapping",
      `Mapeamento financeiro não suportado: ${request.mapping.id}@${request.mapping.version}.`,
    );
  }
  return mapping;
}

async function runMapping(
  mapping: FinancialXlsxMapping,
  request: FinancialXlsxExtractionRequest,
) {
  try {
    return await mapping.parse(request.binary, {
      company: request.company,
      document: request.document,
      expectedPeriod: request.periodMonth,
      extractedAt: request.extractedAt,
    });
  } catch {
    throw adapterError("invalid_xlsx", "Não foi possível interpretar o arquivo XLSX recebido.");
  }
}

export async function extractFinancialXlsx(
  request: FinancialXlsxExtractionRequest,
): Promise<FinancialExtractionV1> {
  validateRequest(request);
  const mapping = resolveMapping(request);
  const result = await runMapping(mapping, request);

  return {
    ...result,
    status: "needs_review",
    publishable: false,
    metadata: {
      ...result.metadata,
      mapping: {
        id: mapping.id,
        version: mapping.version,
        parserVersion: mapping.parserVersion,
      },
    },
  };
}

export { XLSX_MIME_TYPE };
