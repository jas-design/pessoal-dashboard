import supabase from "../../lib/supabase/client";

export async function getSystemHealth() {
  const { data, error } = await supabase
    .from('system_health')
    .select('*')
    .order('last_checked_at', { ascending: false });

  if (error) {
    console.error('Erro ao buscar saúde do sistema:', error.message);
    return [];
  }

  return data ?? [];
}