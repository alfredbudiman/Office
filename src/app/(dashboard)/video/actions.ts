"use server";

import { revalidatePath } from "next/cache";
import { requireProfile, requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { notify } from "@/lib/notifications";
import { getVideo } from "@/lib/videos";
import {
  initialStatus, applyAction, ACTIONS, STATUS_ORDER,
  type VideoType, type VideoAction, type VideoStatus,
} from "@/lib/video-workflow";

function isUrl(s: string) {
  try { new URL(s); return true; } catch { return false; }
}

export async function createVideo(_prev: unknown, formData: FormData) {
  await requireRole("owner");
  const judul = String(formData.get("judul") ?? "").trim();
  const tipe = String(formData.get("tipe") ?? "") as VideoType;
  const tipeCustomRaw = String(formData.get("tipe_custom") ?? "").trim();
  const editorId = String(formData.get("editor_id") ?? "") || null;
  const linkSource = String(formData.get("link_source") ?? "").trim();
  const parentId = String(formData.get("parent_video_id") ?? "") || null;

  const errors: Record<string, string> = {};
  if (!judul) errors.judul = "Judul wajib diisi";
  if (!["monolog", "podcast", "shorts", "clipping", "lainnya"].includes(tipe)) errors.tipe = "Tipe tidak valid";
  if (tipe === "lainnya" && (!tipeCustomRaw || tipeCustomRaw.length > 50)) {
    errors.tipe_custom = "Nama tipe wajib 1–50 karakter";
  }
  if (linkSource && !isUrl(linkSource)) errors.link_source = "Link harus URL valid";
  if (tipe === "clipping" && !parentId) errors.parent_video_id = "Clipping wajib pilih video induk";
  if (Object.keys(errors).length) return { ok: false, errors };

  const profile = await requireProfile();
  const supabase = await createClient();
  const { data, error } = await supabase.from("videos").insert({
    judul, tipe,
    tipe_custom: tipe === "lainnya" ? tipeCustomRaw : null,
    status: initialStatus(tipe),
    editor_id: editorId, parent_video_id: parentId,
    link_source: linkSource || null, created_by: profile.id,
  }).select("id").single();
  if (error) return { ok: false, errors: { judul: error.message } };

  if (editorId) await notify(editorId, `Video baru ditugaskan: ${judul}`, `/video/${data.id}`);
  revalidatePath("/video");
  return { ok: true, errors: {}, id: data.id };
}

export async function applyVideoAction(
  videoId: string,
  action: VideoAction,
  link?: string,
  targetStatus?: VideoStatus,
  note?: string,
) {
  const profile = await requireProfile();
  const video = await getVideo(videoId);
  if (!video) return { ok: false, error: "Video tidak ditemukan" };

  if (action === "force_set_status") {
    if (profile.role !== "owner") return { ok: false, error: "Hanya owner yang bisa lompat status" };
    if (!targetStatus || !STATUS_ORDER.includes(targetStatus)) {
      return { ok: false, error: "Status tujuan tidak valid" };
    }
    if (targetStatus === video.status) return { ok: false, error: `Status sudah ${targetStatus}` };
    const trimmedNote = (note ?? "").trim();
    if (trimmedNote.length < 3 || trimmedNote.length > 200) {
      return { ok: false, error: "Catatan wajib 3–200 karakter" };
    }

    const supabase = await createClient();
    const patch: Record<string, unknown> = { status: targetStatus };
    if (targetStatus === "final" && video.status !== "final") {
      patch.final_at = new Date().toISOString();
    }
    if (video.status === "final" && targetStatus !== "final") {
      patch.final_at = null;
    }
    if (targetStatus === "tayang" && video.status !== "tayang") {
      patch.sudah_tayang = true;
      patch.published_at = new Date().toISOString();
    }
    if (video.status === "tayang" && targetStatus !== "tayang") {
      patch.sudah_tayang = false;
      patch.published_at = null;
    }
    const { error: upErr } = await supabase.from("videos").update(patch).eq("id", videoId);
    if (upErr) return { ok: false, error: upErr.message };

    await supabase.from("status_events").insert({
      video_id: videoId,
      status_lama: video.status,
      status_baru: targetStatus,
      changed_by: profile.id,
      note: trimmedNote,
    });

    const counterpart = video.editor_id;
    await notify(counterpart, `Status "${video.judul}" diubah → ${targetStatus} (manual)`, `/video/${videoId}`);

    revalidatePath(`/video/${videoId}`);
    revalidatePath("/video");
    return { ok: true };
  }

  const def = ACTIONS[action];
  if (!def) return { ok: false, error: "Aksi tidak dikenal" };
  if (def.role !== profile.role) return { ok: false, error: "Anda tidak berhak melakukan aksi ini" };
  if (profile.role === "editor" && video.editor_id !== profile.id) {
    return { ok: false, error: "Bukan video Anda" };
  }
  if (def.requiresLink && (!link || !isUrl(link))) {
    return { ok: false, error: "Link draft harus URL valid" };
  }

  const res = applyAction(video.status, action);
  if (!res.ok) return { ok: false, error: res.error };

  const supabase = await createClient();

  if (def.createsDraft && link) {
    const { count } = await supabase.from("drafts")
      .select("id", { count: "exact", head: true }).eq("video_id", videoId);
    await supabase.from("drafts").insert({
      video_id: videoId, nomor_draft: (count ?? 0) + 1, link_draft: link, created_by: profile.id,
    });
  }

  const patch: Record<string, unknown> = { status: res.to };
  if (res.to === "final") patch.final_at = new Date().toISOString();
  if (res.to === "tayang") { patch.sudah_tayang = true; patch.published_at = new Date().toISOString(); }
  const { error: upErr } = await supabase.from("videos").update(patch).eq("id", videoId);
  if (upErr) return { ok: false, error: upErr.message };

  await supabase.from("status_events").insert({
    video_id: videoId, status_lama: video.status, status_baru: res.to, changed_by: profile.id,
  });

  const counterpart = profile.role === "owner" ? video.editor_id : video.created_by ?? null;
  await notify(counterpart, `Status "${video.judul}" → ${res.to}`, `/video/${videoId}`);

  revalidatePath(`/video/${videoId}`);
  revalidatePath("/video");
  return { ok: true };
}

export async function addComment(videoId: string, isi: string) {
  const profile = await requireProfile();
  const text = isi.trim();
  if (!text) return { ok: false, error: "Komentar kosong" };
  const video = await getVideo(videoId);
  if (!video) return { ok: false, error: "Video tidak ditemukan" };

  const supabase = await createClient();
  const { error } = await supabase.from("comments")
    .insert({ video_id: videoId, user_id: profile.id, isi: text });
  if (error) return { ok: false, error: error.message };

  const counterpart = profile.role === "owner" ? video.editor_id : video.created_by ?? null;
  await notify(counterpart, `Komentar baru di "${video.judul}"`, `/video/${videoId}`);

  revalidatePath(`/video/${videoId}`);
  return { ok: true };
}
