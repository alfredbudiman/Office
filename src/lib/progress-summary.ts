import { STATUS_LABEL, type VideoStatus } from "@/lib/video-workflow";

export type SummaryInput = {
  nama: string;
  clockOutTime: Date;
  statusMoves: { judul: string; statusBaru: VideoStatus }[];
  comments: { judul: string; isi: string }[];
  extraNote?: string;
};

function fmtTime(d: Date): string {
  const wib = new Date(d.getTime() + 7 * 60 * 60 * 1000);
  const hh = String(wib.getUTCHours()).padStart(2, "0");
  const mm = String(wib.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function truncate(text: string, max = 80): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + "...";
}

export function buildProgressSummary(i: SummaryInput): string {
  const lines: string[] = [];
  lines.push(`Halo, saya ${i.nama} selesai jam ${fmtTime(i.clockOutTime)}.`);

  if (i.statusMoves.length > 0) {
    lines.push("");
    lines.push("Yang dikerjakan:");
    for (const m of i.statusMoves) {
      lines.push(`• ${m.judul} → ${STATUS_LABEL[m.statusBaru]}`);
    }
  }

  if (i.comments.length > 0) {
    lines.push("");
    lines.push("Komentar:");
    for (const c of i.comments) {
      lines.push(`• ${c.judul}: ${truncate(c.isi)}`);
    }
  }

  if (i.extraNote && i.extraNote.trim()) {
    lines.push("");
    lines.push(`Catatan: ${i.extraNote.trim()}`);
  }

  return lines.join("\n");
}
