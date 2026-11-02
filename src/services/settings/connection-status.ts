export type SupabaseConnectionState =
  | "loading"
  | "session_missing"
  | "service_verified"
  | "verification_error";

export interface SupabaseConnectionStatus {
  label: string;
  detail: string;
  badgeState: "neutral" | "connected" | "disconnected";
}

export function resolveSupabaseConnectionStatus(
  state: SupabaseConnectionState,
): SupabaseConnectionStatus {
  if (state === "service_verified") {
    return {
      label: "Serviço verificado",
      detail: "Sessão autenticada e consulta autorizada concluída.",
      badgeState: "connected",
    };
  }

  if (state === "session_missing") {
    return {
      label: "Sem sessão",
      detail: "Cliente configurado; entre na conta para verificar o serviço.",
      badgeState: "disconnected",
    };
  }

  if (state === "verification_error") {
    return {
      label: "Não verificado",
      detail: "A configuração está disponível, mas o serviço não pôde ser confirmado agora.",
      badgeState: "neutral",
    };
  }

  return {
    label: "Verificando",
    detail: "Cliente configurado; verificando sessão e acesso ao serviço.",
    badgeState: "neutral",
  };
}
