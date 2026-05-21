import { requireProfile } from "@/lib/auth";
import { listVideos, listEditors } from "@/lib/videos";
import { createClient } from "@/lib/supabase/server";
import { VideoBoard } from "./video-board";
import { NewVideoForm } from "./new-video-form";
import type { VideoType, VideoStatus } from "@/lib/video-workflow";

export default async function VideoPage() {
  const profile = await requireProfile();
  const videos = await listVideos();

  const supabase = await createClient();
  const { data: profs } = await supabase.from("profiles").select("id, nama");
  const namaById = new Map((profs ?? []).map((p: { id: string; nama: string }) => [p.id, p.nama]));

  const cards = videos.map((v) => ({
    id: v.id, judul: v.judul, tipe: v.tipe as VideoType, status: v.status as VideoStatus,
    editorNama: v.editor_id ? namaById.get(v.editor_id) ?? null : null,
  }));

  const editors = profile.role === "owner" ? await listEditors() : [];
  const parents = profile.role === "owner"
    ? videos.filter((v) => v.tipe !== "clipping").map((v) => ({ id: v.id, judul: v.judul }))
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{profile.role === "owner" ? "Video" : "Video Saya"}</h1>
        {profile.role === "owner" && <NewVideoForm editors={editors} parents={parents} />}
      </div>
      <VideoBoard cards={cards} />
    </div>
  );
}
