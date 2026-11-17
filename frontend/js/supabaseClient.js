
// Supabase project configuration
const SUPABASE_URL = "https://hsfiylkwffbplbbryrth.supabase.co";
const SUPABASE_KEY = "sb_publishable_6F7rktgxL3FFbI59569ukQ_yyxIHcLg";

// Create Supabase client
const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);
