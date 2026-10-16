import { getPayables, getPayableSummary } from "./payables";
import { formatMonthYear } from "./period-format";
import { getReceivables, getReceivableSummary } from "./receivables";
import {
  getAvailableFinancialPeriods,
  getFinancialMetricHistory,
  getMonthlyFinancialMetrics,
  type FinancialPeriod,
  type MonthlyFinancialMetrics,
} from "./monthly-metrics";
import {
  getReliableExpenses,
  getReliableRevenue,
  isRealFinancialNumber,
} from "./financial-calculations";
import {
  getTransactions,
  getTransactionMonthlySummaries,
  getTransactionMonthlySummary,
  type FinancialTransaction,
  type TransactionMonthlyPeriodSummary,
  type TransactionMonthlySummary,
} from "./transactions";

type FinanceiroView = "overview" | "receber" | "pagar" | "movimentacoes";
type OperationalTable = "receivables" | "payables" | "transactions";

const state = {
  transactionsSearch: "",
  transactionsType: "",
  transactionsCategory: "",
  transactions: [] as FinancialTransaction[],
};

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

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "Sem data";
  }

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return "Sem data";
  }

  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatShortMonthYear(year: number, month: number) {
  return formatMonthYear(year, month).replace("/20", "/");
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

function readSelectedView(): FinanceiroView {
  const view = new URLSearchParams(window.location.search).get("view");

  if (view === "receber" || view === "pagar" || view === "movimentacoes") {
    return view;
  }

  return "overview";
}

function getMonthRange(year: number, month: number) {
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  return { startDate, endDate };
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

function updateCompanyFallback() {
  const select = document.querySelector<HTMLSelectElement>("[data-financeiro-company]");
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

function updateViewLinks() {
  const currentUrl = new URL(window.location.href);
  const links = document.querySelectorAll<HTMLAnchorElement>("[data-financeiro-view-link]");
  const selectedView = readSelectedView();

  links.forEach((link) => {
    const view = link.dataset.financeiroViewLink || "overview";
    const url = new URL("/financeiro", window.location.origin);

    currentUrl.searchParams.forEach((value, key) => {
      if (key !== "view") {
        url.searchParams.set(key, value);
      }
    });

    if (view !== "overview") {
      url.searchParams.set("view", view);
    }

    link.href = `${url.pathname}${url.search}`;
    link.classList.toggle("is-active", view === selectedView);
    link.setAttribute("aria-selected", view === selectedView ? "true" : "false");
  });
}

function updateVisibleView() {
  const selectedView = readSelectedView();
  const views = document.querySelectorAll<HTMLElement>("[data-financeiro-view]");

  views.forEach((view) => {
    view.hidden = view.dataset.financeiroView !== selectedView;
  });
}

function setText(selector: string, text: string) {
  document.querySelectorAll<HTMLElement>(selector).forEach((element) => {
    element.textContent = text;
  });
}

function setValue(key: string, value: string) {
  setText(`[data-financeiro-value="${key}"]`, value);
}

function setCount(key: string, value: string) {
  setText(`[data-financeiro-count="${key}"]`, value);
}

function setTableMessage(table: OperationalTable, title: string, message: string) {
  const empty = document.querySelector<HTMLElement>(`[data-financeiro-${table}-empty]`);
  const body = document.querySelector<HTMLTableSectionElement>(
    `[data-financeiro-${table}-body]`
  );

  if (body) {
    body.replaceChildren();
  }

  if (!empty) {
    return;
  }

  empty.querySelector("h3")?.replaceChildren(title);
  empty.querySelector("p")?.replaceChildren(message);
  empty.hidden = false;
}

function setTableEmpty(table: OperationalTable, isEmpty: boolean) {
  const empty = document.querySelector<HTMLElement>(`[data-financeiro-${table}-empty]`);

  if (empty) {
    empty.hidden = !isEmpty;
  }
}

function createCell(text: string, className?: string) {
  const cell = document.createElement("td");
  cell.textContent = text;

  if (className) {
    cell.className = className;
  }

  return cell;
}

function createTransactionRow(transaction: FinancialTransaction) {
  const row = document.createElement("tr");
  const amount =
    transaction.amount === null
      ? null
      : transaction.type === "expense"
        ? -Math.abs(transaction.amount)
        : transaction.amount;
  const amountClass = transaction.type === "income" ? "is-positive" : "is-negative";
  const typeLabel = transaction.type === "income" ? "Receita" : "Despesa";

  row.append(
    createCell(formatDate(transaction.transaction_date)),
    createCell(transaction.description || "Sem descricao"),
    createCell(transaction.category || "Sem categoria"),
    createCell(typeLabel),
    createCell(formatCurrency(amount), amountClass),
    createCell(transaction.status || "Sem status")
  );

  return row;
}

function matchesTransactionFilters(transaction: FinancialTransaction) {
  const searchableText = [transaction.description, transaction.category, transaction.status]
    .join(" ")
    .toLowerCase();

  if (state.transactionsSearch && !searchableText.includes(state.transactionsSearch)) {
    return false;
  }

  if (state.transactionsType && transaction.type !== state.transactionsType) {
    return false;
  }

  if (state.transactionsCategory && transaction.category !== state.transactionsCategory) {
    return false;
  }

  return true;
}

function renderTransactionsTable() {
  const body = document.querySelector<HTMLTableSectionElement>(
    "[data-financeiro-transactions-body]"
  );

  if (!body) {
    return;
  }

  const filteredTransactions = state.transactions.filter(matchesTransactionFilters);

  body.replaceChildren(...filteredTransactions.map(createTransactionRow));
  setTableEmpty("transactions", filteredTransactions.length === 0);
}

function fillTransactionCategoryFilter(transactions: FinancialTransaction[]) {
  const select = document.querySelector<HTMLSelectElement>(
    '[data-financeiro-filter="transactions-category"]'
  );
  const firstOption = select?.querySelector("option");

  if (!select || !firstOption) {
    return;
  }

  const categories = Array.from(
    new Set(
      transactions
        .map((transaction) => transaction.category)
        .filter((category): category is string => Boolean(category))
    )
  ).sort((current, next) => current.localeCompare(next, "pt-BR"));

  select.replaceChildren(firstOption);

  categories.forEach((category) => {
    select.append(new Option(category, category));
  });

  select.value = state.transactionsCategory;
}

function updateMonthlySummary(
  metrics: MonthlyFinancialMetrics | null,
  transactionSummary: TransactionMonthlySummary
) {
  const revenue = getReliableRevenue(metrics, transactionSummary);
  const expenses = getReliableExpenses(metrics, transactionSummary);

  setValue("monthly_revenue", formatCurrency(revenue));
  setValue("monthly_expenses", formatCurrency(expenses));
  setValue("net_profit", formatCurrency(metrics?.net_profit));
  setValue("revenue_expense_revenue", formatCurrency(revenue));
  setValue("revenue_expense_expenses", formatCurrency(expenses));
  setValue("revenue_expense_net_profit", formatCurrency(metrics?.net_profit));
}

function updateReceivablesUnavailable() {
  setValue("accounts_receivable", "Sem dados");
  setCount("accounts_receivable_open_count", "Sem dados em aberto");
  setValue("receivables_total_open", "Sem dados");
  setValue("receivables_open_count", "Sem dados");
  setValue("receivables_total_overdue", "Sem dados");
  setValue("aging_due", "Sem dados");
  setValue("aging_overdue_1_15", "Sem dados");
  setValue("aging_overdue_16_30", "Sem dados");
  setValue("aging_overdue_31_45", "Sem dados");
  setValue("aging_overdue_45_plus", "Sem dados");

  document.querySelector<HTMLElement>("[data-financeiro-aging-bar]")?.setAttribute("hidden", "");
  document.querySelector<HTMLElement>("[data-financeiro-aging-list]")?.setAttribute("hidden", "");
  document.querySelector<HTMLElement>("[data-financeiro-aging-empty]")?.removeAttribute("hidden");

  setTableMessage(
    "receivables",
    "Contas a receber indisponiveis.",
    "A tabela financial_accounts_receivable nao existe no schema atual."
  );
}

function updatePayablesUnavailable() {
  setValue("accounts_payable", "Sem dados");
  setCount("accounts_payable_open_count", "Sem dados em aberto");
  setValue("payables_total_open", "Sem dados");
  setValue("payables_open_count", "Sem dados");
  setValue("payables_total_overdue", "Sem dados");

  setTableMessage(
    "payables",
    "Contas a pagar indisponiveis.",
    "A tabela financial_accounts_payable nao existe no schema atual."
  );
}

function updateTransactionCharts(
  periods: FinancialPeriod[],
  summaries: TransactionMonthlyPeriodSummary[],
  history: MonthlyFinancialMetrics[]
) {
  const labels = periods.map((period) => formatShortMonthYear(period.year, period.month));
  const metricsByPeriod = new Map(
    history.map((metric) => [`${metric.year}-${metric.month}`, metric])
  );
  const getPeriodMetric = (period: FinancialPeriod) =>
    metricsByPeriod.get(`${period.year}-${period.month}`) ?? null;
  const getPeriodSummary = (period: FinancialPeriod) =>
    summaries.find(
      (summary) => summary.year === period.year && summary.month === period.month
    );
  const balances = periods.map((period) => {
    const metric = history.find(
      (item) => item.year === period.year && item.month === period.month
    );

    return metric?.cash_balance ?? null;
  });
  const cashInflows = periods.map((period) => getPeriodMetric(period)?.cash_inflows ?? null);
  const cashOutflows = periods.map((period) => {
    const value = getPeriodMetric(period)?.cash_outflows ?? null;

    return value === null ? null : -Math.abs(value);
  });
  const revenues = periods.map((period) => {
    const summary = getPeriodSummary(period);

    return summary ? getReliableRevenue(getPeriodMetric(period), summary) : null;
  });
  const expenses = periods.map((period) => {
    const summary = getPeriodSummary(period);

    return summary ? getReliableExpenses(getPeriodMetric(period), summary) : null;
  });

  window.dispatchEvent(
    new CustomEvent("cash-flow-data", {
      detail: {
        labels,
        inflows: cashInflows,
        outflows: cashOutflows,
        balances,
      },
    })
  );

  window.dispatchEvent(
    new CustomEvent("revenue-expense-data", {
      detail: {
        labels,
        revenues,
        expenses,
      },
    })
  );
}

function showLoadError() {
  updateReceivablesUnavailable();
  updatePayablesUnavailable();
  setValue("monthly_revenue", "Sem dados");
  setValue("monthly_expenses", "Sem dados");
  setValue("net_profit", "Sem dados");
  setValue("revenue_expense_revenue", "Sem dados");
  setValue("revenue_expense_expenses", "Sem dados");
  setValue("revenue_expense_net_profit", "Sem dados");
  setTableMessage(
    "transactions",
    "Nao foi possivel carregar movimentacoes.",
    "Verifique a sessao autenticada e as permissoes RLS."
  );
  window.dispatchEvent(
    new CustomEvent("cash-flow-data", {
      detail: { labels: [], inflows: [], outflows: [], balances: [] },
    })
  );
  window.dispatchEvent(
    new CustomEvent("revenue-expense-data", {
      detail: { labels: [], revenues: [], expenses: [] },
    })
  );
}

function bindOperationalFilters() {
  document
    .querySelector<HTMLInputElement>('[data-financeiro-filter="transactions-search"]')
    ?.addEventListener("input", (event) => {
      state.transactionsSearch =
        event.currentTarget instanceof HTMLInputElement
          ? event.currentTarget.value.trim().toLowerCase()
          : "";
      renderTransactionsTable();
    });

  document
    .querySelector<HTMLSelectElement>('[data-financeiro-filter="transactions-type"]')
    ?.addEventListener("change", (event) => {
      state.transactionsType =
        event.currentTarget instanceof HTMLSelectElement ? event.currentTarget.value : "";
      renderTransactionsTable();
    });

  document
    .querySelector<HTMLSelectElement>('[data-financeiro-filter="transactions-category"]')
    ?.addEventListener("change", (event) => {
      state.transactionsCategory =
        event.currentTarget instanceof HTMLSelectElement ? event.currentTarget.value : "";
      renderTransactionsTable();
    });
}

async function loadUnavailableReceivables(selectedPeriod: FinancialPeriod, companyId?: string) {
  try {
    await Promise.all([
      getReceivables({}),
      getReceivableSummary(selectedPeriod.year, selectedPeriod.month, companyId),
    ]);
  } catch {
    updateReceivablesUnavailable();
  }
}

async function loadUnavailablePayables(selectedPeriod: FinancialPeriod, companyId?: string) {
  try {
    await Promise.all([
      getPayables({}),
      getPayableSummary(selectedPeriod.year, selectedPeriod.month, companyId),
    ]);
  } catch {
    updatePayablesUnavailable();
  }
}

export async function loadFinanceiroPage() {
  updateCompanyFallback();
  updateVisibleView();
  updateViewLinks();
  bindOperationalFilters();

  try {
    const periods = await getAvailableFinancialPeriods();
    const selectedPeriod = readSelectedPeriod() ?? periods[0] ?? readCurrentPeriod();
    const companyId = readSelectedCompany();
    const { startDate, endDate } = getMonthRange(selectedPeriod.year, selectedPeriod.month);

    preservePeriodInUrl(selectedPeriod);
    updateViewLinks();

    const [metrics, history, transactions, transactionSummary] = await Promise.all([
      getMonthlyFinancialMetrics(selectedPeriod.year, selectedPeriod.month),
      getFinancialMetricHistory(selectedPeriod.year, selectedPeriod.month, 6),
      getTransactions({
        companyId,
        startDate,
        endDate,
      }),
      getTransactionMonthlySummary(selectedPeriod.year, selectedPeriod.month, companyId),
      loadUnavailableReceivables(selectedPeriod, companyId),
      loadUnavailablePayables(selectedPeriod, companyId),
    ]);
    const chartPeriods = history.length ? history : [selectedPeriod];
    const transactionHistory = await getTransactionMonthlySummaries(chartPeriods, companyId);

    state.transactions = transactions;
    fillTransactionCategoryFilter(transactions);
    renderTransactionsTable();
    updateMonthlySummary(metrics, transactionSummary);
    updateTransactionCharts(chartPeriods, transactionHistory, history);
  } catch (error) {
    console.error(
      "Erro ao carregar financeiro:",
      error instanceof Error ? error.message : error
    );
    showLoadError();
  }
}
