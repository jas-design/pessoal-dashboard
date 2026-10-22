import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  throw new Error("Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY do staging local.");
}

const parsedUrl = new URL(url);
if (
  !["127.0.0.1", "localhost"].includes(parsedUrl.hostname)
  || parsedUrl.port !== "56321"
) {
  throw new Error("Recusado: o cleanup aceita somente o staging local na porta 56321.");
}

const admin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
if (error) {
  throw new Error(`Falha ao listar usuarios sinteticos: ${error.message}`);
}

const syntheticUsers = data.users.filter((user) => (
  /^07c11-[a-z-]+@example\.test$/.test(user.email ?? "")
  && user.user_metadata?.synthetic === true
  && user.user_metadata?.stage === "07C.11"
));

for (const user of syntheticUsers) {
  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) {
    throw new Error(`Falha ao remover ${user.email}: ${deleteError.message}`);
  }
}

console.log(JSON.stringify({ removed: syntheticUsers.length }));
