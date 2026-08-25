import { createClient } from '@supabase/supabase-js';
import { publicEnv } from '../env/public';

const supabaseBrowser = createClient(
  publicEnv.supabaseUrl,
  publicEnv.supabaseAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);

export default supabaseBrowser;
