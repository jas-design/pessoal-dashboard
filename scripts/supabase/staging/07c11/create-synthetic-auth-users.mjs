import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.SYNTHETIC_TEST_PASSWORD;

if (!url || !anonKey || !serviceRoleKey || !password) {
  throw new Error(
    "Defina SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY e SYNTHETIC_TEST_PASSWORD."
  );
}

const parsedUrl = new URL(url);
if (
  !["127.0.0.1", "localhost"].includes(parsedUrl.hostname)
  || parsedUrl.port !== "56321"
) {
  throw new Error("Recusado: o teste Auth aceita somente o staging local na porta 56321.");
}

if (password.length < 12) {
  throw new Error("Use uma senha sintetica de teste com pelo menos 12 caracteres.");
}

const admin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const browser = createClient(url, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const actors = [
  "owner-a",
  "owner-b",
  "company-admin-a",
  "reviewer-a",
  "viewer-a",
  "unlinked",
  "global-admin",
  "profile-candidate",
];

const ids = {};

for (const actor of actors) {
  const email = `07c11-${actor}@example.test`;
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { synthetic: true, stage: "07C.11", actor },
  });

  if (createError || !created.user) {
    throw new Error(`Falha ao criar ${actor}: ${createError?.message ?? "usuario ausente"}`);
  }

  const { data: session, error: loginError } = await browser.auth.signInWithPassword({
    email,
    password,
  });

  if (loginError || session.user?.id !== created.user.id) {
    throw new Error(`Falha no login sintetico de ${actor}: ${loginError?.message ?? "ID divergente"}`);
  }

  ids[actor] = created.user.id;
  await browser.auth.signOut();
}

// Somente identificadores e e-mails sinteticos sao exibidos. Chaves e senha
// permanecem exclusivamente nas variaveis do processo local.
console.log(JSON.stringify(ids, null, 2));

