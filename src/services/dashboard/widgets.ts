import supabase from "../../lib/supabase/client";

export async function getDashboardWidgets() {
  const { data, error } = await supabase
    .from('dashboard_widgets')
    .select('*')
    .eq('is_active', true)
    .order('position', { ascending: true });

  if (error) {
    console.error('Erro ao buscar widgets:', error.message);
    return [];
  }

  return data ?? [];
}

export async function getAllDashboardWidgets() {
  const { data, error } = await supabase
    .from('dashboard_widgets')
    .select('*')
    .order('position', { ascending: true });

  if (error) {
    console.error('Erro ao buscar todos os widgets:', error.message);
    return [];
  }

  return data ?? [];
}

export async function updateWidget(
  id: string,
  updates: {
    is_active?: boolean;
    position?: number;
    title?: string;
    description?: string;
  }
) {
  const { data, error } = await supabase
    .from('dashboard_widgets')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}