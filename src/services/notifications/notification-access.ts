export interface NotificationReadState {
  user_id: string | null;
  is_read: boolean;
}

export function isNotificationAlreadyReadByUser(
  notification: NotificationReadState | null,
  userId: string,
): boolean {
  return Boolean(
    notification &&
      notification.user_id === userId &&
      notification.is_read,
  );
}
