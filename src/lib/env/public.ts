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

    if (url.protocol !== "https:" && !url.hostname.includes("localhost")) {
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
