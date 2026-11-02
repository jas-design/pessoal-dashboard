export type NotificationAuthState = "pending" | "resolved" | "error";
export type NotificationLoadState = "idle" | "loading" | "success" | "error";
export type NotificationViewState =
  | "loading"
  | "unauthenticated"
  | "error"
  | "empty"
  | "ready";

interface NotificationViewInput {
  authState: NotificationAuthState;
  authenticated: boolean;
  loading: boolean;
  hasError: boolean;
  itemCount: number;
}

export function resolveNotificationViewState(
  input: NotificationViewInput,
): NotificationViewState {
  if (input.authState === "pending" || (input.authenticated && input.loading)) {
    return "loading";
  }

  if (input.authState === "error" || input.hasError) {
    return "error";
  }

  if (!input.authenticated) {
    return "unauthenticated";
  }

  return input.itemCount === 0 ? "empty" : "ready";
}

export function formatUnreadCount(count: number): string {
  return count > 99 ? "99+" : String(count);
}

export function isCurrentNotificationRequest(
  requestedUserId: string,
  currentUserId: string | null,
  requestedGeneration: number,
  currentGeneration: number,
): boolean {
  return (
    requestedUserId === currentUserId &&
    requestedGeneration === currentGeneration
  );
}

interface NotificationRefreshPlanInput {
  event: string;
  sameUser: boolean;
  countState: NotificationLoadState;
  listState: NotificationLoadState;
}

export function getNotificationRefreshPlan(
  input: NotificationRefreshPlanInput,
): { reloadCount: boolean; reloadList: boolean } {
  if (input.event !== "TOKEN_REFRESHED" || !input.sameUser) {
    return { reloadCount: false, reloadList: false };
  }

  return {
    reloadCount: input.countState === "error",
    reloadList: input.listState === "error",
  };
}
