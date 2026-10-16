import {
  getReliableCashInflows,
  getReliableCashOutflows,
  getReliableExpenses,
  getReliableRevenue,
  isRealFinancialNumber,
} from "./financial-calculations";
import {
  getAvailableFinancialPeriods,
  getMonthlyFinancialMetrics,
  type FinancialPeriod,
  type MonthlyFinancialMetrics,
} from "./monthly-metrics";
import { getPayableSummary, type PayableSummary } from "./payables";
import { formatMonthYear } from "./period-format";
import { getReceivableSummary, type ReceivableSummary } from "./receivables";
import {
  getTransactionMonthlySummary,
  type TransactionMonthlySummary,
} from "./transactions";

type ReportType =
  | "summary"
  | "revenue-expenses"
  | "cash-flow"
  | "receivables"
  | "payables";

function formatCurrency(value: number | null | undefined) {
  if (!isRealFinancialNumber(value)) {
    return "Sem dados";
  }

  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
  });
}

function formatPercent(value: number | null | undefined) {
  if (!isRealFinancialNumber(value)) {
    return "Sem dados";
  }

  return `${value.toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
}

function formatCount(value: number | null | undefined) {
  if (!isRealFinancialNumber(value)) {
    return "Sem dados";
  }

  return value.toLocaleString("pt-BR");
}

function readSelectedPeriod(): FinancialPeriod | null {
  const params = new URLSearchParams(window.location.search);
  const year = Number(params.get("year"));
  const month = Number(params.get("month"));

  if (!Number.isInteger(year) || !Number.isInteger(month)) {
    return null;
  }

  if (month < 1 || month > 12) {
    return null;
  }

  return { year, month };
}

function readCurrentPeriod(): FinancialPeriod {
  const now = new Date();

  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
  };
}

function readSelectedCompany() {
  return new URLSearchParams(window.location.search).get("company") || undefined;
}

function readSelectedReport(): ReportType {
  const report = new URLSearchParams(window.location.search).get("report");

  if (
    report === "revenue-expenses" ||
    report === "cash-flow" ||
    report === "receivables" ||
    report === "payables"
  ) {
    return report;
  }

  return "summary";
}

function preservePeriodInUrl(period: FinancialPeriod) {
  const url = new URL(window.location.href);

  if (url.searchParams.get("year") && url.searchParams.get("month")) {
    return;
  }

  url.searchParams.set("year", String(period.year));
  url.searchParams.set("month", String(period.month));
  window.history.replaceState({}, "", url);
}

function bindReportTypeSelect() {
  const select = document.querySelector<HTMLSelectElement>("[data-report-type]");

  if (!select) {
    return;
  }

  select.value = readSelectedReport();
  select.addEventListener("change", () => {
    const url = new URL(window.location.href);

    url.searchParams.set("report", select.value);
    window.location.href = url.toString();
  });
}

function updateVisibleReport() {
  const selectedReport = readSelectedReport();

  document.querySelectorAll<HTMLElement>("[data-report-section]").forEach((section) => {
    section.hidden = section.dataset.reportSection !== selectedReport;
  });
}

function updateCompanyFallback() {
  const select = document.querySelector<HTMLSelectElement>("[data-report-company]");
  const companyId = readSelectedCompany();

  if (!select) {
    return;
  }

  select.replaceChildren(
    new Option(
      companyId
        ? "Empresa preservada pela URL; cadastro nao disponivel"
        : "Empresas nao vinculadas aos dados financeiros",
      companyId ?? ""
    )
  );
  select.value = companyId ?? "";
  select.disabled = true;
}

function setText(selector: string, text: string) {
  document.querySelectorAll<HTMLElement>(selector).forEach((element) => {
    element.textContent = text;
  });
}

function setValue(key: string, value: string) {
  setText(`[data-report-value="${key}"]`, value);
}

function updateReportMeta(period: FinancialPeriod) {
  setValue("period", formatMonthYear(period.year, period.month));
  setValue("generated_at", new Date().toLocaleDateString("pt-BR"));
}

function updateFinancialSummary(
  metrics: MonthlyFinancialMetrics | null,
  transactionSummary: TransactionMonthlySummary
) {
  const revenue = getReliableRevenue(metrics, transactionSummary);
  const expenses = getReliableExpenses(metrics, transactionSummary);
  const cashInflows = getReliableCashInflows(metrics, transactionSummary);
  const cashOutflows = getReliableCashOutflows(metrics, transactionSummary);

  setValue("summary_revenue", formatCurrency(revenue));
  setValue("summary_expenses", formatCurrency(expenses));
  setValue("summary_net_profit", formatCurrency(metrics?.net_profit));
  setValue("summary_net_margin", formatPercent(metrics?.net_margin));
  setValue("summary_cash_balance", formatCurrency(metrics?.cash_balance));
  setValue("summary_cash_inflows", formatCurrency(cashInflows));
  setValue("summary_cash_outflows", formatCurrency(cashOutflows));
  setValue("summary_transaction_count", formatCount(transactionSummary.transactionCount));

  setValue("revenue_expenses_revenue", formatCurrency(revenue));
  setValue("revenue_expenses_expenses", formatCurrency(expenses));
  setValue("revenue_expenses_net_profit", formatCurrency(metrics?.net_profit));
  setValue("revenue_expenses_net_margin", formatPercent(metrics?.net_margin));

  setValue("cash_flow_inflows", formatCurrency(cashInflows));
  setValue("cash_flow_outflows", formatCurrency(cashOutflows));
  setValue("cash_flow_balance", formatCurrency(metrics?.cash_balance));
}

function updateReceivablesSummary(summary: ReceivableSummary | null) {
  setValue("receivables_total_open", formatCurrency(summary?.totalOpen));
  setValue("receivables_open_count", formatCount(summary?.openCount));
  setValue("receivables_total_overdue", formatCurrency(summary?.totalOverdue));
  setValue("receivables_overdue_count", formatCount(summary?.overdueCount));
  setValue("receivables_received_month", formatCurrency(summary?.receivedInMonth));
}

function updatePayablesSummary(summary: PayableSummary | null) {
  setValue("payables_total_open", formatCurrency(summary?.totalOpen));
  setValue("payables_open_count", formatCount(summary?.openCount));
  setValue("payables_total_overdue", formatCurrency(summary?.totalOverdue));
  setValue("payables_overdue_count", formatCount(summary?.overdueCount));
  setValue("payables_paid_month", formatCurrency(summary?.paidInMonth));
}

function showLoadError() {
  document.querySelector<HTMLElement>("[data-report-error]")?.removeAttribute("hidden");
  document.querySelectorAll<HTMLElement>("[data-report-value]").forEach((element) => {
    if (element.textContent === "Carregando...") {
      element.textContent = "Sem dados";
    }
  });
}

export async function loadReportsPage() {
  updateCompanyFallback();
  bindReportTypeSelect();
  updateVisibleReport();

  try {
    const periods = await getAvailableFinancialPeriods();
    const selectedPeriod = readSelectedPeriod() ?? periods[0] ?? readCurrentPeriod();
    const companyId = readSelectedCompany();

    preservePeriodInUrl(selectedPeriod);
    updateReportMeta(selectedPeriod);

    const [metrics, transactionSummary, receivablesResult, payablesResult] =
      await Promise.all([
        getMonthlyFinancialMetrics(selectedPeriod.year, selectedPeriod.month),
        getTransactionMonthlySummary(selectedPeriod.year, selectedPeriod.month, companyId),
        getReceivableSummary(selectedPeriod.year, selectedPeriod.month, companyId).catch(
          () => null
        ),
        getPayableSummary(selectedPeriod.year, selectedPeriod.month, companyId).catch(
          () => null
        ),
      ]);

    updateFinancialSummary(metrics, transactionSummary);
    updateReceivablesSummary(receivablesResult);
    updatePayablesSummary(payablesResult);
  } catch (error) {
    console.error(
      "Erro ao carregar relatorios financeiros:",
      error instanceof Error ? error.message : error
    );
    showLoadError();
  }
}
