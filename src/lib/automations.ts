import { supabase } from './supabase';

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
  status: string;
  message?: string;
  source?: string;
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