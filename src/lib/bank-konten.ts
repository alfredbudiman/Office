// Bank Konten — mirror read-only dari Google Sheet "CONTENT LIST ALFRED".
// Data dibaca live via Google Sheets API (API key, sheet share "anyone with link").
// Kita ambil grid data + hyperlink supaya kolom LINK ("Click Here") bisa jadi link Drive yang diklik.

export type KontenStatus = "ongoing" | "editing" | "revisi" | "done";

export const STATUS_LABEL: Record<KontenStatus, string> = {
  ongoing: "On Going",
  editing: "Editing",
  revisi: "Revisi",
  done: "Fix / Done",
};

export type KontenItem = {
  no: string | null;
  jenis: string;
  konten: string;
  status: KontenStatus | null;
  link: string | null;
  posted: boolean;
};

export type KontenGroup = { jenis: string; items: KontenItem[] };

// Bentuk minimal dari respons Sheets API (fields=...rowData(values(formattedValue,hyperlink))).
export type SheetCell = { formattedValue?: string; hyperlink?: string };
export type SheetRow = { values?: SheetCell[] };

// Indeks kolom di sheet (0-based). Kolom 0 (A) kosong di sheet aslinya,
// jadi data mulai di kolom 1. PROGRES terdiri dari 4 sub-kolom.
const COL = {
  no: 1,
  jenis: 2,
  konten: 3,
  progresStart: 4, // 4=On going, 5=Editing, 6=Revisi, 7=Fix/Done
  link: 8,
  postingStart: 9, // 9 = STATUS POSTING
};

const PROGRES_STATUS: KontenStatus[] = ["ongoing", "editing", "revisi", "done"];

// Baris non-data yang harus dilewati (judul & header).
const SKIP_KONTEN = new Set(["", "KONTEN LIST", "KONTEN LIST 2026"]);

const text = (cell?: SheetCell) => (cell?.formattedValue ?? "").trim();
const filled = (cell?: SheetCell) => text(cell).length > 0;

/**
 * Ubah rowData mentah dari Sheets API jadi daftar konten terkelompok per JENIS.
 * - JENIS KONTEN hanya terisi di baris pertama tiap kategori → di-carry-forward.
 * - Status diambil dari sub-kolom PROGRES yang bertanda (paling kanan = paling maju).
 * - Link diambil dari hyperlink kolom LINK (bukan teksnya yang sering typo).
 */
export function parseBankKonten(rows: SheetRow[]): KontenGroup[] {
  const groups: KontenGroup[] = [];
  let currentJenis = "";

  for (const row of rows) {
    const cells = row.values ?? [];
    const jenisCell = text(cells[COL.jenis]);
    if (jenisCell && jenisCell !== "JENIS KONTEN") currentJenis = jenisCell;

    const konten = text(cells[COL.konten]);
    if (SKIP_KONTEN.has(konten) || !currentJenis) continue;

    // Status: ambil sub-kolom PROGRES paling kanan yang terisi.
    let status: KontenStatus | null = null;
    for (let i = 0; i < PROGRES_STATUS.length; i++) {
      if (filled(cells[COL.progresStart + i])) status = PROGRES_STATUS[i];
    }

    const linkCell = cells[COL.link];
    const link = linkCell?.hyperlink ?? null;

    const posted =
      filled(cells[COL.postingStart]) ||
      filled(cells[COL.postingStart + 1]) ||
      filled(cells[COL.postingStart + 2]);

    const item: KontenItem = {
      no: text(cells[COL.no]) || null,
      jenis: currentJenis,
      konten,
      status,
      link,
      posted,
    };

    const group = groups.find((g) => g.jenis === currentJenis);
    if (group) group.items.push(item);
    else groups.push({ jenis: currentJenis, items: [item] });
  }

  return groups;
}

export type BankKontenResult =
  | { ok: true; groups: KontenGroup[] }
  | { ok: false; error: "not_configured" | "fetch_failed" };

const SHEETS_FIELDS = "sheets(data(rowData(values(formattedValue,hyperlink))))";

/** Baca sheet live. Cache 60 detik agar tidak menggebuk API tiap navigasi. */
export async function getBankKonten(): Promise<BankKontenResult> {
  const sheetId = process.env.BANK_KONTEN_SHEET_ID;
  const apiKey = process.env.GOOGLE_SHEETS_API_KEY;
  if (!sheetId || !apiKey) return { ok: false, error: "not_configured" };

  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}` +
    `?includeGridData=true&fields=${encodeURIComponent(SHEETS_FIELDS)}&key=${apiKey}`;

  try {
    const res = await fetch(url, { next: { revalidate: 60 } });
    if (!res.ok) return { ok: false, error: "fetch_failed" };
    const json = await res.json();
    const rows: SheetRow[] = json?.sheets?.[0]?.data?.[0]?.rowData ?? [];
    return { ok: true, groups: parseBankKonten(rows) };
  } catch {
    return { ok: false, error: "fetch_failed" };
  }
}

/** Hitung ringkasan untuk kartu statistik & list "sudah selesai". */
export function summarize(groups: KontenGroup[]) {
  const items = groups.flatMap((g) => g.items);
  const done = items.filter((i) => i.status === "done");
  return {
    total: items.length,
    done: done.length,
    posted: items.filter((i) => i.posted).length,
    withLink: items.filter((i) => i.link),
    doneItems: done,
  };
}
