import supabase from "../../lib/supabase/browser";

export interface MonthlyFinancialMetrics {
  id: string;
  year: number;
  month: number;
  revenue: number | null;
  net_profit: number | null;
  net_margin: number | null;
  cash_balance: number | null;
  created_at: string;
  updated_at: string;
}

export interface FinancialPeriod {
  year: number;
  month: number;
}

type FinancialMonthlyMetricsRow = Omit<
  MonthlyFinancialMetrics,
  "revenue" | "net_profit" | "net_margin" | "cash_balance"
> & {
  revenue: number | string | null;
  net_profit: number | string | null;
  net_margin: number | string | null;
  cash_balance: number | string | null;
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

function toMonthlyFinancialMetrics(
  metric: FinancialMonthlyMetricsRow | null
): MonthlyFinancialMetrics | null {
  if (!metric) {
    return null;
  }

  return {
    ...metric,
    revenue: metric.revenue === null ? null : Number(metric.revenue),
    net_profit: metric.net_profit === null ? null : Number(metric.net_profit),
    net_margin: metric.net_margin === null ? null : Number(metric.net_margin),
    cash_balance: metric.cash_balance === null ? null : Number(metric.cash_balance),
  };
}

export async function getMonthlyFinancialMetrics(
  year: number,
  month: number
): Promise<MonthlyFinancialMetrics | null> {
  assertValidPeriod(year, month);

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
  month: number
): Promise<MonthlyFinancialMetrics | null> {
  assertValidPeriod(year, month);

  const period = previousMonth(year, month);

  return getMonthlyFinancialMetrics(period.year, period.month);
}

export async function getAvailableFinancialPeriods(): Promise<FinancialPeriod[]> {
  const { data, error } = await supabase
    .from("financial_monthly_metrics")
    .select("year, month")
    .order("year", { ascending: false })
    .order("month", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as FinancialPeriod[];
}

export async function getFinancialMetricHistory(
  year: number,
  month: number,
  limit = 6
): Promise<MonthlyFinancialMetrics[]> {
  assertValidPeriod(year, month);

  const selectedMonthIndex = monthIndex({ year, month });
  const firstMonthIndex = selectedMonthIndex - Math.max(limit - 1, 0);

  const { data, error } = await supabase
    .from("financial_monthly_metrics")
    .select("*")
    .or(
      `and(year.eq.${year},month.lte.${month}),and(year.lt.${year})`
    )
    .order("year", { ascending: false })
    .order("month", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as FinancialMonthlyMetricsRow[])
    .map(toMonthlyFinancialMetrics)
    .filter((metric): metric is MonthlyFinancialMetrics => metric !== null)
    .filter((metric) => {
      const currentMonthIndex = monthIndex(metric);

      return (
        currentMonthIndex >= firstMonthIndex &&
        currentMonthIndex <= selectedMonthIndex
      );
    })
    .sort((current, next) => monthIndex(current) - monthIndex(next));
}
