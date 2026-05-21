import { requireRole } from "@/lib/auth";
import { listEditors } from "@/lib/videos";
import { createClient } from "@/lib/supabase/server";
import { getCompletedVideos, getEventsByVideo } from "@/lib/rekap-data";
import { totalDurationMs, average, formatDuration, stageDurationsMs } from "@/lib/rekap";
import { initialStatus, STATUS_ORDER, STATUS_LABEL, TYPE_LABEL, type VideoType } from "@/lib/video-workflow";
import { RekapFilter } from "./rekap-filter";
import { PageHeader, StatCard, SectionTitle } from "@/components/ui-kit";
import { Timer, CheckCircle2 } from "lucide-react";

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
    <div className="space-y-8">
      <PageHeader title="Rekap Kinerja" description="Kecepatan & jumlah konten selesai per periode." />

      <RekapFilter editors={editors} from={from} to={to} />

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="sm:col-span-2">
          <StatCard
            label="Rata-rata mulai → final"
            value={formatDuration(avgTotal)}
            emphasis
            icon={<Timer size={16} />}
          />
        </div>
        <div className="sm:col-span-2">
          <StatCard
            label="Total selesai (periode)"
            value={videos.length}
            emphasis
            icon={<CheckCircle2 size={16} />}
          />
        </div>
        {TYPES.map((t) => (
          <StatCard
            key={t}
            label={`Selesai · ${TYPE_LABEL[t]}`}
            value={countByType[t]}
          />
        ))}
      </section>

      <section className="space-y-3">
        <SectionTitle>Rata-rata lama per tahap</SectionTitle>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {STATUS_ORDER.filter((s) => s !== "tayang").map((s) => {
            const avg = perStageCounts[s] ? (perStageSums[s] ?? 0) / perStageCounts[s]! : null;
            return (
              <div key={s} className="rounded-xl border border-border bg-card p-3 shadow-card">
                <p className="text-xs text-muted-foreground">{STATUS_LABEL[s]}</p>
                <p className="tnum mt-1 text-sm font-medium">{formatDuration(avg)}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <SectionTitle>Daftar selesai ({videos.length})</SectionTitle>
        <div className="rounded-xl border border-border bg-card shadow-card overflow-hidden overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-muted/50">
                <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Judul</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Tipe</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Editor</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Final</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Durasi</th>
              </tr>
            </thead>
            <tbody>
              {videos.map((v) => (
                <tr key={v.id} className="border-t border-border hover:bg-accent/50 transition-colors">
                  <td className="px-4 py-2.5 text-sm">{v.judul}</td>
                  <td className="px-4 py-2.5 text-sm">{TYPE_LABEL[v.tipe]}</td>
                  <td className="px-4 py-2.5 text-sm">{v.editor_id ? namaById.get(v.editor_id) ?? "—" : "—"}</td>
                  <td className="tnum px-4 py-2.5 text-sm">{new Date(v.final_at).toLocaleDateString("id-ID")}</td>
                  <td className="tnum px-4 py-2.5 text-sm">{formatDuration(totalDurationMs(v.created_at, v.final_at))}</td>
                </tr>
              ))}
              {videos.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-sm text-muted-foreground text-center">
                    Tidak ada data di periode ini.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
