import { createClient } from "@/lib/supabase/server";
import type { VideoStatus, VideoType } from "@/lib/video-workflow";

export type VideoRow = {
  id: string;
  judul: string;
  tipe: VideoType;
  tipe_custom: string | null;
  status: VideoStatus;
  editor_id: string | null;
  parent_video_id: string | null;
  link_source: string | null;
  target_tayang: string | null;
  sudah_tayang: boolean;
  created_at: string;
  final_at: string | null;
  created_by: string | null;
};

export type DraftRow = {
  id: string; video_id: string; nomor_draft: number;
  link_draft: string; created_at: string; created_by: string | null;
};
export type CommentRow = {
  id: string; video_id: string; user_id: string | null;
  isi: string; created_at: string;
};
export type StatusEventRow = {
  id: string; status_lama: VideoStatus | null; status_baru: VideoStatus;
  created_at: string; note: string | null;
};

// RLS otomatis membatasi: owner lihat semua, editor lihat miliknya.
export async function listVideos(): Promise<VideoRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("videos")
    .select("id, judul, tipe, tipe_custom, status, editor_id, parent_video_id, link_source, target_tayang, sudah_tayang, created_at, final_at, created_by")
    .order("created_at", { ascending: false });
  return (data ?? []) as VideoRow[];
}

export async function getVideo(id: string): Promise<VideoRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("videos")
    .select("id, judul, tipe, tipe_custom, status, editor_id, parent_video_id, link_source, target_tayang, sudah_tayang, created_at, final_at, created_by")
    .eq("id", id)
    .maybeSingle();
  return (data as VideoRow) ?? null;
}

export async function getDrafts(videoId: string): Promise<DraftRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("drafts").select("id, video_id, nomor_draft, link_draft, created_at, created_by")
    .eq("video_id", videoId).order("nomor_draft", { ascending: true });
  return (data ?? []) as DraftRow[];
}

export async function getComments(videoId: string): Promise<CommentRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("comments").select("id, video_id, user_id, isi, created_at")
    .eq("video_id", videoId).order("created_at", { ascending: true });
  return (data ?? []) as CommentRow[];
}

export async function getStatusEvents(videoId: string): Promise<StatusEventRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("status_events").select("id, status_lama, status_baru, created_at, note")
    .eq("video_id", videoId).order("created_at", { ascending: true });
  return (data ?? []) as StatusEventRow[];
}

export async function listEditors(): Promise<{ id: string; nama: string }[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles").select("id, nama").eq("role", "editor").eq("aktif", true).order("nama");
  return (data ?? []) as { id: string; nama: string }[];
}
