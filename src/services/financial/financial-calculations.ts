import type { MonthlyFinancialMetrics } from "./monthly-metrics";
import type { TransactionMonthlySummary } from "./transactions";

export function isRealFinancialNumber(
  value: number | null | undefined
): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function isMeaningfulFinancialNumber(
  value: number | null | undefined
): value is number {
  return isRealFinancialNumber(value) && value !== 0;
}

export function getMonthlyExpenses(metrics: MonthlyFinancialMetrics | null) {
  if (!metrics) {
    return null;
  }

  if (metrics.data_state === "approved") {
    return metrics.expenses;
  }

  const expenses = [
    metrics.costs,
    metrics.operating_expenses,
    metrics.financial_expenses,
  ];
  const expenseValues = expenses.filter(isRealFinancialNumber);

  if (expenseValues.length !== expenses.length || expenseValues.every((value) => value === 0)) {
    return null;
  }

  return expenseValues.reduce((sum, value) => sum + value, 0);
}

export function getReliableRevenue(
  metrics: MonthlyFinancialMetrics | null,
  transactionSummary: TransactionMonthlySummary
) {
  if (metrics?.data_state === "approved") {
    return metrics.revenue;
  }

  if (metrics?.data_state === "pending" || metrics?.data_state === "missing") {
    return null;
  }

  return transactionSummary.incomeCount > 0
    ? transactionSummary.incomeTotal
    : metrics?.revenue ?? null;
}

export function getReliableExpenses(
  metrics: MonthlyFinancialMetrics | null,
  transactionSummary: TransactionMonthlySummary
) {
  if (metrics?.data_state === "approved") {
    return metrics.expenses;
  }

  if (metrics?.data_state === "pending" || metrics?.data_state === "missing") {
    return null;
  }

  return transactionSummary.expenseCount > 0
    ? transactionSummary.expenseTotal
    : getMonthlyExpenses(metrics);
}

export function getReliableCashInflows(
  metrics: MonthlyFinancialMetrics | null,
  transactionSummary: TransactionMonthlySummary
) {
  if (metrics?.data_state === "approved") {
    return null;
  }
  if (transactionSummary.incomeCount > 0) {
    return transactionSummary.incomeTotal;
  }

  return isMeaningfulFinancialNumber(metrics?.cash_inflows) ? metrics.cash_inflows : null;
}

export function getReliableCashOutflows(
  metrics: MonthlyFinancialMetrics | null,
  transactionSummary: TransactionMonthlySummary
) {
  if (metrics?.data_state === "approved") {
    return null;
  }
  if (transactionSummary.expenseCount > 0) {
    return transactionSummary.expenseTotal;
  }

  return isMeaningfulFinancialNumber(metrics?.cash_outflows) ? metrics.cash_outflows : null;
}

export function getFinancialValueStatus(
  metrics: MonthlyFinancialMetrics | null,
  value: number | null | undefined
) {
  if (!metrics) {
    return "Sem dados";
  }

  if (metrics.data_state === "pending") {
    return "Aguardando aprovação ou publicação";
  }

  if (metrics.data_state === "missing") {
    return "Sem publicação aprovada";
  }

  if (metrics.data_state === "unverified") {
    return isRealFinancialNumber(value)
      ? "Origem não verificada"
      : "Sem dados verificáveis";
  }

  return isRealFinancialNumber(value)
    ? "Aprovado e publicado"
    : "Não informado na fonte aprovada";
}

export function getFinancialDataMessage(metrics: MonthlyFinancialMetrics | null) {
  if (!metrics) {
    return "Sem dados financeiros para a competência selecionada.";
  }

  if (metrics.data_state === "approved") {
    return "Dados aprovados e publicados para a empresa selecionada.";
  }

  if (metrics.data_state === "pending") {
    return "Há fatos em revisão ou aprovados aguardando publicação.";
  }

  if (metrics.data_state === "missing") {
    return "Sem publicação financeira aprovada para esta empresa e competência.";
  }

  return "Dados legados sem empresa e com origem não verificada.";
}

export function resolveFinancialOverview(
  metrics: MonthlyFinancialMetrics | null,
  transactionSummary: TransactionMonthlySummary = {
    incomeTotal: null,
    incomeCount: 0,
    expenseTotal: null,
    expenseCount: 0,
    transactionCount: 0,
  }
) {
  return {
    revenue: getReliableRevenue(metrics, transactionSummary),
    expenses: getReliableExpenses(metrics, transactionSummary),
    netProfit: metrics?.net_profit ?? null,
    netMargin: metrics?.net_margin ?? null,
    cashBalance: metrics?.cash_balance ?? null,
    state: metrics?.data_state ?? "missing",
  };
}
