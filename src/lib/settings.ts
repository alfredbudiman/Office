import { createClient } from "@/lib/supabase/server";

export async function getSetting(key: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  const v = (data as { value: string } | null)?.value ?? null;
  return v && v.length > 0 ? v : null;
}

export async function setSetting(
  key: string,
  value: string,
  userId: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("settings")
    .upsert(
      { key, value, updated_at: new Date().toISOString(), updated_by: userId },
      { onConflict: "key" },
    );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
