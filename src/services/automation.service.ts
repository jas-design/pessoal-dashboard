import { supabase } from '../lib/supabase';

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

export async function createAutomationLog(log: {
  workflow_name: string;
  workflow_id?: string;
  status: string;
  message?: string;
  source?: string;
  execution_count?: number;
  payload?: Record<string, unknown>;
}) {
  const { data, error } = await supabase
    .from('automation_logs')
    .insert(log)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}