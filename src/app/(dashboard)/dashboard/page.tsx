import Link from "next/link";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { listVideos, type VideoRow } from "@/lib/videos";
import { typeLabel, type VideoStatus } from "@/lib/video-workflow";
import { PageHeader, StatCard, SectionTitle } from "@/components/ui-kit";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { CalendarPlus, ClipboardCheck, Loader, FolderOpen, PackageCheck } from "lucide-react";
import { getSetting } from "@/lib/settings";
import { listSchedule } from "@/lib/post-schedule-data";
import { UpcomingSchedule } from "./upcoming-schedule";

const REVIEW: VideoStatus[] = ["review_cut", "review_draft"];
const WIP: VideoStatus[] = ["draft_brief", "cut_to_cut", "editing"];

export default async function DashboardPage() {
  const profile = await requireProfile();
  if (profile.role === "hrd") redirect("/recruitment");
  if (profile.role === "finance") redirect("/hutang");

  const canSchedule = profile.role === "owner" || profile.role === "social_media";
  const [videos, driveFolderUrl, schedule] = await Promise.all([
    listVideos(),
    getSetting("drive_folder_url"),
    canSchedule ? listSchedule() : Promise.resolve([]),
  ]);
  const scheduledIds = new Set(schedule.map((s) => s.video_id).filter((x): x is string => !!x));

  const siap = videos.filter((v) => v.status === "final" && !v.sudah_tayang && !scheduledIds.has(v.id));
  const review = videos.filter((v) => REVIEW.includes(v.status));
  const wip = videos.filter((v) => WIP.includes(v.status));

  return (
    <div>
      <PageHeader title={`Halo, ${profile.nama.split(" ")[0]} 👋`} description={profile.role === "owner" ? "Ringkasan produksi" : "Tugas kamu"} />

      {canSchedule && <UpcomingSchedule />}

      {driveFolderUrl && (
        <section className="mt-6">
          <a href={driveFolderUrl} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-xl border border-border bg-card p-4 shadow-card transition hover:shadow-soft">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 text-brand"><FolderOpen className="h-5 w-5" /></span>
              <div className="leading-tight">
                <p className="text-sm font-medium">Folder Hasil</p>
                <p className="text-xs text-muted-foreground">Buka folder Google Drive berisi semua video</p>
              </div>
            </div>
            <span className="text-xs text-brand">Buka →</span>
          </a>
        </section>
      )}

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Siap, belum dijadwalkan" value={siap.length} emphasis={siap.length > 0} icon={<PackageCheck className="h-4 w-4" />} />
        <StatCard label="Perlu di-review" value={review.length} emphasis={review.length > 0} icon={<ClipboardCheck className="h-4 w-4" />} />
        <StatCard label="Masih dikerjakan" value={wip.length} icon={<Loader className="h-4 w-4" />} />
      </div>

      <VideoSection title="Siap tayang — belum dijadwalkan" videos={siap} assign={canSchedule} empty="Tidak ada video final yang menunggu jadwal. 🎉" />
      <VideoSection title="Perlu di-review" videos={review} empty="Tidak ada yang perlu di-review." />
      <VideoSection title="Masih dikerjakan" videos={wip} empty="Tidak ada video yang sedang dikerjakan." />
    </div>
  );
}

function VideoSection({ title, videos, empty, assign = false }: { title: string; videos: VideoRow[]; empty: string; assign?: boolean }) {
  return (
    <section className="mt-8 space-y-3">
      <SectionTitle>{title} {videos.length > 0 && <span className="text-sm font-normal text-muted-foreground">({videos.length})</span>}</SectionTitle>
      {videos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/50 px-4 py-8 text-center text-sm text-muted-foreground">{empty}</div>
      ) : (
        <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-card">
          {videos.map((v) => (
            <div key={v.id} className="flex items-center gap-3 px-4 py-3">
              <Link href={`/video/${v.id}`} className="min-w-0 flex-1 hover:opacity-80">
                <p className="truncate text-sm font-medium">{v.judul}</p>
                <p className="text-xs text-muted-foreground">{typeLabel(v)}</p>
              </Link>
              <StatusBadge status={v.status} />
              {assign && (
                <Link href={`/jadwal?video=${v.id}`}>
                  <Button size="xs"><CalendarPlus className="mr-1 h-3.5 w-3.5" /> Assign</Button>
                </Link>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
