import { readFile } from "node:fs/promises";

import {
  extractFinancialXlsx,
  type FinancialExtractionV1,
  type FinancialXlsxExtractionRequest,
} from "../financial-xlsx-adapter";

type ParseMessage = {
  filePath: string;
  request: Omit<FinancialXlsxExtractionRequest, "binary">;
};

const safeErrorNames = new Set([
  "empty_file",
  "file_too_large",
  "invalid_metadata",
  "invalid_mime_type",
  "invalid_xlsx",
  "unsupported_mapping",
]);

type ParseReply =
  | { ok: true; result: FinancialExtractionV1 }
  | { ok: false; error: { name: string; message: string } };

function sendReply(reply: ParseReply) {
  return new Promise<void>((resolve, reject) => {
    if (!process.send || !process.connected) {
      reject(new Error("Canal IPC indisponível."));
      return;
    }
    process.send(reply, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

process.once("message", async (message: ParseMessage) => {
  let reply: ParseReply;
  try {
    const binary = await readFile(message.filePath);
    const result = await extractFinancialXlsx({
      ...message.request,
      binary,
    });
    reply = { ok: true, result };
  } catch (error) {
    const name = error instanceof Error && safeErrorNames.has(error.name)
      ? error.name
      : "internal_parser_error";
    const errorMessage = error instanceof Error && safeErrorNames.has(error.name)
      ? error.message
      : "Falha interna durante o processamento do XLSX.";
    reply = { ok: false, error: { name, message: errorMessage } };
  }

  try {
    await sendReply(reply);
  } finally {
    process.disconnect?.();
  }
});
