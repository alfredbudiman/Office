import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Dibuat dari server action untuk SIAPA SAJA (penerima != aktor) -> pakai admin (bypass RLS insert).
export async function notify(userId: string | null, pesan: string, link: string) {
  if (!userId) return;
  const admin = createAdminClient();
  await admin.from("notifications").insert({ user_id: userId, pesan, link });
}

export async function unreadCount(): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("sudah_dibaca", false);
  return count ?? 0;
}

export async function listNotifications() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .select("id, pesan, link, sudah_dibaca, created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  return data ?? [];
}
