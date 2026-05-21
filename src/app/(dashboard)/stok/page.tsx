import { requireRole } from "@/lib/auth";
import { listVideos } from "@/lib/videos";
import { stockReadyByType, pipelineByStatus, STOCK_TYPES, type StockVideo } from "@/lib/stock";
import { STATUS_ORDER, STATUS_LABEL, TYPE_LABEL } from "@/lib/video-workflow";
import { Card } from "@/components/ui/card";

export default async function StokPage() {
  await requireRole("owner");
  const videos = await listVideos();
  const sv: StockVideo[] = videos.map((v) => ({ tipe: v.tipe, status: v.status, sudah_tayang: v.sudah_tayang }));
  const ready = stockReadyByType(sv);
  const pipeline = pipelineByStatus(sv);
  const totalReady = STOCK_TYPES.reduce((a, t) => a + ready[t], 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Stok Konten</h1>
        <p className="text-sm text-muted-foreground">Konten Final yang belum tayang & sebaran isi pipeline.</p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Siap tayang (Final, belum tayang): {totalReady}</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {STOCK_TYPES.map((t) => (
            <Card key={t} className="p-4">
              <p className="text-sm text-muted-foreground">{TYPE_LABEL[t]}</p>
              <p className="mt-1 text-3xl font-semibold">{ready[t]}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Isi Pipeline (per status)</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {STATUS_ORDER.map((s) => (
            <Card key={s} className="p-3">
              <p className="text-xs text-muted-foreground">{STATUS_LABEL[s]}</p>
              <p className="mt-1 text-2xl font-semibold">{pipeline[s]}</p>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
