import { createClient } from "@/lib/supabase/server";
import type { VideoStatus, VideoType } from "@/lib/video-workflow";
import type { EventLite } from "@/lib/rekap";

export type RekapFilter = { from: string; to: string; editorId?: string; tipe?: VideoType };

export type CompletedVideo = {
  id: string; judul: string; tipe: VideoType; editor_id: string | null;
  created_at: string; final_at: string;
};

export async function getCompletedVideos(f: RekapFilter): Promise<CompletedVideo[]> {
  const supabase = await createClient();
  let q = supabase
    .from("videos")
    .select("id, judul, tipe, editor_id, created_at, final_at")
    .not("final_at", "is", null)
    .gte("final_at", `${f.from}T00:00:00Z`)
    .lte("final_at", `${f.to}T23:59:59Z`)
    .order("final_at", { ascending: false });
  if (f.editorId) q = q.eq("editor_id", f.editorId);
  if (f.tipe) q = q.eq("tipe", f.tipe);
  const { data } = await q;
  return (data ?? []) as CompletedVideo[];
}

export async function getEventsByVideo(videoIds: string[]): Promise<Map<string, EventLite[]>> {
  const map = new Map<string, EventLite[]>();
  if (videoIds.length === 0) return map;
  const supabase = await createClient();
  const { data } = await supabase
    .from("status_events")
    .select("video_id, status_baru, created_at")
    .in("video_id", videoIds)
    .order("created_at", { ascending: true });
  for (const row of (data ?? []) as { video_id: string; status_baru: VideoStatus; created_at: string }[]) {
    const list = map.get(row.video_id) ?? [];
    list.push({ status_baru: row.status_baru, created_at: row.created_at });
    map.set(row.video_id, list);
  }
  return map;
}
