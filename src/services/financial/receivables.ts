export type ReceivableFilters = Record<never, never>;

export interface ReceivableAgingSummary {
  due: number | null;
  overdue1To15: number | null;
  overdue16To30: number | null;
  overdue31To45: number | null;
  overdue45Plus: number | null;
}

export interface ReceivableSummary {
  totalOpen: number | null;
  openCount: number | null;
  totalOverdue: number | null;
  overdueCount: number | null;
  receivedInMonth: number | null;
  aging: ReceivableAgingSummary | null;
}

export type FinancialReceivable = Record<never, never>;

function createUnavailableError() {
  return new Error(
    "financial_accounts_receivable is not available in the audited database schema."
  );
}

export async function getReceivables(
  _filters: ReceivableFilters = {}
): Promise<FinancialReceivable[]> {
  throw createUnavailableError();
}

export async function getReceivableSummary(
  _year: number,
  _month: number,
  _companyId?: string
): Promise<ReceivableSummary> {
  throw createUnavailableError();
}
