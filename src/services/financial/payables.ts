export type PayableFilters = Record<never, never>;

export interface PayableAgingSummary {
  due: number | null;
  overdue1To15: number | null;
  overdue16To30: number | null;
  overdue31To45: number | null;
  overdue45Plus: number | null;
}

export interface PayableSummary {
  totalOpen: number | null;
  openCount: number | null;
  totalOverdue: number | null;
  overdueCount: number | null;
  paidInMonth: number | null;
  aging: PayableAgingSummary | null;
}

export type FinancialPayable = Record<never, never>;

function createUnavailableError() {
  return new Error(
    "financial_accounts_payable is not available in the audited database schema."
  );
}

export async function getPayables(
  _filters: PayableFilters = {}
): Promise<FinancialPayable[]> {
  throw createUnavailableError();
}

export async function getPayableSummary(
  _year: number,
  _month: number,
  _companyId?: string
): Promise<PayableSummary> {
  throw createUnavailableError();
}
