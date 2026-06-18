import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/ui-kit";
import { listSchedule, listSchedulableVideos, listPostedKeys, listContentPrep } from "@/lib/post-schedule-data";
import { getBankKonten } from "@/lib/bank-konten";
import { SchedulerView } from "./scheduler-view";

export default async function JadwalPage({ searchParams }: { searchParams: Promise<{ video?: string }> }) {
  await requireRole("owner", "social_media");
  const { video: initialVideoId } = await searchParams;

  const [rows, videoOptions, bank, postedKeys, prep] = await Promise.all([
    listSchedule(),
    listSchedulableVideos(),
    getBankKonten(),
    listPostedKeys(),
    listContentPrep(),
  ]);

  const bankOptions = bank.ok
    ? bank.groups.flatMap((g) =>
        g.items.filter((i) => i.konten?.trim()).map((i) => ({ title: i.konten, link: i.link, jenis: g.jenis || "Lainnya" })),
      )
    : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Jadwal Posting"
        description="Jadwalkan konten ke YouTube, Shorts, TikTok & Instagram — pantau yang sudah & belum diposting."
      />
      <SchedulerView rows={rows} videoOptions={videoOptions} bankOptions={bankOptions} postedKeys={postedKeys} prep={prep} initialVideoId={initialVideoId} />
    </div>
  );
}
