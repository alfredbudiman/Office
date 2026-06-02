"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { setSetting } from "@/lib/settings";

function isUrl(s: string) { try { new URL(s); return true; } catch { return false; } }

export async function saveDriveFolderUrl(_prev: unknown, formData: FormData) {
  const profile = await requireRole("owner");
  const value = String(formData.get("drive_folder_url") ?? "").trim();
  if (!value) return { ok: false, error: "URL kosong" };
  if (!isUrl(value)) return { ok: false, error: "URL tidak valid" };

  const res = await setSetting("drive_folder_url", value, profile.id);
  if (!res.ok) return { ok: false, error: res.error };

  revalidatePath("/", "layout");
  return { ok: true };
}
