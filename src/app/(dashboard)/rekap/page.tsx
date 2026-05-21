import { requireRole } from "@/lib/auth";
import { listEditors } from "@/lib/videos";
import { createClient } from "@/lib/supabase/server";
import { getCompletedVideos, getEventsByVideo } from "@/lib/rekap-data";
import { totalDurationMs, average, formatDuration, stageDurationsMs } from "@/lib/rekap";
import { initialStatus, STATUS_ORDER, STATUS_LABEL, TYPE_LABEL, type VideoType } from "@/lib/video-workflow";
import { RekapFilter } from "./rekap-filter";
import { Card } from "@/components/ui/card";

function defaultRange() {
  const to = new Date();
  const from = new Date(); from.setDate(from.getDate() - 30);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { from: iso(from), to: iso(to) };
}

const TYPES: VideoType[] = ["monolog", "podcast", "shorts", "clipping"];

export default async function RekapPage({
  searchParams,
}: { searchParams: Promise<{ from?: string; to?: string; editor?: string; tipe?: string }> }) {
  await requireRole("owner");
  const sp = await searchParams;
  const def = defaultRange();
  const from = sp.from ?? def.from;
  const to = sp.to ?? def.to;
  const tipe = (sp.tipe as VideoType | undefined) || undefined;
  const editorId = sp.editor || undefined;

  const editors = await listEditors();
  const videos = await getCompletedVideos({ from, to, editorId, tipe });
  const eventsByVideo = await getEventsByVideo(videos.map((v) => v.id));

  const countByType = { monolog: 0, podcast: 0, shorts: 0, clipping: 0 } as Record<VideoType, number>;
  for (const v of videos) countByType[v.tipe]++;

  const totals = videos.map((v) => totalDurationMs(v.created_at, v.final_at));
  const avgTotal = average(totals);

  const perStageSums: Partial<Record<string, number>> = {};
  const perStageCounts: Partial<Record<string, number>> = {};
  for (const v of videos) {
    const stages = stageDurationsMs(initialStatus(v.tipe), v.created_at, eventsByVideo.get(v.id) ?? []);
    for (const [s, ms] of Object.entries(stages)) {
      perStageSums[s] = (perStageSums[s] ?? 0) + (ms ?? 0);
      perStageCounts[s] = (perStageCounts[s] ?? 0) + 1;
    }
  }

  const supabase = await createClient();
  const { data: profs } = await supabase.from("profiles").select("id, nama");
  const namaById = new Map((profs ?? []).map((p: { id: string; nama: string }) => [p.id, p.nama]));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Rekap Kinerja</h1>
      <RekapFilter editors={editors} from={from} to={to} />

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-4 sm:col-span-2">
          <p className="text-sm text-muted-foreground">Rata-rata mulai → final</p>
          <p className="mt-1 text-2xl font-semibold">{formatDuration(avgTotal)}</p>
        </Card>
        <Card className="p-4 sm:col-span-2">
          <p className="text-sm text-muted-foreground">Total selesai (periode)</p>
          <p className="mt-1 text-2xl font-semibold">{videos.length}</p>
        </Card>
        {TYPES.map((t) => (
          <Card key={t} className="p-4">
            <p className="text-sm text-muted-foreground">Selesai · {TYPE_LABEL[t]}</p>
            <p className="mt-1 text-2xl font-semibold">{countByType[t]}</p>
          </Card>
        ))}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Rata-rata lama per tahap</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {STATUS_ORDER.filter((s) => s !== "tayang").map((s) => {
            const avg = perStageCounts[s] ? (perStageSums[s] ?? 0) / perStageCounts[s]! : null;
            return (
              <Card key={s} className="p-3">
                <p className="text-xs text-muted-foreground">{STATUS_LABEL[s]}</p>
                <p className="mt-1 text-sm font-medium">{formatDuration(avg)}</p>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Daftar selesai ({videos.length})</h2>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr><th className="p-2">Judul</th><th className="p-2">Tipe</th><th className="p-2">Editor</th><th className="p-2">Final</th><th className="p-2">Durasi</th></tr>
            </thead>
            <tbody>
              {videos.map((v) => (
                <tr key={v.id} className="border-t">
                  <td className="p-2">{v.judul}</td>
                  <td className="p-2">{TYPE_LABEL[v.tipe]}</td>
                  <td className="p-2">{v.editor_id ? namaById.get(v.editor_id) ?? "—" : "—"}</td>
                  <td className="p-2">{new Date(v.final_at).toLocaleDateString("id-ID")}</td>
                  <td className="p-2">{formatDuration(totalDurationMs(v.created_at, v.final_at))}</td>
                </tr>
              ))}
              {videos.length === 0 && <tr><td colSpan={5} className="p-3 text-muted-foreground">Tidak ada data di periode ini.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
