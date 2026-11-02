import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import supabase from "../../lib/supabase/browser";
import {
  getNotifications,
  getUnreadNotificationsCount,
  markNotificationAsRead,
  type NotificationItem,
} from "../../services/notifications/notifications";
import {
  formatUnreadCount,
  getNotificationRefreshPlan,
  isCurrentNotificationRequest,
  resolveNotificationViewState,
  type NotificationAuthState,
  type NotificationLoadState,
} from "./notification-state";

const NOTIFICATIONS_LIMIT = 50;

let initialized = false;
let authEventVersion = 0;
let authState: NotificationAuthState = "pending";
let currentUserId: string | null = null;
let currentGeneration = 0;
let listRequestId = 0;
let countRequestId = 0;
let sessionResolution: Promise<void> | null = null;
let countLoadState: NotificationLoadState = "idle";
let listLoadState: NotificationLoadState = "idle";

function query<T extends Element>(selector: string): T | null {
  return document.querySelector<T>(selector);
}

function setVisible(element: HTMLElement | null, visible: boolean): void {
  if (element) {
    element.hidden = !visible;
  }
}

function sessionUserId(session: Session | null): string | null {
  if (!session?.user?.id) {
    return null;
  }

  if (session.expires_at && session.expires_at * 1000 <= Date.now()) {
    return null;
  }

  return session.user.id;
}

function resetNotificationItems(): void {
  const items = query<HTMLElement>("[data-notifications-items]");
  if (items) {
    items.replaceChildren();
  }
}

function setPageView(
  viewInput: {
    loading?: boolean;
    hasError?: boolean;
    itemCount?: number;
  } = {},
): void {
  const page = query<HTMLElement>("[data-notifications-page]");
  if (!page) {
    return;
  }

  const view = resolveNotificationViewState({
    authState,
    authenticated: Boolean(currentUserId),
    loading: viewInput.loading ?? false,
    hasError: viewInput.hasError ?? false,
    itemCount: viewInput.itemCount ?? 0,
  });

  page.setAttribute("aria-busy", String(view === "loading"));
  setVisible(query<HTMLElement>("[data-notifications-loading]"), view === "loading");
  setVisible(
    query<HTMLElement>("[data-notifications-unauthenticated]"),
    view === "unauthenticated",
  );
  setVisible(query<HTMLElement>("[data-notifications-error]"), view === "error");
  setVisible(query<HTMLElement>("[data-notifications-empty]"), view === "empty");
  setVisible(query<HTMLElement>("[data-notifications-table]"), view === "ready");
}

function setHeaderPending(label = "Notificações, verificando contagem"): void {
  const link = query<HTMLAnchorElement>("[data-notifications-link]");
  const badge = query<HTMLElement>("[data-notifications-unread-count]");

  link?.setAttribute("aria-label", label);
  if (badge) {
    badge.hidden = true;
    badge.textContent = "";
  }
}

function setHeaderCount(count: number): void {
  const link = query<HTMLAnchorElement>("[data-notifications-link]");
  const badge = query<HTMLElement>("[data-notifications-unread-count]");

  if (count === 0) {
    link?.setAttribute("aria-label", "Notificações, nenhuma não lida");
    if (badge) {
      badge.hidden = true;
      badge.textContent = "";
    }
    return;
  }

  link?.setAttribute(
    "aria-label",
    `Notificações, ${count} ${count === 1 ? "não lida" : "não lidas"}`,
  );
  if (badge) {
    badge.textContent = formatUnreadCount(count);
    badge.hidden = false;
  }
}

function createNotificationRow(notification: NotificationItem): HTMLElement {
  const row = document.createElement("div");
  row.className = "table__row table__row--5";
  row.dataset.notificationRow = notification.id;
  row.setAttribute("role", "row");

  const title = document.createElement("span");
  title.textContent = notification.title;
  title.setAttribute("role", "cell");

  const type = document.createElement("span");
  type.textContent = notification.type;
  type.setAttribute("role", "cell");

  const status = document.createElement("span");
  status.dataset.notificationStatus = "";
  status.className = notification.is_read ? "status-success" : "status-error";
  status.textContent = notification.is_read ? "Lida" : "Não lida";
  status.setAttribute("role", "cell");

  const createdAt = document.createElement("span");
  const parsedDate = new Date(notification.created_at);
  createdAt.textContent = Number.isNaN(parsedDate.getTime())
    ? "Data indisponível"
    : parsedDate.toLocaleString("pt-BR");
  createdAt.setAttribute("role", "cell");

  const action = document.createElement("span");
  action.dataset.notificationAction = "";
  action.setAttribute("role", "cell");
  if (notification.is_read) {
    action.textContent = "—";
  } else {
    const button = document.createElement("button");
    button.className = "button-small";
    button.type = "button";
    button.dataset.notificationId = notification.id;
    button.textContent = "Marcar como lida";
    action.append(button);
  }

  row.append(title, type, status, createdAt, action);
  return row;
}

function renderNotifications(notifications: NotificationItem[]): void {
  const items = query<HTMLElement>("[data-notifications-items]");
  if (!items) {
    return;
  }

  items.replaceChildren(...notifications.map(createNotificationRow));
}

async function loadUnreadCount(userId: string, generation: number): Promise<void> {
  const requestId = ++countRequestId;
  countLoadState = "loading";
  setHeaderPending();

  try {
    const count = await getUnreadNotificationsCount();
    if (
      requestId !== countRequestId ||
      !isCurrentNotificationRequest(
        userId,
        currentUserId,
        generation,
        currentGeneration,
      )
    ) {
      return;
    }

    countLoadState = "success";
    setHeaderCount(count);
  } catch {
    if (
      requestId === countRequestId &&
      isCurrentNotificationRequest(
        userId,
        currentUserId,
        generation,
        currentGeneration,
      )
    ) {
      countLoadState = "error";
      setHeaderPending("Notificações, contagem indisponível");
    }
  }
}

async function loadNotificationList(userId: string, generation: number): Promise<void> {
  if (!query<HTMLElement>("[data-notifications-page]")) {
    return;
  }

  const requestId = ++listRequestId;
  listLoadState = "loading";
  resetNotificationItems();
  setPageView({ loading: true });

  try {
    const notifications = await getNotifications(NOTIFICATIONS_LIMIT);
    if (
      requestId !== listRequestId ||
      !isCurrentNotificationRequest(
        userId,
        currentUserId,
        generation,
        currentGeneration,
      )
    ) {
      return;
    }

    listLoadState = "success";
    renderNotifications(notifications);
    setPageView({ itemCount: notifications.length });
  } catch {
    if (
      requestId === listRequestId &&
      isCurrentNotificationRequest(
        userId,
        currentUserId,
        generation,
        currentGeneration,
      )
    ) {
      listLoadState = "error";
      setPageView({ hasError: true });
    }
  }
}

function applySession(event: AuthChangeEvent, session: Session | null): void {
  const nextUserId = sessionUserId(session);
  const sameUser =
    authState === "resolved" &&
    nextUserId !== null &&
    nextUserId === currentUserId;

  if (sameUser) {
    const refreshPlan = getNotificationRefreshPlan({
      event,
      sameUser,
      countState: countLoadState,
      listState: listLoadState,
    });

    if (refreshPlan.reloadCount) {
      void loadUnreadCount(nextUserId, currentGeneration);
    }
    if (refreshPlan.reloadList) {
      void loadNotificationList(nextUserId, currentGeneration);
    }
    return;
  }

  if (authState === "resolved" && nextUserId === currentUserId) {
    return;
  }

  authState = "resolved";
  currentUserId = nextUserId;
  currentGeneration += 1;
  listRequestId += 1;
  countRequestId += 1;
  listLoadState = "idle";
  countLoadState = "idle";
  resetNotificationItems();

  const feedback = query<HTMLElement>("[data-notifications-feedback]");
  if (feedback) {
    feedback.textContent = "";
  }

  if (!nextUserId) {
    setHeaderPending("Notificações, sessão não autenticada");
    setPageView();
    return;
  }

  const generation = currentGeneration;
  void loadUnreadCount(nextUserId, generation);
  void loadNotificationList(nextUserId, generation);
}

function renderAuthError(): void {
  authState = "error";
  currentUserId = null;
  currentGeneration += 1;
  listRequestId += 1;
  countRequestId += 1;
  listLoadState = "idle";
  countLoadState = "idle";
  resetNotificationItems();
  setHeaderPending("Notificações, sessão indisponível");
  setPageView({ hasError: true });
}

function resolveCurrentSession(): Promise<void> {
  if (sessionResolution) {
    return sessionResolution;
  }

  authState = "pending";
  setHeaderPending();
  setPageView({ loading: true });
  const versionBeforeRequest = authEventVersion;

  sessionResolution = supabase.auth
    .getSession()
    .then(({ data, error }) => {
      if (authEventVersion !== versionBeforeRequest) {
        return;
      }

      if (error) {
        renderAuthError();
        return;
      }

      applySession("INITIAL_SESSION", data.session);
    })
    .catch(() => {
      if (authEventVersion === versionBeforeRequest) {
        renderAuthError();
      }
    })
    .finally(() => {
      sessionResolution = null;
    });

  return sessionResolution;
}

async function handleMarkAsRead(button: HTMLButtonElement): Promise<void> {
  const notificationId = button.dataset.notificationId;
  const userId = currentUserId;
  if (!notificationId || !userId || button.disabled) {
    return;
  }

  const generation = currentGeneration;
  const originalLabel = button.textContent ?? "Marcar como lida";
  const feedback = query<HTMLElement>("[data-notifications-feedback]");
  button.disabled = true;
  button.textContent = "Marcando...";
  button.setAttribute("aria-busy", "true");
  if (feedback) {
    feedback.textContent = "";
  }

  try {
    await markNotificationAsRead(notificationId);
    if (
      !isCurrentNotificationRequest(
        userId,
        currentUserId,
        generation,
        currentGeneration,
      )
    ) {
      return;
    }

    const row = button.closest<HTMLElement>("[data-notification-row]");
    const status = row?.querySelector<HTMLElement>("[data-notification-status]");
    const action = row?.querySelector<HTMLElement>("[data-notification-action]");
    if (status) {
      status.className = "status-success";
      status.textContent = "Lida";
    }
    if (action) {
      action.textContent = "—";
    }
    if (feedback) {
      feedback.textContent = "Notificação marcada como lida.";
    }

    void loadUnreadCount(userId, generation);
  } catch {
    if (
      isCurrentNotificationRequest(
        userId,
        currentUserId,
        generation,
        currentGeneration,
      )
    ) {
      button.disabled = false;
      button.textContent = originalLabel;
      button.removeAttribute("aria-busy");
      if (feedback) {
        feedback.textContent =
          "Não foi possível marcar a notificação como lida. Tente novamente.";
      }
    }
  }
}

function bindPageActions(): void {
  const page = query<HTMLElement>("[data-notifications-page]");
  if (!page) {
    return;
  }

  page.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const retryButton = target.closest<HTMLButtonElement>("[data-notifications-retry]");
    if (retryButton) {
      if (currentUserId) {
        const userId = currentUserId;
        const generation = currentGeneration;
        void loadNotificationList(userId, generation);
        void loadUnreadCount(userId, generation);
      } else {
        void resolveCurrentSession();
      }
      return;
    }

    const notificationButton = target.closest<HTMLButtonElement>("[data-notification-id]");
    if (notificationButton) {
      void handleMarkAsRead(notificationButton);
    }
  });
}

export function initializeNotifications(): void {
  if (initialized) {
    return;
  }

  initialized = true;
  bindPageActions();

  supabase.auth.onAuthStateChange((event, session) => {
    authEventVersion += 1;
    applySession(event, session);
  });

  if (authState === "pending") {
    void resolveCurrentSession();
  }
}
