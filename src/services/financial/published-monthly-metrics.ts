import supabase from "../../lib/supabase/browser";
import type {
  FinancialDataState,
  FinancialPeriod,
  MonthlyFinancialMetrics,
} from "./monthly-metrics";

interface PublishedMonthlyMetricsRow {
  id: string;
  company_id: string;
  period_month: string;
  revenue: number | string | null;
  expenses: number | string | null;
  net_profit: number | string | null;
  net_margin: number | string | null;
  cash_balance: number | string | null;
  source_document_id: string;
  source_etag: string;
  approved_at: string;
  published_at: string;
}

interface PublicationStatusResult {
  state?: "approved" | "pending" | "missing";
}

const publishedColumns = [
  "id",
  "company_id",
  "period_month",
  "revenue",
  "expenses",
  "net_profit",
  "net_margin",
  "cash_balance",
  "source_document_id",
  "source_etag",
  "approved_at",
  "published_at",
].join(", ");

function periodMonth(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

function periodFromDate(value: string): FinancialPeriod {
  const [year, month] = value.slice(0, 7).split("-").map(Number);
  return { year, month };
}

function shiftMonth(year: number, month: number, offset: number): FinancialPeriod {
  const date = new Date(Date.UTC(year, month - 1 + offset, 1));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
}

function toNumber(value: number | string | null) {
  if (value === null) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toPublishedMetrics(row: PublishedMonthlyMetricsRow): MonthlyFinancialMetrics {
  const period = periodFromDate(row.period_month);

  return {
    id: row.id,
    company_id: row.company_id,
    period_month: row.period_month,
    year: period.year,
    month: period.month,
    revenue: toNumber(row.revenue),
    expenses: toNumber(row.expenses),
    net_profit: toNumber(row.net_profit),
    net_margin: toNumber(row.net_margin),
    cash_balance: toNumber(row.cash_balance),
    cash_inflows: null,
    cash_outflows: null,
    net_revenue: null,
    costs: null,
    operating_expenses: null,
    financial_expenses: null,
    data_state: "approved",
    source_document_id: row.source_document_id,
    source_etag: row.source_etag,
    approved_at: row.approved_at,
    published_at: row.published_at,
    created_at: row.published_at,
    updated_at: row.published_at,
  };
}

function createUnavailableMetrics(
  companyId: string,
  year: number,
  month: number,
  state: Extract<FinancialDataState, "pending" | "missing">
): MonthlyFinancialMetrics {
  return {
    id: "",
    company_id: companyId,
    period_month: periodMonth(year, month),
    year,
    month,
    revenue: null,
    expenses: null,
    net_profit: null,
    net_margin: null,
    cash_balance: null,
    cash_inflows: null,
    cash_outflows: null,
    net_revenue: null,
    costs: null,
    operating_expenses: null,
    financial_expenses: null,
    data_state: state,
    source_document_id: null,
    source_etag: null,
    approved_at: null,
    published_at: null,
    created_at: "",
    updated_at: "",
  };
}

async function getPublicationState(companyId: string, year: number, month: number) {
  const { data, error } = await supabase.rpc("finance_monthly_publication_status", {
    p_company_id: companyId,
    p_period_month: periodMonth(year, month),
  });

  if (error) {
    throw new Error(error.message);
  }

  return (data as PublicationStatusResult | null)?.state === "pending"
    ? "pending"
    : "missing";
}

export async function getPublishedMonthlyMetrics(
  companyId: string,
  year: number,
  month: number
) {
  const { data, error } = await supabase
    .from("financial_monthly_metrics_published")
    .select(publishedColumns)
    .eq("company_id", companyId)
    .eq("period_month", periodMonth(year, month))
    .maybeSingle()
    .overrideTypes<PublishedMonthlyMetricsRow | null, { merge: false }>();

  if (error) {
    throw new Error(error.message);
  }

  if (data) {
    return toPublishedMetrics(data);
  }

  return createUnavailableMetrics(
    companyId,
    year,
    month,
    await getPublicationState(companyId, year, month)
  );
}

export async function getPublishedFinancialPeriods(companyId: string) {
  const { data, error } = await supabase
    .from("financial_monthly_metrics_published")
    .select("period_month")
    .eq("company_id", companyId)
    .order("period_month", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((item) => periodFromDate(item.period_month as string));
}

export async function getPublishedMetricHistory(
  companyId: string,
  year: number,
  month: number,
  limit: number
) {
  const firstPeriod = shiftMonth(year, month, -(limit - 1));
  const { data, error } = await supabase
    .from("financial_monthly_metrics_published")
    .select(publishedColumns)
    .eq("company_id", companyId)
    .gte("period_month", periodMonth(firstPeriod.year, firstPeriod.month))
    .lte("period_month", periodMonth(year, month))
    .order("period_month", { ascending: true })
    .overrideTypes<PublishedMonthlyMetricsRow[], { merge: false }>();

  if (error) {
    throw new Error(error.message);
  }

  const metricsByPeriod = new Map(
    (data ?? []).map((row) => [row.period_month.slice(0, 7), toPublishedMetrics(row)])
  );

  return Array.from({ length: limit }, (_, index) => {
    const period = shiftMonth(firstPeriod.year, firstPeriod.month, index);
    const key = `${period.year}-${String(period.month).padStart(2, "0")}`;

    return metricsByPeriod.get(key)
      ?? createUnavailableMetrics(companyId, period.year, period.month, "missing");
  });
}
