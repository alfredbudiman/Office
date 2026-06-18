import { createClient } from "@/lib/supabase/server";
import type { ScheduleRow } from "@/lib/post-schedule";

const COLS = "id, title, source_type, video_id, drive_url, platform, scheduled_at, status, posted_at, note, created_by, created_at";

export async function listSchedule(): Promise<ScheduleRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("post_schedule")
    .select(COLS)
    .order("scheduled_at", { ascending: true });
  return (data ?? []) as ScheduleRow[];
}

export type VideoOption = { id: string; judul: string; link_source: string | null };

/** Video yang siap dijadwalkan (sudah Final / Tayang) untuk picker form. */
export async function listSchedulableVideos(): Promise<VideoOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("videos")
    .select("id, judul, link_source, status, final_at")
    .in("status", ["final", "tayang"])
    .order("final_at", { ascending: false });
  return ((data ?? []) as { id: string; judul: string; link_source: string | null }[]).map((v) => ({
    id: v.id,
    judul: v.judul,
    link_source: v.link_source,
  }));
}
