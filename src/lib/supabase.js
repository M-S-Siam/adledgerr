import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://zgyldkvrzmdrvjhtbmcg.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_gp13Q3fRTgGd6hlXzjK2jQ_GTUT_sEu';

export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);
