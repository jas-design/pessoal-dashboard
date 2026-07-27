import supabase from "../../lib/supabase/client";

export async function getAutomationLogs(limit = 50) {
  const { data, error } = await supabase
    .from('automation_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Erro ao buscar logs:', error.message);
    return [];
  }

  return data ?? [];
}