import supabase from "../../lib/supabase/client";

export async function getApiConnections() {
  const { data, error } = await supabase
    .from('api_connections')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Erro ao buscar conexões de API:', error.message);
    return [];
  }

  return data ?? [];
}