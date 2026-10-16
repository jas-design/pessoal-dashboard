import supabase from "../../lib/supabase/browser";

export interface FinancialTransaction {
  id: string;
  company_id: string | null;
  document_id: string | null;
  transaction_date: string;
  type: string | null;
  description: string | null;
  category: string | null;
  amount: number | null;
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface TransactionFilters {
  companyId?: string;
  startDate?: string;
  endDate?: string;
  type?: string;
  status?: string;
  category?: string;
}

export interface TransactionMonthlySummary {
  incomeTotal: number | null;
  incomeCount: number;
  expenseTotal: number | null;
  expenseCount: number;
  transactionCount: number;
}

export interface TransactionMonthlyPeriodSummary extends TransactionMonthlySummary {
  year: number;
  month: number;
}

type FinancialTransactionRow = Omit<FinancialTransaction, "amount"> & {
  amount: number | string | null;
};

const transactionColumns = [
  "id",
  "company_id",
  "document_id",
  "transaction_date",
  "type",
  "description",
  "category",
  "amount",
  "status",
  "created_at",
  "updated_at",
].join(", ");

function assertValidPeriod(year: number, month: number) {
  if (!Number.isInteger(year) || !Number.isInteger(month)) {
    throw new Error("Year and month must be integers.");
  }

  if (month < 1 || month > 12) {
    throw new Error("Month must be between 1 and 12.");
  }
}

function toNumber(value: number | string | null) {
  if (value === null) {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}

function toFinancialTransaction(row: FinancialTransactionRow): FinancialTransaction {
  return {
    ...row,
    amount: toNumber(row.amount),
  };
}

function getMonthRange(year: number, month: number) {
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  return { startDate, endDate };
}

function getPeriodKey(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function readTransactionPeriod(transaction: FinancialTransaction) {
  const match = transaction.transaction_date.match(/^(\d{4})-(\d{2})/);

  if (!match) {
    return null;
  }

  return {
    year: Number(match[1]),
    month: Number(match[2]),
  };
}

function addTransactionToSummary(
  summary: TransactionMonthlySummary,
  transaction: FinancialTransaction
) {
  summary.transactionCount += 1;

  if (transaction.amount === null) {
    return;
  }

  if (transaction.type === "income") {
    summary.incomeTotal = (summary.incomeTotal ?? 0) + transaction.amount;
    summary.incomeCount += 1;
  }

  if (transaction.type === "expense") {
    summary.expenseTotal = (summary.expenseTotal ?? 0) + transaction.amount;
    summary.expenseCount += 1;
  }
}

export async function getTransactions(
  filters: TransactionFilters = {}
): Promise<FinancialTransaction[]> {
  let query = supabase
    .from("financial_transactions")
    .select(transactionColumns)
    .order("transaction_date", { ascending: false });

  if (filters.companyId) {
    query = query.eq("company_id", filters.companyId);
  }

  if (filters.startDate) {
    query = query.gte("transaction_date", filters.startDate);
  }

  if (filters.endDate) {
    query = query.lte("transaction_date", filters.endDate);
  }

  if (filters.type) {
    query = query.eq("type", filters.type);
  }

  if (filters.status) {
    query = query.eq("status", filters.status);
  }

  if (filters.category) {
    query = query.eq("category", filters.category);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Erro ao buscar movimentacoes financeiras: ${error.message}`);
  }

  return ((data ?? []) as FinancialTransactionRow[]).map(toFinancialTransaction);
}

export async function getTransactionMonthlySummary(
  year: number,
  month: number,
  companyId?: string
): Promise<TransactionMonthlySummary> {
  assertValidPeriod(year, month);

  const { startDate, endDate } = getMonthRange(year, month);
  const transactions = await getTransactions({
    companyId,
    startDate,
    endDate,
  });

  return transactions.reduce<TransactionMonthlySummary>(
    (summary, transaction) => {
      addTransactionToSummary(summary, transaction);
      return summary;
    },
    {
      incomeTotal: null,
      incomeCount: 0,
      expenseTotal: null,
      expenseCount: 0,
      transactionCount: 0,
    }
  );
}

export async function getTransactionMonthlySummaries(
  periods: Array<{ year: number; month: number }>,
  companyId?: string
): Promise<TransactionMonthlyPeriodSummary[]> {
  periods.forEach((period) => assertValidPeriod(period.year, period.month));

  if (!periods.length) {
    return [];
  }

  const sortedPeriods = [...periods].sort(
    (current, next) => current.year * 12 + current.month - (next.year * 12 + next.month)
  );
  const firstPeriod = sortedPeriods[0];
  const lastPeriod = sortedPeriods[sortedPeriods.length - 1];
  const firstRange = getMonthRange(firstPeriod.year, firstPeriod.month);
  const lastRange = getMonthRange(lastPeriod.year, lastPeriod.month);
  const summaries = new Map<string, TransactionMonthlySummary>();

  sortedPeriods.forEach((period) => {
    summaries.set(getPeriodKey(period.year, period.month), {
      incomeTotal: null,
      incomeCount: 0,
      expenseTotal: null,
      expenseCount: 0,
      transactionCount: 0,
    });
  });

  const transactions = await getTransactions({
    companyId,
    startDate: firstRange.startDate,
    endDate: lastRange.endDate,
  });

  transactions.forEach((transaction) => {
    const period = readTransactionPeriod(transaction);

    if (!period) {
      return;
    }

    const summary = summaries.get(getPeriodKey(period.year, period.month));

    if (summary) {
      addTransactionToSummary(summary, transaction);
    }
  });

  return sortedPeriods.map((period) => ({
    ...summaries.get(getPeriodKey(period.year, period.month))!,
    year: period.year,
    month: period.month,
  }));
}
