const MONTHS_SHORT = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
] as const;

interface FinancialPeriodValue {
  year: number;
  month: number;
}

export function resolveAvailableFinancialPeriod(
  periods: FinancialPeriodValue[],
  requestedPeriod: FinancialPeriodValue | null,
  fallbackPeriod: FinancialPeriodValue | null = null
) {
  if (
    requestedPeriod
    && (
      periods.length === 0
      || periods.some(
        (period) =>
          period.year === requestedPeriod.year
          && period.month === requestedPeriod.month
      )
    )
  ) {
    return requestedPeriod;
  }

  return periods[0] ?? fallbackPeriod;
}

export function formatMonthYear(year: number, month: number): string {
  const monthLabel = MONTHS_SHORT[month - 1];

  if (!monthLabel) {
    return `${month}/${year}`;
  }

  return `${monthLabel}/${year}`;
}
