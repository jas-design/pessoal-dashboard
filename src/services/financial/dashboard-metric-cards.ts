export const financialMetricCards = [
  {
    key: "revenue",
    label: "FATURAMENTO (MÊS)",
    icon: "currency",
    unit: "currency",
    accent: "#22c55e",
    accentSoft: "rgba(34, 197, 94, 0.14)",
    accentGlow: "rgba(34, 197, 94, 0.2)",
  },
  {
    key: "net_profit",
    label: "LUCRO LÍQUIDO (MÊS)",
    icon: "chart",
    unit: "currency",
    accent: "#2563eb",
    accentSoft: "rgba(37, 99, 235, 0.14)",
    accentGlow: "rgba(37, 99, 235, 0.2)",
  },
  {
    key: "net_margin",
    label: "MARGEM LÍQUIDA",
    icon: "percent",
    unit: "percentage",
    accent: "#7c3aed",
    accentSoft: "rgba(124, 58, 237, 0.14)",
    accentGlow: "rgba(124, 58, 237, 0.2)",
  },
  {
    key: "cash_balance",
    label: "SALDO EM CAIXA",
    icon: "wallet",
    unit: "currency",
    accent: "#f97316",
    accentSoft: "rgba(249, 115, 22, 0.14)",
    accentGlow: "rgba(249, 115, 22, 0.2)",
  },
] as const;

export type FinancialMetricCardDefinition = (typeof financialMetricCards)[number];
