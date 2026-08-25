import supabase from "../../lib/supabase/browser";

export async function getDashboardMetrics(periodMonth?: string) {
  let selectedPeriodMonth = periodMonth;

  if (!selectedPeriodMonth) {
    const { data: latestMetric, error: latestError } = await supabase
      .from("dashboard_metrics")
      .select("period_month")
      .not("period_month", "is", null)
      .order("period_month", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestError) {
      console.error("Erro ao buscar periodo das metricas:", latestError.message);
      return [];
    }

    selectedPeriodMonth = latestMetric?.period_month;
  }

  if (!selectedPeriodMonth) {
    return [];
  }

  const { data, error } = await supabase
    .from("dashboard_metrics")
    .select("*")
    .eq("period_month", selectedPeriodMonth)
    .order("metric_order", { ascending: true });

  if (error) {
    console.error("Erro ao buscar metricas:", error.message);
    return [];
  }

  return data ?? [];
}
