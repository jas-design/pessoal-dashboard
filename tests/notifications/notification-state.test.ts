import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  formatUnreadCount,
  getNotificationRefreshPlan,
  isCurrentNotificationRequest,
  resolveNotificationViewState,
} from "../../src/scripts/notifications/notification-state";
import { isNotificationAlreadyReadByUser } from "../../src/services/notifications/notification-access";

function astroFrontmatter(relativePath: string): string {
  const source = readFileSync(new URL(relativePath, import.meta.url), "utf8");
  return source.split("---", 3)[1] ?? "";
}

test("não mantém consultas de notificações no frontmatter Astro", () => {
  const headerFrontmatter = astroFrontmatter(
    "../../src/components/layout/Header.astro",
  );
  const pageFrontmatter = astroFrontmatter("../../src/pages/notificacoes.astro");

  for (const frontmatter of [headerFrontmatter, pageFrontmatter]) {
    assert.doesNotMatch(
      frontmatter,
      /getNotifications|getUnreadNotificationsCount|markNotificationAsRead|supabase/i,
    );
  }
});

test("mantém loading enquanto a autenticação não foi resolvida", () => {
  assert.equal(
    resolveNotificationViewState({
      authState: "pending",
      authenticated: false,
      loading: false,
      hasError: false,
      itemCount: 0,
    }),
    "loading",
  );
});

test("distingue sessão ausente, erro, lista vazia e lista carregada", () => {
  assert.equal(
    resolveNotificationViewState({
      authState: "resolved",
      authenticated: true,
      loading: true,
      hasError: false,
      itemCount: 0,
    }),
    "loading",
  );
  assert.equal(
    resolveNotificationViewState({
      authState: "resolved",
      authenticated: false,
      loading: false,
      hasError: false,
      itemCount: 0,
    }),
    "unauthenticated",
  );
  assert.equal(
    resolveNotificationViewState({
      authState: "resolved",
      authenticated: true,
      loading: false,
      hasError: true,
      itemCount: 0,
    }),
    "error",
  );
  assert.equal(
    resolveNotificationViewState({
      authState: "resolved",
      authenticated: true,
      loading: false,
      hasError: false,
      itemCount: 0,
    }),
    "empty",
  );
  assert.equal(
    resolveNotificationViewState({
      authState: "resolved",
      authenticated: true,
      loading: false,
      hasError: false,
      itemCount: 2,
    }),
    "ready",
  );
});

test("rejeita resultado assíncrono de usuário ou geração anteriores", () => {
  assert.equal(isCurrentNotificationRequest("user-a", "user-a", 3, 3), true);
  assert.equal(isCurrentNotificationRequest("user-a", "user-b", 3, 3), false);
  assert.equal(isCurrentNotificationRequest("user-a", "user-a", 2, 3), false);
});

test("limita visualmente contagens grandes sem criar um zero fictício", () => {
  assert.equal(formatUnreadCount(0), "0");
  assert.equal(formatUnreadCount(8), "8");
  assert.equal(formatUnreadCount(100), "99+");
});

test("TOKEN_REFRESHED repete somente cargas que falharam para o mesmo usuário", () => {
  assert.deepEqual(
    getNotificationRefreshPlan({
      event: "TOKEN_REFRESHED",
      sameUser: true,
      countState: "success",
      listState: "error",
    }),
    { reloadCount: false, reloadList: true },
  );

  assert.deepEqual(
    getNotificationRefreshPlan({
      event: "TOKEN_REFRESHED",
      sameUser: true,
      countState: "success",
      listState: "success",
    }),
    { reloadCount: false, reloadList: false },
  );

  assert.deepEqual(
    getNotificationRefreshPlan({
      event: "SIGNED_IN",
      sameUser: true,
      countState: "error",
      listState: "error",
    }),
    { reloadCount: false, reloadList: false },
  );
});

test("confirma leitura cruzada somente para notificação lida do usuário atual", () => {
  assert.equal(
    isNotificationAlreadyReadByUser(
      { user_id: "user-a", is_read: true },
      "user-a",
    ),
    true,
  );
  assert.equal(
    isNotificationAlreadyReadByUser(
      { user_id: "user-b", is_read: true },
      "user-a",
    ),
    false,
  );
  assert.equal(
    isNotificationAlreadyReadByUser(
      { user_id: "user-a", is_read: false },
      "user-a",
    ),
    false,
  );
  assert.equal(isNotificationAlreadyReadByUser(null, "user-a"), false);
});
