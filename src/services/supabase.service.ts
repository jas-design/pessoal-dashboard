import { supabase } from '../lib/supabase';

export function getSupabaseClient() {
  return supabase;
}