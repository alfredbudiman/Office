import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { listVideos } from "@/lib/videos";
import { actionsFor, TYPE_LABEL } from "@/lib/video-workflow";
import { PageHeader, StatCard, SectionTitle } from "@/components/ui-kit";
import { StatusBadge } from "@/components/status-badge";
import { Inbox, PackageCheck, Loader } from "lucide-react";

export default async function DashboardPage() {
  const profile = await requireProfile();
  const videos = await listVideos();

  const needsAction = videos.filter((v) => actionsFor(v.status, profile.role).length > 0);
  const readyToPublish = videos.filter((v) => v.status === "final" && !v.sudah_tayang).length;
  const inPipeline = videos.filter((v) => v.status !== "tayang").length;

  const greeting = profile.role === "owner" ? "Ringkasan produksi" : "Tugas kamu";

  return (
    <div>
      <PageHeader title={`Halo, ${profile.nama.split(" ")[0]} 👋`} description={greeting} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          label="Perlu aksi kamu"
          value={needsAction.length}
          emphasis={needsAction.length > 0}
          icon={<Inbox className="h-4 w-4" />}
        />
        {profile.role === "owner" && (
          <StatCard label="Siap tayang" value={readyToPublish} icon={<PackageCheck className="h-4 w-4" />} />
        )}
        <StatCard label="Dalam pipeline" value={inPipeline} icon={<Loader className="h-4 w-4" />} />
      </div>

      <section className="mt-8 space-y-3">
        <SectionTitle>Perlu aksi kamu</SectionTitle>
        {needsAction.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card/50 px-4 py-10 text-center">
            <p className="text-sm text-muted-foreground">Tidak ada yang menunggu aksimu. Mantap! 🎉</p>
          </div>
        ) : (
          <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-card">
            {needsAction.map((v) => (
              <Link
                key={v.id}
                href={`/video/${v.id}`}
                className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-accent/60"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{v.judul}</p>
                  <p className="text-xs text-muted-foreground">{TYPE_LABEL[v.tipe]}</p>
                </div>
                <StatusBadge status={v.status} />
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
