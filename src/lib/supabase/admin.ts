import { createClient } from "@supabase/supabase-js";

// HANYA dipakai di server actions. Bypass RLS — jangan pernah import di client.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
