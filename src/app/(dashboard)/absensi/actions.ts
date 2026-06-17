"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getTodayAttendance, getOpenAttendance } from "@/lib/attendance-data";
import { localDateStr, planClockIn } from "@/lib/attendance";

export async function clockIn() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const open = await getOpenAttendance(profile.id);
  const today = await getTodayAttendance(profile.id);
  const now = new Date().toISOString();

  const plan = planClockIn(open, today);
  if (plan.action === "reject") return { ok: false, error: plan.reason };

  if (plan.action === "resume") {
    const { error } = await supabase.from("attendance").update({ clock_in: now }).eq("id", plan.id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase
      .from("attendance")
      .insert({ user_id: profile.id, tanggal: localDateStr(), clock_in: now });
    if (error) return { ok: false, error: error.message };
  }
  revalidatePath("/absensi");
  return { ok: true };
}

export async function clockOut() {
  const profile = await requireProfile();
  const supabase = await createClient();
  // Cari shift yang masih berjalan apa pun tanggalnya — supaya shift malam yang
  // dimulai kemarin tetap bisa di-clock-out subuh ini.
  const open = await getOpenAttendance(profile.id);
  if (!open) return { ok: false, error: "Belum clock in" };

  const { error } = await supabase
    .from("attendance")
    .update({ clock_out: new Date().toISOString() })
    .eq("id", open.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/absensi");
  return { ok: true };
}
