import supabase from "../../lib/supabase/browser";

export interface MonthlyFinancialSummary {
  id: string;
  year: number;
  month: number;
  accounts_receivable: number | null;
  accounts_receivable_open_count: number | null;
  accounts_payable: number | null;
  accounts_payable_open_count: number | null;
  current_ratio: number | null;
  debt_ratio: number | null;
  created_at: string;
  updated_at: string;
}

type MonthlyFinancialSummaryRow = Omit<
  MonthlyFinancialSummary,
  | "accounts_receivable"
  | "accounts_receivable_open_count"
  | "accounts_payable"
  | "accounts_payable_open_count"
  | "current_ratio"
  | "debt_ratio"
> & {
  accounts_receivable: number | string | null;
  accounts_receivable_open_count: number | string | null;
  accounts_payable: number | string | null;
  accounts_payable_open_count: number | string | null;
  current_ratio: number | string | null;
  debt_ratio: number | string | null;
};

function assertValidPeriod(year: number, month: number) {
  if (!Number.isInteger(year) || !Number.isInteger(month)) {
    throw new Error("Year and month must be integers.");
  }

  if (month < 1 || month > 12) {
    throw new Error("Month must be between 1 and 12.");
  }
}

function toNumber(value: number | string | null) {
  return value === null ? null : Number(value);
}

function toMonthlyFinancialSummary(
  summary: MonthlyFinancialSummaryRow | null
): MonthlyFinancialSummary | null {
  if (!summary) {
    return null;
  }

  return {
    ...summary,
    accounts_receivable: toNumber(summary.accounts_receivable),
    accounts_receivable_open_count: toNumber(summary.accounts_receivable_open_count),
    accounts_payable: toNumber(summary.accounts_payable),
    accounts_payable_open_count: toNumber(summary.accounts_payable_open_count),
    current_ratio: toNumber(summary.current_ratio),
    debt_ratio: toNumber(summary.debt_ratio),
  };
}

export async function getMonthlyFinancialSummary(
  year: number,
  month: number
): Promise<MonthlyFinancialSummary | null> {
  assertValidPeriod(year, month);

  const { data, error } = await supabase
    .from("financial_monthly_summary")
    .select("*")
    .eq("year", year)
    .eq("month", month)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return toMonthlyFinancialSummary(data as MonthlyFinancialSummaryRow | null);
}
