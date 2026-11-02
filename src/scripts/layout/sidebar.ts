import type { Session } from "@supabase/supabase-js";
import supabase from "../../lib/supabase/browser";

let initialized = false;
let authEventVersion = 0;

function getDisplayName(session: Session): string {
  const metadata = session.user.user_metadata;
  const candidates = [metadata?.full_name, metadata?.name, metadata?.display_name];
  const displayName = candidates.find(
    (value): value is string => typeof value === "string" && value.trim().length > 0,
  );

  return displayName?.trim().slice(0, 80) || "Usuário autenticado";
}

function getInitials(displayName: string): string {
  if (displayName === "Usuário autenticado") {
    return "US";
  }

  const words = displayName.split(/\s+/).filter(Boolean);
  const initials = words.length > 1
    ? `${words[0]?.[0] ?? ""}${words.at(-1)?.[0] ?? ""}`
    : words[0]?.slice(0, 2) ?? "US";

  return initials.toLocaleUpperCase("pt-BR");
}

function isValidSession(session: Session | null): session is Session {
  if (!session?.user?.id) {
    return false;
  }

  return !session.expires_at || session.expires_at * 1000 > Date.now();
}

function renderSession(session: Session | null): void {
  const name = document.querySelector<HTMLElement>("[data-sidebar-user-name]");
  const status = document.querySelector<HTMLElement>("[data-sidebar-user-status]");
  const avatar = document.querySelector<HTMLElement>("[data-sidebar-user-avatar]");

  if (!name || !status || !avatar) {
    return;
  }

  if (!isValidSession(session)) {
    name.textContent = "Sessão não autenticada";
    status.textContent = "Acesso indisponível";
    avatar.textContent = "—";
    return;
  }

  const displayName = getDisplayName(session);
  name.textContent = displayName;
  status.textContent = "Sessão ativa";
  avatar.textContent = getInitials(displayName);
}

function renderSessionError(): void {
  const name = document.querySelector<HTMLElement>("[data-sidebar-user-name]");
  const status = document.querySelector<HTMLElement>("[data-sidebar-user-status]");
  const avatar = document.querySelector<HTMLElement>("[data-sidebar-user-avatar]");

  if (name) name.textContent = "Sessão indisponível";
  if (status) status.textContent = "Não foi possível verificar";
  if (avatar) avatar.textContent = "—";
}

export function initializeSidebarSession(): void {
  if (initialized) {
    return;
  }

  initialized = true;

  supabase.auth.onAuthStateChange((_event, session) => {
    authEventVersion += 1;
    renderSession(session);
  });

  const versionBeforeRequest = authEventVersion;
  supabase.auth
    .getSession()
    .then(({ data, error }) => {
      if (authEventVersion !== versionBeforeRequest) {
        return;
      }

      if (error) {
        renderSessionError();
        return;
      }

      renderSession(data.session);
    })
    .catch(() => {
      if (authEventVersion === versionBeforeRequest) {
        renderSessionError();
      }
    });
}
