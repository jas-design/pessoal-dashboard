import {
  KAWANA_PARSER_VERSION,
  KAWANA_PARSER_V2_VERSION,
  parseKawanaWorkbook,
  parseKawanaWorkbookV2,
  type KawanaParseResult,
  type ParserContext,
} from "./kawana-xlsx-parser";

export interface FinancialXlsxMapping {
  id: string;
  version: string;
  parserVersion: string;
  parse: (
    binary: Buffer | Uint8Array | ArrayBuffer,
    context: ParserContext,
  ) => Promise<KawanaParseResult>;
}

const financialXlsxMappings: FinancialXlsxMapping[] = [
  {
    id: "kawana-management-report",
    version: "1",
    parserVersion: KAWANA_PARSER_VERSION,
    parse: parseKawanaWorkbook,
  },
  {
    id: "kawana-management-report",
    version: "2",
    parserVersion: KAWANA_PARSER_V2_VERSION,
    parse: parseKawanaWorkbookV2,
  },
];

export function getFinancialXlsxMapping(id: string, version: string) {
  return financialXlsxMappings.find(
    (mapping) => mapping.id === id && mapping.version === version,
  ) ?? null;
}

export function listFinancialXlsxMappings() {
  return financialXlsxMappings.map(({ id, version, parserVersion }) => ({
    id,
    version,
    parserVersion,
  }));
}
