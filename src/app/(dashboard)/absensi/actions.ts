"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getTodayAttendance } from "@/lib/attendance-data";

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function clockIn() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const existing = await getTodayAttendance(profile.id);
  const now = new Date().toISOString();

  if (!existing) {
    const { error } = await supabase
      .from("attendance")
      .insert({ user_id: profile.id, tanggal: todayStr(), clock_in: now });
    if (error) return { ok: false, error: error.message };
  } else if (!existing.clock_in) {
    const { error } = await supabase.from("attendance").update({ clock_in: now }).eq("id", existing.id);
    if (error) return { ok: false, error: error.message };
  } else {
    return { ok: false, error: "Sudah clock in hari ini" };
  }
  revalidatePath("/absensi");
  return { ok: true };
}

export async function clockOut() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const existing = await getTodayAttendance(profile.id);
  if (!existing || !existing.clock_in) return { ok: false, error: "Belum clock in" };
  if (existing.clock_out) return { ok: false, error: "Sudah clock out hari ini" };

  const { error } = await supabase
    .from("attendance")
    .update({ clock_out: new Date().toISOString() })
    .eq("id", existing.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/absensi");
  return { ok: true };
}
