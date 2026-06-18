import { wibDate } from "@/lib/wib";

export const PLATFORMS = ["youtube", "youtube_shorts", "tiktok", "instagram"] as const;
export type Platform = (typeof PLATFORMS)[number];

export const PLATFORM_LABEL: Record<Platform, string> = {
  youtube: "YouTube",
  youtube_shorts: "YouTube Shorts",
  tiktok: "TikTok",
  instagram: "Instagram",
};

export type ScheduleStatus = "scheduled" | "posted";
export type SourceType = "video" | "bank_konten" | "manual";

export type ScheduleRow = {
  id: string;
  title: string;
  source_type: SourceType;
  video_id: string | null;
  drive_url: string | null;
  platform: Platform;
  scheduled_at: string; // ISO timestamptz
  status: ScheduleStatus;
  posted_at: string | null;
  note: string | null;
  created_by: string | null;
  created_at: string;
};

/** Kunci pengelompokan checklist: per video (kalau ada) atau per judul. */
export function contentKey(row: Pick<ScheduleRow, "video_id" | "title">): string {
  return row.video_id ? `v:${row.video_id}` : `t:${row.title.trim().toLowerCase()}`;
}

export type ChecklistCell = { id: string; status: ScheduleStatus; date: string } | null;
export type ChecklistContentRow = {
  key: string;
  title: string;
  cells: Record<Platform, ChecklistCell>;
};

function emptyCells(): Record<Platform, ChecklistCell> {
  return { youtube: null, youtube_shorts: null, tiktok: null, instagram: null };
}

/** Matriks konten × platform. Per sel: yang sudah 'posted' diprioritaskan,
 *  selain itu pakai jadwal paling awal. Tanggal dalam WIB. */
export function buildChecklist(rows: ScheduleRow[]): ChecklistContentRow[] {
  const map = new Map<string, ChecklistContentRow>();
  for (const r of rows) {
    const key = contentKey(r);
    let entry = map.get(key);
    if (!entry) {
      entry = { key, title: r.title, cells: emptyCells() };
      map.set(key, entry);
    }
    const cell: ChecklistCell = { id: r.id, status: r.status, date: wibDate(new Date(r.scheduled_at)) };
    const existing = entry.cells[r.platform];
    if (!existing) {
      entry.cells[r.platform] = cell;
    } else if (existing.status !== "posted" && r.status === "posted") {
      entry.cells[r.platform] = cell; // posted menang
    } else if (existing.status === r.status && cell.date < existing.date) {
      entry.cells[r.platform] = cell; // status sama → ambil yang lebih awal
    }
  }
  return [...map.values()];
}

/** Progres keseluruhan: berapa post yang sudah diposting dari total. */
export function scheduleProgress(rows: ScheduleRow[]): { posted: number; total: number } {
  return { posted: rows.filter((r) => r.status === "posted").length, total: rows.length };
}
