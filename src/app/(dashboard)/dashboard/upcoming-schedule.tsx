import Link from "next/link";
import { Download, CalendarClock } from "lucide-react";
import { listSchedule } from "@/lib/post-schedule-data";
import { wibToday, wibDate } from "@/lib/wib";
import { PLATFORM_LABEL, type ScheduleRow } from "@/lib/post-schedule";
import { PlatformIcon } from "@/components/platform-icon";
import { SectionTitle } from "@/components/ui-kit";

function plusDays(ymd: string, n: number) {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function timeWIB(iso: string) {
  return new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });
}

export async function UpcomingSchedule() {
  const rows = await listSchedule();
  const today = wibToday();
  const days = [
    { label: "Hari ini", ymd: today },
    { label: "Besok", ymd: plusDays(today, 1) },
    { label: "2 hari lagi", ymd: plusDays(today, 2) },
  ];
  const byDate = new Map<string, ScheduleRow[]>();
  for (const r of rows) {
    const k = wibDate(new Date(r.scheduled_at));
    (byDate.get(k) ?? byDate.set(k, []).get(k)!).push(r);
  }
  for (const list of byDate.values()) list.sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
  const totalUpcoming = days.reduce((n, d) => n + (byDate.get(d.ymd)?.length ?? 0), 0);

  return (
    <section className="mt-6 space-y-3">
      <div className="flex items-center justify-between">
        <SectionTitle>Jadwal posting</SectionTitle>
        <Link href="/jadwal" className="text-xs font-medium text-brand hover:underline">Lihat semua →</Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {days.map((d) => {
          const list = byDate.get(d.ymd) ?? [];
          return (
            <div key={d.ymd} className="rounded-2xl border border-border bg-card p-3.5 shadow-card">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <CalendarClock className="h-3.5 w-3.5" /> {d.label}
              </p>
              {list.length === 0 ? (
                <p className="py-3 text-center text-xs text-muted-foreground/60">tidak ada</p>
              ) : (
                <ul className="space-y-1.5">
                  {list.map((r) => (
                    <li key={r.id} className="flex items-center gap-2">
                      <span className={r.status === "posted" ? "" : "opacity-50"}><PlatformIcon platform={r.platform} size={16} /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium leading-tight">{r.title}</span>
                        <span className="tnum text-[11px] text-muted-foreground">{PLATFORM_LABEL[r.platform]} · {timeWIB(r.scheduled_at)}{r.status === "posted" ? " · ✓" : ""}</span>
                      </span>
                      {r.drive_url && (
                        <a href={r.drive_url} target="_blank" rel="noreferrer" aria-label="Download" className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"><Download className="h-3.5 w-3.5" /></a>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
      {totalUpcoming === 0 && <p className="text-xs text-muted-foreground/70">Belum ada jadwal 3 hari ke depan. Buka <Link href="/jadwal" className="text-brand hover:underline">Jadwal Posting</Link> untuk menambah.</p>}
    </section>
  );
}
