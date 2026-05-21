import { requireRole } from "@/lib/auth";
import { listVideos } from "@/lib/videos";
import { stockReadyByType, pipelineByStatus, STOCK_TYPES, type StockVideo } from "@/lib/stock";
import { STATUS_ORDER, STATUS_LABEL, TYPE_LABEL } from "@/lib/video-workflow";
import { PageHeader, StatCard, SectionTitle } from "@/components/ui-kit";
import { PackageCheck } from "lucide-react";

export default async function StokPage() {
  await requireRole("owner");
  const videos = await listVideos();
  const sv: StockVideo[] = videos.map((v) => ({ tipe: v.tipe, status: v.status, sudah_tayang: v.sudah_tayang }));
  const ready = stockReadyByType(sv);
  const pipeline = pipelineByStatus(sv);
  const totalReady = STOCK_TYPES.reduce((a, t) => a + ready[t], 0);
  const inPipeline = STATUS_ORDER.filter((s) => s !== "tayang").reduce((a, s) => a + pipeline[s], 0);

  return (
    <div>
      <PageHeader title="Stok Konten" description="Konten Final yang belum tayang & sebaran isi pipeline." />

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <SectionTitle>Siap tayang</SectionTitle>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300">
            <PackageCheck className="h-3.5 w-3.5" /> {totalReady} total
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {STOCK_TYPES.map((t) => (
            <StatCard key={t} label={TYPE_LABEL[t]} value={ready[t]} emphasis={ready[t] > 0} />
          ))}
        </div>
      </section>

      <section className="mt-8 space-y-3">
        <div className="flex items-center justify-between">
          <SectionTitle>Isi pipeline</SectionTitle>
          <span className="text-xs text-muted-foreground">{inPipeline} sedang dikerjakan</span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {STATUS_ORDER.map((s) => (
            <div key={s} className="rounded-xl border border-border bg-card p-3 shadow-card">
              <p className="text-[11px] font-medium text-muted-foreground">{STATUS_LABEL[s]}</p>
              <p className="tnum mt-1 text-2xl font-semibold tracking-tight">{pipeline[s]}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
