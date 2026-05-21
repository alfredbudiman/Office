"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function markAllRead(): Promise<void> {
  await requireProfile();
  const supabase = await createClient();
  await supabase.from("notifications").update({ sudah_dibaca: true }).eq("sudah_dibaca", false);
  revalidatePath("/notifikasi");
  revalidatePath("/", "layout");
}
