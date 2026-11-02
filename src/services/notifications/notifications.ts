import supabase from "../../lib/supabase/browser";
import type { Notification } from "../../types/notifications";
import { isNotificationAlreadyReadByUser } from "./notification-access";

export type NotificationItem = Pick<
  Notification,
  "id" | "title" | "type" | "is_read" | "created_at"
>;

export async function getNotifications(limit = 20): Promise<NotificationItem[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("id, title, type, is_read, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error("Não foi possível carregar as notificações.");
  }

  return (data ?? []) as NotificationItem[];
}

export async function getUnreadNotificationsCount(): Promise<number> {
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("is_read", false);

  if (error) {
    throw new Error("Não foi possível carregar a contagem de notificações.");
  }

  return count ?? 0;
}

export async function markNotificationAsRead(id: string): Promise<void> {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();
  const userId = session?.user.id;

  if (sessionError || !userId) {
    throw new Error("Não foi possível confirmar a sessão autenticada.");
  }

  const { data, error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", id)
    .eq("user_id", userId)
    .eq("is_read", false)
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error("Não foi possível marcar a notificação como lida.");
  }

  if (data) {
    return;
  }

  const { data: currentNotification, error: verificationError } = await supabase
    .from("notifications")
    .select("user_id, is_read")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (
    verificationError ||
    !isNotificationAlreadyReadByUser(currentNotification, userId)
  ) {
    throw new Error("Não foi possível confirmar o estado da notificação.");
  }
}
