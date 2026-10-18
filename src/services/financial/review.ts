import supabase from "../../lib/supabase/browser";

export type FinanceReviewStatus =
  | "pending_review"
  | "approved"
  | "rejected"
  | "all";

export type FinanceReviewDecision = "approve" | "reject";
export type FinanceSourceRole = "primary" | "supporting" | "unclassified";

export interface FinanceReviewRow {
  id: string;
  document_id: string;
  source_etag: string | null;
  company_id: string | null;
  company_name: string | null;
  source_company_name: string | null;
  period_month: string | null;
  metric: string;
  amount: number | string;
  currency: string | null;
  file_name: string;
  sheet_name: string | null;
  source_row: number | null;
  review_status: Exclude<FinanceReviewStatus, "all">;
  review_revision: number;
  review_note: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  created_at: string;
  source_usage_role: FinanceSourceRole;
  source_version_current: boolean;
  is_deleted: boolean;
}

export interface FinanceReviewListResult {
  total: number;
  items: FinanceReviewRow[];
}

export interface FinanceReviewHistoryItem {
  id: string;
  event_type: "approve" | "reject" | "classify_source" | string;
  old_value: string | null;
  new_value: string | null;
  reason: string;
  actor_id: string;
  created_at: string;
}

interface FinanceReviewDecisionResult {
  success: boolean;
  row_id: string;
  review_status: "approved" | "rejected";
  review_revision: number;
  finance_dashboard_updated: false;
}

interface FinanceReviewDocumentRoleResult {
  success: boolean;
  changed: boolean;
  usage_role: FinanceSourceRole;
}

function requireReason(reason: string) {
  const normalizedReason = reason.trim();

  if (normalizedReason.length < 8 || normalizedReason.length > 500) {
    throw new Error("Informe uma justificativa entre 8 e 500 caracteres.");
  }

  return normalizedReason;
}

function rpcError(error: { code?: string; message: string }) {
  const result = new Error(error.message);

  if (error.code === "42501" || /permission denied|nao autorizad/i.test(error.message)) {
    result.name = "FinanceReviewAccessDeniedError";
  } else if (/jwt|session|autentica/i.test(error.message)) {
    result.name = "FinanceReviewAuthenticationError";
  } else {
    result.name = "FinanceReviewServiceError";
  }

  return result;
}

function isReviewRow(value: unknown): value is FinanceReviewRow {
  if (!value || typeof value !== "object") return false;

  const row = value as Partial<FinanceReviewRow>;
  const validStatus = row.review_status === "pending_review"
    || row.review_status === "approved"
    || row.review_status === "rejected";
  const validRole = row.source_usage_role === "primary"
    || row.source_usage_role === "supporting"
    || row.source_usage_role === "unclassified";

  return typeof row.id === "string"
    && typeof row.document_id === "string"
    && typeof row.metric === "string"
    && (typeof row.amount === "number" || typeof row.amount === "string")
    && typeof row.file_name === "string"
    && validStatus
    && Number.isInteger(row.review_revision)
    && validRole
    && typeof row.source_version_current === "boolean"
    && typeof row.is_deleted === "boolean";
}

function ensureListResult(value: unknown): FinanceReviewListResult {
  if (!value || typeof value !== "object") {
    throw new Error("A fila de revisao retornou um formato inesperado.");
  }

  const result = value as Partial<FinanceReviewListResult>;

  if (
    !Array.isArray(result.items)
    || typeof result.total !== "number"
    || !Number.isSafeInteger(result.total)
    || result.total < 0
    || !result.items.every(isReviewRow)
  ) {
    throw new Error("A fila de revisao retornou um formato inesperado.");
  }

  return { total: result.total, items: result.items as FinanceReviewRow[] };
}

export async function listFinanceReviews(
  status: FinanceReviewStatus,
  limit = 20,
  offset = 0
) {
  const { data, error } = await supabase.rpc("finance_review_list", {
    p_status: status,
    p_limit: limit,
    p_offset: offset,
  });

  if (error) {
    throw rpcError(error);
  }

  return ensureListResult(data);
}

export async function decideFinanceReview(
  row: FinanceReviewRow,
  action: FinanceReviewDecision,
  reason: string
) {
  const { data, error } = await supabase.rpc("finance_review_decide", {
    p_row_id: row.id,
    p_action: action,
    p_reason: requireReason(reason),
    p_expected_revision: row.review_revision,
  });

  if (error) {
    throw rpcError(error);
  }

  return data as FinanceReviewDecisionResult;
}

export async function setFinanceReviewDocumentRole(
  documentId: string,
  usageRole: FinanceSourceRole,
  reason: string
) {
  const { data, error } = await supabase.rpc(
    "finance_review_set_document_role",
    {
      p_document_id: documentId,
      p_usage_role: usageRole,
      p_reason: requireReason(reason),
    }
  );

  if (error) {
    throw rpcError(error);
  }

  return data as FinanceReviewDocumentRoleResult;
}

export async function getFinanceReviewHistory(rowId: string, limit = 20) {
  const { data, error } = await supabase.rpc("finance_review_history", {
    p_row_id: rowId,
    p_limit: limit,
  });

  if (error) {
    throw rpcError(error);
  }

  if (!Array.isArray(data)) {
    throw new Error("O historico retornou um formato inesperado.");
  }

  return data as FinanceReviewHistoryItem[];
}
