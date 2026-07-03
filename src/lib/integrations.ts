import { supabase } from './supabase';

export async function getIntegrations() {
  const { data, error } = await supabase
    .from('integrations')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Erro ao buscar integrações:', error.message);
    return [];
  }

  return data ?? [];
}