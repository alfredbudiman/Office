"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getTodayAttendance, getOpenAttendance } from "@/lib/attendance-data";
import { planClockIn } from "@/lib/attendance";
import { buildProgressSummary } from "@/lib/progress-summary";
import { wibToday } from "@/lib/wib";
import type { VideoStatus } from "@/lib/video-workflow";

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
      .insert({ user_id: profile.id, tanggal: wibToday(), clock_in: now });
    if (error) return { ok: false, error: error.message };
  }
  revalidatePath("/absensi");
  return { ok: true };
}

export type ClockOutResult =
  | { ok: true; summary: string; role: string; nama: string }
  | { ok: false; error: string };

export async function clockOut(extraNote?: string): Promise<ClockOutResult> {
  const profile = await requireProfile();
  const supabase = await createClient();
  // Cari shift yang masih berjalan apa pun tanggalnya — supaya shift malam yang
  // dimulai kemarin tetap bisa di-clock-out subuh ini (bukan hanya record "hari ini").
  const existing = await getOpenAttendance(profile.id);
  if (!existing || !existing.clock_in) return { ok: false, error: "Belum clock in" };

  const since = existing.clock_in;
  const clockOutTime = new Date();

  // Status moves user hari ini sejak clock_in
  const { data: eventsData } = await supabase
    .from("status_events")
    .select("status_baru, created_at, videos!inner(judul)")
    .eq("changed_by", profile.id)
    .gte("created_at", since)
    .order("created_at", { ascending: true });

  const statusMoves = ((eventsData ?? []) as Array<{
    status_baru: VideoStatus;
    videos: { judul: string } | { judul: string }[];
  }>).map((r) => ({
    judul: Array.isArray(r.videos) ? r.videos[0]?.judul ?? "—" : r.videos.judul,
    statusBaru: r.status_baru,
  }));

  // Komentar user hari ini sejak clock_in
  const { data: commentsData } = await supabase
    .from("comments")
    .select("isi, created_at, videos!inner(judul)")
    .eq("user_id", profile.id)
    .gte("created_at", since)
    .order("created_at", { ascending: true });

  const comments = ((commentsData ?? []) as Array<{
    isi: string;
    videos: { judul: string } | { judul: string }[];
  }>).map((r) => ({
    judul: Array.isArray(r.videos) ? r.videos[0]?.judul ?? "—" : r.videos.judul,
    isi: r.isi,
  }));

  const summary = buildProgressSummary({
    nama: profile.nama,
    clockOutTime,
    statusMoves,
    comments,
    extraNote,
  });

  const { error } = await supabase
    .from("attendance")
    .update({ clock_out: clockOutTime.toISOString(), progress_summary: summary })
    .eq("id", existing.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/absensi");
  return { ok: true, summary, role: profile.role, nama: profile.nama };
}
