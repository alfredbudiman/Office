// Ambil database recruitment (JSON) dari Google Drive publik milik HR (Cowork).
// File di-share "anyone with link", jadi bisa diunduh langsung tanpa API key.

export const DEFAULT_DRIVE_FILE_ID = "1Bwya6IYsKDLcysN2KBK4cH6EIOWAugL8";

export type HrDump = { exported: string | null; cands: Record<string, unknown>[] };

export async function fetchHrDatabase(
  fileId: string,
): Promise<{ ok: true; data: HrDump } | { ok: false; error: string }> {
  const url = `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`;
  try {
    const res = await fetch(url, { redirect: "follow", cache: "no-store" });
    if (!res.ok) return { ok: false, error: `Gagal ambil file dari Drive (HTTP ${res.status})` };
    const text = await res.text();
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      return { ok: false, error: "File bukan JSON valid — pastikan sharing 'Anyone with the link' & ID benar." };
    }
    const obj = json as { exported?: unknown; cands?: unknown };
    const cands = Array.isArray(obj.cands) ? obj.cands : Array.isArray(json) ? json : null;
    if (!cands) return { ok: false, error: "Struktur JSON tak dikenali (butuh key 'cands')." };
    return {
      ok: true,
      data: { exported: typeof obj.exported === "string" ? obj.exported : null, cands: cands as Record<string, unknown>[] },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Gagal fetch." };
  }
}
