import supabase from "../../lib/supabase/browser";

export interface AccessibleFinancialCompany {
  id: string;
  name: string;
  is_active: boolean;
}

export async function getAccessibleFinancialCompanies() {
  const { data: userData, error: authError } = await supabase.auth.getUser();

  if (authError || !userData.user) {
    throw new Error("Sessao necessaria para carregar as empresas.");
  }

  const { data, error } = await supabase
    .from("companies")
    .select("id, name, is_active")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as AccessibleFinancialCompany[];
}
