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

export function formatMonthYear(year: number, month: number): string {
  const monthLabel = MONTHS_SHORT[month - 1];

  if (!monthLabel) {
    return `${month}/${year}`;
  }

  return `${monthLabel}/${year}`;
}
