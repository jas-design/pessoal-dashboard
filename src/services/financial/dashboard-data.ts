import { formatMonthYear } from "./period-format";
import {
  getMonthlyFinancialSummary,
  type MonthlyFinancialSummary,
} from "./monthly-summary";
import {
  getAvailableFinancialPeriods,
  getFinancialMetricHistory,
  getMonthlyFinancialMetrics,
  getPreviousMonthFinancialMetrics,
  type FinancialPeriod,
  type MonthlyFinancialMetrics,
} from "./monthly-metrics";

type MetricKey = "revenue" | "net_profit" | "net_margin" | "cash_balance";
type MetricUnit = "currency" | "percentage";
type MetricTone = "positive" | "negative" | "neutral";
type CashFlowKey = "cash_inflows" | "cash_outflows" | "cash_balance";

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

type FinancialMetricCardDefinition = (typeof financialMetricCards)[number];

function readPeriodFromUrl(): FinancialPeriod | null {
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

function resolveSelectedPeriod(periods: FinancialPeriod[]) {
  return readPeriodFromUrl() ?? periods[0] ?? null;
}

function isRealNumber(value: number | null): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function formatMetricValue(value: number | null, unit: MetricUnit) {
  if (!isRealNumber(value)) {
    return "Sem dados";
  }

  if (unit === "currency") {
    return value.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 0,
    });
  }

  return `${value.toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
}

function calculateVariation(current: number, previous: number, unit: MetricUnit) {
  if (unit === "percentage") {
    return current - previous;
  }

  if (previous === 0) {
    return 0;
  }

  return ((current - previous) / previous) * 100;
}

function createSparkPath(values: number[]) {
  const width = 240;
  const height = 72;

  if (values.length <= 1) {
    return `M 0 ${height / 2} L ${width} ${height / 2}`;
  }

  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = Math.max(max - min, 1);

  return values
    .map((point, pointIndex) => {
      const x = (pointIndex / (values.length - 1)) * width;
      const y = height - ((point - min) / range) * (height - 6) - 3;

      return `${pointIndex === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

function getMetricTone(variationValue: number): MetricTone {
  return variationValue >= 0 ? "positive" : "negative";
}

function getMetricVariation(
  definition: FinancialMetricCardDefinition,
  metrics: MonthlyFinancialMetrics,
  previousMetrics: MonthlyFinancialMetrics | null
) {
  const value = metrics[definition.key as MetricKey];

  if (definition.key === "cash_balance") {
    return {
      text: "Atualizado no período",
      tone: "neutral" as const,
    };
  }

  if (!previousMetrics || !isRealNumber(value)) {
    return null;
  }

  const previousValue = previousMetrics[definition.key as MetricKey];

  if (!isRealNumber(previousValue)) {
    return null;
  }

  const variationValue = calculateVariation(value, previousValue, definition.unit);
  const formattedVariation = Math.abs(variationValue).toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  });
  const sign = variationValue >= 0 ? "+" : "-";
  const suffix = definition.unit === "percentage" ? " p.p." : "%";

  return {
    text: `${sign}${formattedVariation}${suffix} vs ${formatMonthYear(
      previousMetrics.year,
      previousMetrics.month
    )}`,
    tone: getMetricTone(variationValue),
  };
}

function renderMetricsEmptyState(message: string) {
  const grid = document.querySelector("#dashboard-metrics-grid");

  if (!grid) {
    return;
  }

  const state = document.createElement("div");
  state.className = "metrics-grid__state";
  state.textContent = message;
  grid.replaceChildren(state);
}

function updateMetricCard(
  definition: FinancialMetricCardDefinition,
  metrics: MonthlyFinancialMetrics,
  previousMetrics: MonthlyFinancialMetrics | null,
  history: MonthlyFinancialMetrics[]
) {
  const card = document.querySelector(
    `[data-financial-metric-card="${definition.key}"]`
  );

  if (!(card instanceof HTMLElement)) {
    return;
  }

  const value = metrics[definition.key as MetricKey];
  const valueElement = card.querySelector("[data-financial-metric-value]");
  const variationElement = card.querySelector("[data-financial-metric-variation]");
  const sparklineArea = card.querySelector("[data-financial-metric-sparkline-area]");
  const sparklineLine = card.querySelector("[data-financial-metric-sparkline-line]");
  const sparklineValues = history
    .map((historyMetric) => historyMetric[definition.key as MetricKey])
    .filter(isRealNumber);
  const sparklinePath = createSparkPath(sparklineValues);
  const variation = getMetricVariation(definition, metrics, previousMetrics);

  if (valueElement) {
    valueElement.textContent = formatMetricValue(value, definition.unit);
  }

  if (variationElement instanceof HTMLElement) {
    variationElement.hidden = !variation;
    variationElement.classList.remove("is-positive", "is-negative", "is-neutral");

    if (variation) {
      variationElement.textContent = variation.text;
      variationElement.classList.add(`is-${variation.tone}`);
    }
  }

  if (sparklineArea) {
    sparklineArea.setAttribute("d", `${sparklinePath} L 240 72 L 0 72 Z`);
  }

  if (sparklineLine) {
    sparklineLine.setAttribute("d", sparklinePath);
  }
}

function updateMetricCards(
  metrics: MonthlyFinancialMetrics,
  previousMetrics: MonthlyFinancialMetrics | null,
  history: MonthlyFinancialMetrics[]
) {
  financialMetricCards.forEach((definition) => {
    updateMetricCard(definition, metrics, previousMetrics, history);
  });
}

function createCashFlowLabels(history: MonthlyFinancialMetrics[]) {
  return history.map((item) => formatMonthYear(item.year, item.month));
}

function createCashFlowSeries(history: MonthlyFinancialMetrics[], key: CashFlowKey) {
  return history.map((item) => item[key]);
}

function updateCashFlowChart(history: MonthlyFinancialMetrics[]) {
  window.dispatchEvent(
    new CustomEvent("cash-flow-data", {
      detail: {
        labels: createCashFlowLabels(history),
        inflows: createCashFlowSeries(history, "cash_inflows"),
        outflows: createCashFlowSeries(history, "cash_outflows"),
        balances: createCashFlowSeries(history, "cash_balance"),
      },
    })
  );
}

function updateMonthlyFinancialSummary(metrics: MonthlyFinancialMetrics | null) {
  window.dispatchEvent(
    new CustomEvent("monthly-financial-summary-data", {
      detail: metrics
        ? {
            net_revenue: metrics.net_revenue,
            costs: metrics.costs,
            operating_expenses: metrics.operating_expenses,
            financial_expenses: metrics.financial_expenses,
            net_profit: metrics.net_profit,
          }
        : null,
    })
  );
}

function updateFinancialSummarySections(summary: MonthlyFinancialSummary | null) {
  window.dispatchEvent(
    new CustomEvent("financial-monthly-summary-data", {
      detail: summary
        ? {
            accounts_receivable: summary.accounts_receivable,
            accounts_receivable_open_count: summary.accounts_receivable_open_count,
            accounts_payable: summary.accounts_payable,
            accounts_payable_open_count: summary.accounts_payable_open_count,
            current_ratio: summary.current_ratio,
            debt_ratio: summary.debt_ratio,
          }
        : null,
    })
  );
}

function clearFinancialDashboard(summary: MonthlyFinancialSummary | null = null) {
  updateCashFlowChart([]);
  updateMonthlyFinancialSummary(null);
  updateFinancialSummarySections(summary);
}

export async function loadFinancialDashboard() {
  try {
    const periods = await getAvailableFinancialPeriods();
    const selectedPeriod = resolveSelectedPeriod(periods);

    if (!selectedPeriod) {
      renderMetricsEmptyState("Sem dados");
      clearFinancialDashboard();
      return;
    }

    const [metrics, previousMetrics, history, summary] = await Promise.all([
      getMonthlyFinancialMetrics(selectedPeriod.year, selectedPeriod.month),
      getPreviousMonthFinancialMetrics(selectedPeriod.year, selectedPeriod.month),
      getFinancialMetricHistory(selectedPeriod.year, selectedPeriod.month, 6),
      getMonthlyFinancialSummary(selectedPeriod.year, selectedPeriod.month),
    ]);

    if (!metrics) {
      renderMetricsEmptyState("Sem dados");
      clearFinancialDashboard(summary);
      return;
    }

    updateMetricCards(metrics, previousMetrics, history);
    updateCashFlowChart(history);
    updateMonthlyFinancialSummary(metrics);
    updateFinancialSummarySections(summary);
  } catch (error) {
    console.error(
      "Erro ao buscar métricas:",
      error instanceof Error ? error.message : error
    );
    renderMetricsEmptyState("Não foi possível carregar as métricas.");
    clearFinancialDashboard();
  }
}
