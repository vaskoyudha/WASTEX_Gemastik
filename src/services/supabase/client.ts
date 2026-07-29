import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || "http://localhost:54321";
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "test-anon-key";

let _client: ReturnType<typeof createClient> | null = null;

export function createSupabaseClient(): ReturnType<typeof createClient> {
  if (!_client) {
    _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return _client;
}

// Lazy init for tests that mock the module
export const supabase = createSupabaseClient();
