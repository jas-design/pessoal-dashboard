import supabase from "../../lib/supabase/client";

export async function getDashboardMetrics() {
  const { data, error } = await supabase
    .from('dashboard_metrics')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Erro ao buscar métricas:', error.message);
    return [];
  }

  return data ?? [];
}