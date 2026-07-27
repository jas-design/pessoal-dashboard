import supabase from "../../lib/supabase/client";

export async function getWebhooks() {
  const { data, error } = await supabase
    .from('webhooks')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Erro ao buscar webhooks:', error.message);
    return [];
  }

  return data ?? [];
}