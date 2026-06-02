"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getTodayAttendance } from "@/lib/attendance-data";
import { buildProgressSummary } from "@/lib/progress-summary";
import type { VideoStatus } from "@/lib/video-workflow";

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

export type ClockOutResult =
  | { ok: true; summary: string; role: string; nama: string }
  | { ok: false; error: string };

export async function clockOut(extraNote?: string): Promise<ClockOutResult> {
  const profile = await requireProfile();
  const supabase = await createClient();
  const existing = await getTodayAttendance(profile.id);
  if (!existing || !existing.clock_in) return { ok: false, error: "Belum clock in" };
  if (existing.clock_out) return { ok: false, error: "Sudah clock out hari ini" };

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
