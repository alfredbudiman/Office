import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getCompletedVideos } from "@/lib/rekap-data";
import { totalDurationMs } from "@/lib/rekap";
import type { VideoType } from "@/lib/video-workflow";

function csvCell(s: string) {
  return `"${s.replace(/"/g, '""')}"`;
}

export async function GET(request: Request) {
  await requireRole("owner");
  const url = new URL(request.url);
  const today = new Date().toISOString().slice(0, 10);
  const from = url.searchParams.get("from") ?? today;
  const to = url.searchParams.get("to") ?? today;
  const editorId = url.searchParams.get("editor") || undefined;
  const tipe = (url.searchParams.get("tipe") as VideoType | null) || undefined;

  const videos = await getCompletedVideos({ from, to, editorId, tipe });

  const supabase = await createClient();
  const { data: profs } = await supabase.from("profiles").select("id, nama");
  const namaById = new Map((profs ?? []).map((p: { id: string; nama: string }) => [p.id, p.nama]));

  const header = ["Judul", "Tipe", "Editor", "Dibuat", "Final", "Durasi (jam)"];
  const rows = videos.map((v) => {
    const ms = totalDurationMs(v.created_at, v.final_at);
    const jam = ms === null ? "" : (ms / 3600000).toFixed(1);
    return [
      v.judul, v.tipe, v.editor_id ? namaById.get(v.editor_id) ?? "" : "",
      v.created_at.slice(0, 10), v.final_at.slice(0, 10), jam,
    ].map((c) => csvCell(String(c))).join(",");
  });
  const csv = [header.map(csvCell).join(","), ...rows].join("\r\n");

  return new Response("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="rekap-${from}_sd_${to}.csv"`,
    },
  });
}
