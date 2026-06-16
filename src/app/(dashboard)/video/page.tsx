import { requireRole } from "@/lib/auth";
import { listVideos } from "@/lib/videos";
import { createClient } from "@/lib/supabase/server";
import { VideoBoard } from "./video-board";
import { NewVideoForm } from "./new-video-form";
import { PageHeader } from "@/components/ui-kit";
import type { VideoType, VideoStatus } from "@/lib/video-workflow";

type ProfileRow = { id: string; nama: string; role: string; aktif: boolean };

export default async function VideoPage() {
  const supabase = await createClient();
  // Jalankan paralel: auth/profil, daftar video, dan semua profil sekaligus
  // (daftar editor diturunkan dari profil — tidak perlu query terpisah).
  const [profile, videos, profsRes] = await Promise.all([
    requireRole("owner", "editor"),
    listVideos(),
    supabase.from("profiles").select("id, nama, role, aktif"),
  ]);
  const profs = (profsRes.data ?? []) as ProfileRow[];
  const namaById = new Map(profs.map((p) => [p.id, p.nama]));

  const cards = videos.map((v) => ({
    id: v.id, judul: v.judul, tipe: v.tipe as VideoType, tipe_custom: v.tipe_custom,
    status: v.status as VideoStatus,
    editorNama: v.editor_id ? namaById.get(v.editor_id) ?? null : null,
  }));

  const isOwner = profile.role === "owner";
  const editors = isOwner
    ? profs.filter((p) => p.role === "editor" && p.aktif).map((p) => ({ id: p.id, nama: p.nama }))
    : [];
  const parents = isOwner
    ? videos.filter((v) => v.tipe !== "clipping").map((v) => ({ id: v.id, judul: v.judul }))
    : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={isOwner ? "Video" : "Video Saya"}
        description="Alur produksi dari cut-to-cut sampai tayang."
      >
        {isOwner && <NewVideoForm editors={editors} parents={parents} />}
      </PageHeader>
      <VideoBoard cards={cards} />
    </div>
  );
}
