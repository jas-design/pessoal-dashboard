import { supabase } from '../lib/supabase';

export async function getNotifications(limit = 20) {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Erro ao buscar notificações:', error.message);
    return [];
  }

  return data ?? [];
}

export async function getUnreadNotificationsCount() {
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('is_read', false);

  if (error) {
    console.error('Erro ao contar notificações:', error.message);
    return 0;
  }

  return count ?? 0;
}

export async function markNotificationAsRead(id: string) {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', id);

  if (error) {
    throw new Error(error.message);
  }

  return true;
}