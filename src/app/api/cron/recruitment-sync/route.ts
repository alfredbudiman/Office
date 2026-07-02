import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchHrDatabase, DEFAULT_DRIVE_FILE_ID } from "@/lib/recruitment-drive";
import { importMergeCore } from "@/lib/recruitment-merge";

// Auto-sync recruitment dari Google Drive HR. Dipicu Vercel Cron (jadwal di vercel.json).
// Jalan tanpa sesi login → pakai service role (bypass RLS).
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const admin = createAdminClient();

  const { data: setting } = await admin.from("settings").select("value").eq("key", "recruitment_drive_file_id").maybeSingle();
  const fileId = (setting as { value?: string } | null)?.value || DEFAULT_DRIVE_FILE_ID;

  const fetched = await fetchHrDatabase(fileId);
  if (!fetched.ok) return NextResponse.json({ ok: false, error: fetched.error }, { status: 502 });

  const res = await importMergeCore(admin, fetched.data.cands);

  // Simpan info sync (via service role). updated_by = owner (kalau ada) supaya tak melanggar constraint.
  const { data: owner } = await admin.from("profiles").select("id").eq("role", "owner").limit(1).maybeSingle();
  const uid = (owner as { id?: string } | null)?.id ?? null;
  const now = new Date().toISOString();
  await admin.from("settings").upsert({ key: "recruitment_last_sync", value: now, updated_at: now, updated_by: uid }, { onConflict: "key" });
  if (fetched.data.exported) {
    await admin.from("settings").upsert({ key: "recruitment_data_date", value: fetched.data.exported, updated_at: now, updated_by: uid }, { onConflict: "key" });
  }

  return NextResponse.json({ ...res, exported: fetched.data.exported });
}
