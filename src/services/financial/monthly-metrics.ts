import supabase from "../../lib/supabase/browser";
import {
  getPublishedFinancialPeriods,
  getPublishedMetricHistory,
  getPublishedMonthlyMetrics,
} from "./published-monthly-metrics";

export type FinancialDataState = "approved" | "pending" | "missing" | "unverified";

export interface MonthlyFinancialMetrics {
  id: string;
  company_id: string | null;
  period_month: string;
  year: number;
  month: number;
  revenue: number | null;
  expenses: number | null;
  net_profit: number | null;
  net_margin: number | null;
  cash_balance: number | null;
  cash_inflows: number | null;
  cash_outflows: number | null;
  net_revenue: number | null;
  costs: number | null;
  operating_expenses: number | null;
  financial_expenses: number | null;
  data_state: FinancialDataState;
  source_document_id: string | null;
  source_etag: string | null;
  approved_at: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface FinancialPeriod {
  year: number;
  month: number;
}

type FinancialMonthlyMetricsRow = Omit<
  MonthlyFinancialMetrics,
  | "company_id"
  | "period_month"
  | "expenses"
  | "data_state"
  | "source_document_id"
  | "source_etag"
  | "approved_at"
  | "published_at"
  | "revenue"
  | "net_profit"
  | "net_margin"
  | "cash_balance"
  | "cash_inflows"
  | "cash_outflows"
  | "net_revenue"
  | "costs"
  | "operating_expenses"
  | "financial_expenses"
> & {
  revenue: number | string | null;
  net_profit: number | string | null;
  net_margin: number | string | null;
  cash_balance: number | string | null;
  cash_inflows: number | string | null;
  cash_outflows: number | string | null;
  net_revenue: number | string | null;
  costs: number | string | null;
  operating_expenses: number | string | null;
  financial_expenses: number | string | null;
};

function assertValidPeriod(year: number, month: number) {
  if (!Number.isInteger(year) || !Number.isInteger(month)) {
    throw new Error("Year and month must be integers.");
  }

  if (month < 1 || month > 12) {
    throw new Error("Month must be between 1 and 12.");
  }
}

function previousMonth(year: number, month: number): FinancialPeriod {
  if (month === 1) {
    return {
      year: year - 1,
      month: 12,
    };
  }

  return {
    year,
    month: month - 1,
  };
}

function monthIndex(period: FinancialPeriod) {
  return period.year * 12 + period.month;
}

function isMeaningfulNumber(value: number | null) {
  return value !== null && Number.isFinite(value) && value !== 0;
}

function isMeaningfulFinancialMetric(metric: MonthlyFinancialMetrics) {
  // Placeholder rows can exist with every financial metric empty/defaulted to zero.
  // A period is available only when at least one primary recorded metric is real.
  return [
    metric.revenue,
    metric.net_profit,
    metric.net_margin,
    metric.cash_balance,
  ].some(isMeaningfulNumber);
}

function toMonthlyFinancialMetrics(
  metric: FinancialMonthlyMetricsRow | null
): MonthlyFinancialMetrics | null {
  if (!metric) {
    return null;
  }

  return {
    ...metric,
    company_id: null,
    period_month: `${metric.year}-${String(metric.month).padStart(2, "0")}-01`,
    expenses: null,
    revenue: metric.revenue === null ? null : Number(metric.revenue),
    net_profit: metric.net_profit === null ? null : Number(metric.net_profit),
    net_margin: metric.net_margin === null ? null : Number(metric.net_margin),
    cash_balance: metric.cash_balance === null ? null : Number(metric.cash_balance),
    cash_inflows: metric.cash_inflows === null ? null : Number(metric.cash_inflows),
    cash_outflows: metric.cash_outflows === null ? null : Number(metric.cash_outflows),
    net_revenue: metric.net_revenue === null ? null : Number(metric.net_revenue),
    costs: metric.costs === null ? null : Number(metric.costs),
    operating_expenses:
      metric.operating_expenses === null ? null : Number(metric.operating_expenses),
    financial_expenses:
      metric.financial_expenses === null ? null : Number(metric.financial_expenses),
    data_state: "unverified",
    source_document_id: null,
    source_etag: null,
    approved_at: null,
    published_at: null,
  };
}

export async function getMonthlyFinancialMetrics(
  year: number,
  month: number,
  companyId?: string
): Promise<MonthlyFinancialMetrics | null> {
  assertValidPeriod(year, month);

  if (companyId) {
    return getPublishedMonthlyMetrics(companyId, year, month);
  }

  const { data, error } = await supabase
    .from("financial_monthly_metrics")
    .select("*")
    .eq("year", year)
    .eq("month", month)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return toMonthlyFinancialMetrics(data as FinancialMonthlyMetricsRow | null);
}

export async function getPreviousMonthFinancialMetrics(
  year: number,
  month: number,
  companyId?: string
): Promise<MonthlyFinancialMetrics | null> {
  assertValidPeriod(year, month);

  const period = previousMonth(year, month);

  return getMonthlyFinancialMetrics(period.year, period.month, companyId);
}

export async function getAvailableFinancialPeriods(
  companyId?: string
): Promise<FinancialPeriod[]> {
  if (companyId) {
    return getPublishedFinancialPeriods(companyId);
  }

  const { data, error } = await supabase
    .from("financial_monthly_metrics")
    .select("*")
    .order("year", { ascending: false })
    .order("month", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as FinancialMonthlyMetricsRow[])
    .map(toMonthlyFinancialMetrics)
    .filter((metric): metric is MonthlyFinancialMetrics => metric !== null)
    .filter(isMeaningfulFinancialMetric)
    .map((metric) => ({
      year: metric.year,
      month: metric.month,
    }));
}

export async function getFinancialMetricHistory(
  year: number,
  month: number,
  limit = 6,
  companyId?: string
): Promise<MonthlyFinancialMetrics[]> {
  assertValidPeriod(year, month);

  if (companyId) {
    return getPublishedMetricHistory(companyId, year, month, limit);
  }

  const selectedMonthIndex = monthIndex({ year, month });

  const { data, error } = await supabase
    .from("financial_monthly_metrics")
    .select("*")
    .or(
      `and(year.eq.${year},month.lte.${month}),and(year.lt.${year})`
    )
    .order("year", { ascending: false })
    .order("month", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as FinancialMonthlyMetricsRow[])
    .map(toMonthlyFinancialMetrics)
    .filter((metric): metric is MonthlyFinancialMetrics => metric !== null)
    .filter(isMeaningfulFinancialMetric)
    .filter((metric) => {
      const currentMonthIndex = monthIndex(metric);

      return currentMonthIndex <= selectedMonthIndex;
    })
    .slice(0, limit)
    .sort((current, next) => monthIndex(current) - monthIndex(next));
}
