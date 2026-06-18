"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PLATFORMS, type SourceType } from "@/lib/post-schedule";

const SOURCES: SourceType[] = ["video", "bank_konten", "manual"];

function wibIso(date: string, time: string) {
  return `${date}T${time}:00+07:00`;
}
function revalidateAll() {
  revalidatePath("/jadwal");
  revalidatePath("/dashboard");
}

/** Buat jadwal multi-platform sekaligus.
 *  FormData: title, source_type, video_id, drive_url, note, dan per platform:
 *  pf_<platform> (checkbox), date_<platform>, time_<platform>. */
export async function createSchedule(_prev: unknown, formData: FormData) {
  const actor = await requireRole("owner", "social_media");
  const title = String(formData.get("title") ?? "").trim();
  const sourceRaw = String(formData.get("source_type") ?? "manual");
  const source_type: SourceType = SOURCES.includes(sourceRaw as SourceType) ? (sourceRaw as SourceType) : "manual";
  const videoId = String(formData.get("video_id") ?? "").trim();
  const drive_url = String(formData.get("drive_url") ?? "").trim() || null;
  const note = String(formData.get("note") ?? "").trim() || null;

  const errors: Record<string, string> = {};
  if (!title) errors.title = "Judul wajib diisi";

  const inserts: Record<string, unknown>[] = [];
  for (const p of PLATFORMS) {
    if (formData.get(`pf_${p}`) == null) continue; // tidak dicentang
    const date = String(formData.get(`date_${p}`) ?? "");
    const time = String(formData.get(`time_${p}`) ?? "");
    if (!date || !time) { errors[`pf_${p}`] = "Tanggal & jam wajib"; continue; }
    inserts.push({
      title, source_type,
      video_id: source_type === "video" && videoId ? videoId : null,
      drive_url, note, platform: p, scheduled_at: wibIso(date, time), created_by: actor.id,
    });
  }
  if (inserts.length === 0 && !errors.platform) errors.platform = "Pilih minimal 1 platform + tanggal/jam";
  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const supabase = await createClient();
  const { error } = await supabase.from("post_schedule").insert(inserts);
  if (error) return { ok: false, errors: { general: error.message } };
  revalidateAll();
  return { ok: true, errors: {} };
}

export async function updateSchedule(id: string, date: string, time: string) {
  await requireRole("owner", "social_media");
  if (!date || !time) return { ok: false, error: "Tanggal & jam wajib" };
  const supabase = await createClient();
  const { error } = await supabase.from("post_schedule").update({ scheduled_at: wibIso(date, time) }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidateAll();
  return { ok: true };
}

export async function togglePosted(id: string, posted: boolean) {
  await requireRole("owner", "social_media");
  const supabase = await createClient();
  const patch = posted
    ? { status: "posted" as const, posted_at: new Date().toISOString() }
    : { status: "scheduled" as const, posted_at: null };
  const { error } = await supabase.from("post_schedule").update(patch).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidateAll();
  return { ok: true };
}

export async function deleteSchedule(id: string) {
  await requireRole("owner", "social_media");
  const supabase = await createClient();
  const { error } = await supabase.from("post_schedule").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidateAll();
  return { ok: true };
}

/** Tandai/lepas konten sebagai "sudah diposting (tanpa jadwal)". */
export async function markPostedContent(
  contentKey: string, sourceType: SourceType, title: string, videoId: string | null, done: boolean,
) {
  const actor = await requireRole("owner", "social_media");
  const supabase = await createClient();
  if (done) {
    const { error } = await supabase.from("posted_content").upsert(
      { content_key: contentKey, source_type: sourceType, title, video_id: videoId, marked_by: actor.id },
      { onConflict: "content_key" },
    );
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase.from("posted_content").delete().eq("content_key", contentKey);
    if (error) return { ok: false, error: error.message };
  }
  revalidatePath("/jadwal");
  revalidatePath("/bank-konten");
  revalidatePath("/video");
  if (videoId) revalidatePath(`/video/${videoId}`);
  return { ok: true };
}

export async function saveContentPrep(_prev: unknown, formData: FormData) {
  const actor = await requireRole("owner", "social_media");
  const content_key = String(formData.get("content_key") ?? "");
  if (!content_key) return { ok: false, error: "content_key kosong" };
  const description = String(formData.get("description") ?? "").trim() || null;
  const tags = String(formData.get("tags") ?? "").trim() || null;
  const supabase = await createClient();
  const { error } = await supabase.from("content_prep").upsert(
    { content_key, description, tags, updated_by: actor.id, updated_at: new Date().toISOString() },
    { onConflict: "content_key" },
  );
  if (error) return { ok: false, error: error.message };
  revalidatePath("/jadwal");
  return { ok: true };
}

export async function uploadThumbnail(_prev: unknown, formData: FormData) {
  const actor = await requireRole("owner", "social_media");
  const content_key = String(formData.get("content_key") ?? "");
  const file = formData.get("file");
  if (!content_key) return { ok: false, error: "content_key kosong" };
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Pilih file gambar dulu" };
  if (file.size > 5 * 1024 * 1024) return { ok: false, error: "Maksimal 5MB" };

  const admin = createAdminClient();
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `${content_key.replace(/[^a-z0-9]/gi, "_")}/${Date.now()}.${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());
  const up = await admin.storage.from("thumbnails").upload(path, buf, {
    contentType: file.type || "image/jpeg",
    upsert: true,
  });
  if (up.error) return { ok: false, error: up.error.message };
  const { data: pub } = admin.storage.from("thumbnails").getPublicUrl(path);

  const supabase = await createClient();
  const { error } = await supabase.from("content_prep").upsert(
    { content_key, thumbnail_url: pub.publicUrl, updated_by: actor.id, updated_at: new Date().toISOString() },
    { onConflict: "content_key" },
  );
  if (error) return { ok: false, error: error.message };
  revalidatePath("/jadwal");
  return { ok: true, url: pub.publicUrl };
}
