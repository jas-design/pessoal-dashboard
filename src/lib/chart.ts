import { supabase } from './supabase';

export async function getAutomationDailyStats() {
  const { data, error } = await supabase
    .from('automation_daily_stats')
    .select('*')
    .order('stat_date', { ascending: true });

  if (error) {
    console.error('Erro ao buscar dados do gráfico:', error.message);
    return [];
  }

  return data ?? [];
}