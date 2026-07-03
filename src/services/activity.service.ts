import { supabase } from '../lib/supabase';

export async function getRecentActivities(limit = 10) {
  const { data, error } = await supabase
    .from('activities')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Erro ao buscar atividades:', error.message);
    return [];
  }

  return data ?? [];
}