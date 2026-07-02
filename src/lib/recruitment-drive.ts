// Ambil database recruitment (JSON) dari folder Google Drive HR (Cowork).
// Tiap export bikin file baru (timestamp) → kita selalu ambil file TERBARU di folder.
// Listing folder pakai Drive API + API key yang sama dgn Bank Konten (GOOGLE_SHEETS_API_KEY).
// File di-share "anyone with link", jadi isinya diunduh tanpa auth.

export const DEFAULT_DRIVE_FOLDER_ID = "1iCuPMyNqs-QuGUNXcoBYqEUkQ2QofNDL";
// Fallback bila Drive API belum aktif / listing gagal (file asli HR).
const FALLBACK_FILE_ID = "1Bwya6IYsKDLcysN2KBK4cH6EIOWAugL8";

export type HrDump = { exported: string | null; cands: Record<string, unknown>[] };

/** File JSON termodifikasi terakhir di folder (via Drive API + API key). null bila tak bisa. */
async function latestFileInFolder(folderId: string): Promise<string | null> {
  const key = process.env.GOOGLE_SHEETS_API_KEY;
  if (!key) return null;
  const params = new URLSearchParams({
    q: `'${folderId}' in parents and trashed = false and mimeType = 'application/json'`,
    orderBy: "modifiedTime desc",
    pageSize: "1",
    fields: "files(id,name,modifiedTime)",
    key,
  });
  try {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, { cache: "no-store" });
    if (!res.ok) return null;
    const j = (await res.json()) as { files?: { id: string }[] };
    return j.files?.[0]?.id ?? null;
  } catch {
    return null;
  }
}

async function downloadJson(fileId: string): Promise<{ ok: true; data: HrDump } | { ok: false; error: string }> {
  const url = `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`;
  try {
    const res = await fetch(url, { redirect: "follow", cache: "no-store" });
    if (!res.ok) return { ok: false, error: `Gagal unduh file (HTTP ${res.status})` };
    const text = await res.text();
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      return { ok: false, error: "File bukan JSON valid — pastikan sharing 'Anyone with the link'." };
    }
    const obj = json as { exported?: unknown; cands?: unknown };
    const cands = Array.isArray(obj.cands) ? obj.cands : Array.isArray(json) ? json : null;
    if (!cands) return { ok: false, error: "Struktur JSON tak dikenali (butuh key 'cands')." };
    return { ok: true, data: { exported: typeof obj.exported === "string" ? obj.exported : null, cands: cands as Record<string, unknown>[] } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Gagal fetch." };
  }
}

/** Ambil file JSON terbaru di folder (fallback ke file asli bila listing tak tersedia).
 *  viaListing=true berarti Drive API (project pemilik key) benar-benar dipakai. */
export async function fetchHrDatabase(folderId: string = DEFAULT_DRIVE_FOLDER_ID) {
  const listed = await latestFileInFolder(folderId);
  const fileId = listed ?? FALLBACK_FILE_ID;
  const r = await downloadJson(fileId);
  return r.ok ? { ...r, viaListing: !!listed, fileId } : r;
}
