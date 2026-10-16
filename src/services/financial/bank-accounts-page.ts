import {
  getAvailableFinancialPeriods,
  getMonthlyFinancialMetrics,
  type FinancialPeriod,
  type MonthlyFinancialMetrics,
} from "./monthly-metrics";
import {
  getTransactions,
  getTransactionMonthlySummary,
  type FinancialTransaction,
  type TransactionMonthlySummary,
} from "./transactions";
import {
  getReliableCashInflows,
  getReliableCashOutflows,
  isRealFinancialNumber,
} from "./financial-calculations";

function isRealNumber(value: number | null | undefined): value is number {
  return isRealFinancialNumber(value);
}

function formatCurrency(value: number | null | undefined) {
  if (!isRealNumber(value)) {
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

function setValue(key: string, value: string) {
  document.querySelectorAll<HTMLElement>(`[data-bank-accounts-value="${key}"]`).forEach(
    (element) => {
      element.textContent = value;
    }
  );
}

function updateCompanyFallback() {
  const select = document.querySelector<HTMLSelectElement>("[data-bank-accounts-company]");
  const companyId = readSelectedCompany();

  if (!select) {
    return;
  }

  select.replaceChildren(
    new Option(
      companyId
        ? "Empresa preservada pela URL; cadastro nao disponivel"
        : "Empresas nao vinculadas aos dados bancarios",
      companyId ?? ""
    )
  );
  select.value = companyId ?? "";
  select.disabled = true;
}

function updateSummaryCards(
  metrics: MonthlyFinancialMetrics | null,
  transactionSummary: TransactionMonthlySummary
) {
  setValue("cash_balance", formatCurrency(metrics?.cash_balance));
  setValue("active_accounts", "Sem dados");
  setValue("cash_inflows", formatCurrency(getReliableCashInflows(metrics, transactionSummary)));
  setValue("cash_outflows", formatCurrency(getReliableCashOutflows(metrics, transactionSummary)));
}

function createCell(text: string, className?: string) {
  const cell = document.createElement("td");
  cell.textContent = text;

  if (className) {
    cell.className = className;
  }

  return cell;
}

function createMovementRow(transaction: FinancialTransaction) {
  const row = document.createElement("tr");
  const signedAmount =
    transaction.amount === null
      ? null
      : transaction.type === "expense"
        ? -Math.abs(transaction.amount)
        : transaction.amount;
  const amountClass =
    transaction.type === "income"
      ? "is-positive"
      : transaction.type === "expense"
        ? "is-negative"
        : undefined;
  const typeLabel =
    transaction.type === "income"
      ? "Entrada"
      : transaction.type === "expense"
        ? "Saida"
        : "Sem tipo";

  row.append(
    createCell(formatDate(transaction.transaction_date)),
    createCell(transaction.description || "Sem descricao"),
    createCell(transaction.category || "Sem categoria"),
    createCell(typeLabel),
    createCell(formatCurrency(signedAmount), amountClass),
    createCell(transaction.status || "Sem status")
  );

  return row;
}

function renderRecentMovements(transactions: FinancialTransaction[]) {
  const body = document.querySelector<HTMLTableSectionElement>(
    "[data-bank-accounts-movements-body]"
  );
  const empty = document.querySelector<HTMLElement>("[data-bank-accounts-movements-empty]");

  if (!body || !empty) {
    return;
  }

  const recentTransactions = transactions.slice(0, 5);

  body.replaceChildren(...recentTransactions.map(createMovementRow));
  empty.hidden = recentTransactions.length > 0;
}

function showLoadError() {
  setValue("cash_balance", "Sem dados");
  setValue("active_accounts", "Sem dados");
  setValue("cash_inflows", "Sem dados");
  setValue("cash_outflows", "Sem dados");

  const body = document.querySelector<HTMLTableSectionElement>(
    "[data-bank-accounts-movements-body]"
  );
  const empty = document.querySelector<HTMLElement>("[data-bank-accounts-movements-empty]");

  body?.replaceChildren();

  if (empty) {
    empty.querySelector("h3")?.replaceChildren("Nao foi possivel carregar movimentacoes.");
    empty.querySelector("p")?.replaceChildren(
      "Verifique a sessao autenticada e as permissoes RLS."
    );
    empty.hidden = false;
  }
}

export async function loadBankAccountsPage() {
  updateCompanyFallback();

  try {
    const periods = await getAvailableFinancialPeriods();
    const selectedPeriod = readSelectedPeriod() ?? periods[0] ?? readCurrentPeriod();
    const companyId = readSelectedCompany();
    const { startDate, endDate } = getMonthRange(selectedPeriod.year, selectedPeriod.month);

    preservePeriodInUrl(selectedPeriod);

    const [metrics, transactionSummary, transactions] = await Promise.all([
      getMonthlyFinancialMetrics(selectedPeriod.year, selectedPeriod.month),
      getTransactionMonthlySummary(selectedPeriod.year, selectedPeriod.month, companyId),
      getTransactions({
        companyId,
        startDate,
        endDate,
      }),
    ]);

    updateSummaryCards(metrics, transactionSummary);
    renderRecentMovements(transactions);
  } catch (error) {
    console.error(
      "Erro ao carregar bancos e contas:",
      error instanceof Error ? error.message : error
    );
    showLoadError();
  }
}
