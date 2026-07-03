import { supabase } from './supabase';

export async function getDashboardMetrics() {
  const { data, error } = await supabase
    .from('dashboard_metrics')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Erro ao buscar métricas:', error.message);
    return [];
  }

  return data;
}