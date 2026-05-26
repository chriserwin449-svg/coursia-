import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://vbsrliluwytuyulpvflr.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZic3JsaWx1d3l0dXl1bHB2ZmxyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MDkzMjIsImV4cCI6MjA5NTM4NTMyMn0.YMQGLksgpK3aB5xCE8vjmb_-YCfgJO4nTdS13FbQsA4";

// Client-side compatible Supabase client
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
