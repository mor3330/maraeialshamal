import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const PLACEHOLDER_URL = "https://placeholder.supabase.co";
const PLACEHOLDER_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder";

function getSafeSupabaseUrl() {
  const candidate = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!candidate) return PLACEHOLDER_URL;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") return candidate;
  } catch {}
  return PLACEHOLDER_URL;
}

function getSafeSupabaseKey(envKey: string | undefined) {
  return envKey?.trim() || PLACEHOLDER_KEY;
}

export function getSupabaseClient() {
  return createClient<Database>(
    getSafeSupabaseUrl(),
    getSafeSupabaseKey(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  );
}

export function createServiceClient() {
  return createClient<Database>(
    getSafeSupabaseUrl(),
    getSafeSupabaseKey(process.env.SUPABASE_SERVICE_ROLE_KEY),
    {
      auth: { autoRefreshToken: false, persistSession: false },
      // منع Next.js من كاش أي fetch يصدر من Supabase client
      global: {
        fetch: (url, options = {}) =>
          fetch(url, { ...options, cache: "no-store" }),
      },
    }
  );
}
