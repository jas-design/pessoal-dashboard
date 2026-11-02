function readPublicEnv(name: "PUBLIC_SUPABASE_URL" | "PUBLIC_SUPABASE_ANON_KEY") {
  const value = import.meta.env[name];

  if (!value) {
    throw new Error(`Missing required public environment variable: ${name}`);
  }

  return value;
}

function readSupabaseUrl() {
  const value = readPublicEnv("PUBLIC_SUPABASE_URL");

  try {
    const url = new URL(value);
    const isLocalLoopback =
      url.hostname === "localhost" ||
      url.hostname === "127.0.0.1" ||
      url.hostname === "[::1]";

    if (url.protocol !== "https:" && !isLocalLoopback) {
      throw new Error("Supabase URL must use HTTPS outside local development.");
    }

    return value;
  } catch {
    throw new Error("PUBLIC_SUPABASE_URL must be a valid URL.");
  }
}

export const publicEnv = {
  supabaseUrl: readSupabaseUrl(),
  supabaseAnonKey: readPublicEnv("PUBLIC_SUPABASE_ANON_KEY"),
};
