"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PLATFORMS, type Platform, type SourceType } from "@/lib/post-schedule";

const SOURCES: SourceType[] = ["video", "bank_konten", "manual"];

export async function createSchedule(_prev: unknown, formData: FormData) {
  const actor = await requireRole("owner", "social_media");

  const title = String(formData.get("title") ?? "").trim();
  const sourceRaw = String(formData.get("source_type") ?? "manual");
  const source_type: SourceType = SOURCES.includes(sourceRaw as SourceType) ? (sourceRaw as SourceType) : "manual";
  const videoId = String(formData.get("video_id") ?? "").trim();
  const drive_url = String(formData.get("drive_url") ?? "").trim() || null;
  const platform = String(formData.get("platform") ?? "") as Platform;
  const date = String(formData.get("date") ?? "");
  const time = String(formData.get("time") ?? "");
  const note = String(formData.get("note") ?? "").trim() || null;

  const errors: Record<string, string> = {};
  if (!title) errors.title = "Judul wajib diisi";
  if (!PLATFORMS.includes(platform)) errors.platform = "Pilih platform";
  if (!date) errors.date = "Tanggal wajib";
  if (!time) errors.time = "Jam wajib";
  if (Object.keys(errors).length > 0) return { ok: false, errors };

  // Tanggal+jam dianggap waktu WIB (+07:00).
  const scheduled_at = `${date}T${time}:00+07:00`;

  const supabase = await createClient();
  const { error } = await supabase.from("post_schedule").insert({
    title,
    source_type,
    video_id: source_type === "video" && videoId ? videoId : null,
    drive_url,
    platform,
    scheduled_at,
    note,
    created_by: actor.id,
  });
  if (error) return { ok: false, errors: { general: error.message } };

  revalidatePath("/jadwal");
  return { ok: true, errors: {} };
}

export async function togglePosted(id: string, posted: boolean) {
  await requireRole("owner", "social_media");
  const supabase = await createClient();
  const patch = posted
    ? { status: "posted" as const, posted_at: new Date().toISOString() }
    : { status: "scheduled" as const, posted_at: null };
  const { error } = await supabase.from("post_schedule").update(patch).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/jadwal");
  return { ok: true };
}

export async function deleteSchedule(id: string) {
  await requireRole("owner", "social_media");
  const supabase = await createClient();
  const { error } = await supabase.from("post_schedule").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/jadwal");
  return { ok: true };
}
