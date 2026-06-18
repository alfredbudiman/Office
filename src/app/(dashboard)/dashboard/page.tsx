import Link from "next/link";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { listVideos } from "@/lib/videos";
import { actionsFor, typeLabel } from "@/lib/video-workflow";
import { PageHeader, StatCard, SectionTitle } from "@/components/ui-kit";
import { StatusBadge } from "@/components/status-badge";
import { Inbox, PackageCheck, Loader, FolderOpen } from "lucide-react";
import { getSetting } from "@/lib/settings";
import { UpcomingSchedule } from "./upcoming-schedule";

export default async function DashboardPage() {
  const profile = await requireProfile();
  // Role recruitment (Sabina) tidak melihat konten — arahkan ke halaman Recruitment.
  if (profile.role === "hrd") redirect("/recruitment");
  const videos = await listVideos();
  const driveFolderUrl = await getSetting("drive_folder_url");

  const needsAction = videos.filter((v) => actionsFor(v.status, profile.role).length > 0);
  const readyToPublish = videos.filter((v) => v.status === "final" && !v.sudah_tayang).length;
  const inPipeline = videos.filter((v) => v.status !== "tayang").length;

  const greeting = profile.role === "owner" ? "Ringkasan produksi" : "Tugas kamu";

  return (
    <div>
      <PageHeader title={`Halo, ${profile.nama.split(" ")[0]} 👋`} description={greeting} />

      {(profile.role === "owner" || profile.role === "social_media") && <UpcomingSchedule />}

      {driveFolderUrl && (
        <section className="mt-6">
          <a
            href={driveFolderUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between rounded-xl border border-border bg-card p-4 shadow-card transition hover:shadow-soft"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 text-brand">
                <FolderOpen className="h-5 w-5" />
              </span>
              <div className="leading-tight">
                <p className="text-sm font-medium">Folder Hasil</p>
                <p className="text-xs text-muted-foreground">Buka folder Google Drive berisi semua video</p>
              </div>
            </div>
            <span className="text-xs text-brand">Buka →</span>
          </a>
        </section>
      )}

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
                  <p className="text-xs text-muted-foreground">{typeLabel(v)}</p>
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
