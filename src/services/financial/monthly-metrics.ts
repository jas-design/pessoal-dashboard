import supabase from "../../lib/supabase/browser";

export interface MonthlyFinancialMetrics {
  id: string;
  year: number;
  month: number;
  revenue: number;
  net_profit: number;
  net_margin: number;
  cash_balance: number;
  created_at: string;
  updated_at: string;
}

export interface FinancialPeriod {
  year: number;
  month: number;
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
  metric: MonthlyFinancialMetrics | null
) {
  if (!metric) {
    return null;
  }

  return {
    ...metric,
    revenue: Number(metric.revenue),
    net_profit: Number(metric.net_profit),
    net_margin: Number(metric.net_margin),
    cash_balance: Number(metric.cash_balance),
  };
}

export async function getMonthlyFinancialMetrics(
  year: number,
  month: number
) {
  const { data, error } = await supabase
    .from("financial_monthly_metrics")
    .select("*")
    .eq("year", year)
    .eq("month", month)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return toMonthlyFinancialMetrics(data as MonthlyFinancialMetrics | null);
}

export async function getPreviousMonthFinancialMetrics(
  year: number,
  month: number
) {
  const period = previousMonth(year, month);

  return getMonthlyFinancialMetrics(period.year, period.month);
}

export async function getAvailableFinancialPeriods() {
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
) {
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

  return ((data ?? []) as MonthlyFinancialMetrics[])
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
