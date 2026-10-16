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
  return transactionSummary.incomeCount > 0
    ? transactionSummary.incomeTotal
    : metrics?.revenue ?? null;
}

export function getReliableExpenses(
  metrics: MonthlyFinancialMetrics | null,
  transactionSummary: TransactionMonthlySummary
) {
  return transactionSummary.expenseCount > 0
    ? transactionSummary.expenseTotal
    : getMonthlyExpenses(metrics);
}

export function getReliableCashInflows(
  metrics: MonthlyFinancialMetrics | null,
  transactionSummary: TransactionMonthlySummary
) {
  if (transactionSummary.incomeCount > 0) {
    return transactionSummary.incomeTotal;
  }

  return isMeaningfulFinancialNumber(metrics?.cash_inflows) ? metrics.cash_inflows : null;
}

export function getReliableCashOutflows(
  metrics: MonthlyFinancialMetrics | null,
  transactionSummary: TransactionMonthlySummary
) {
  if (transactionSummary.expenseCount > 0) {
    return transactionSummary.expenseTotal;
  }

  return isMeaningfulFinancialNumber(metrics?.cash_outflows) ? metrics.cash_outflows : null;
}
