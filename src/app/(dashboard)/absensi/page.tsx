import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getTodayAttendance, getOpenAttendance, listAttendance } from "@/lib/attendance-data";
import { attendanceState, workedMs, sumWorkedMs, aggregateByUser } from "@/lib/attendance";
import { BulanPicker } from "./bulan-picker";
import { RekapPerOrang } from "./rekap-per-orang";
import { formatDuration } from "@/lib/rekap";
import { PageHeader, StatCard, SectionTitle } from "@/components/ui-kit";
import { ClockCard } from "./clock-card";
import { wibToday } from "@/lib/wib";

function jam(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}
function monthRange() {
  const today = wibToday();
  const from = `${today.slice(0, 7)}-01`;
  return { from, to: today };
}
function isBulan(s: string | undefined): s is string {
  return !!s && /^\d{4}-\d{2}$/.test(s);
}
function rangeForBulan(bulan: string) {
  const from = `${bulan}-01`;
  const today = wibToday();
  if (bulan === today.slice(0, 7)) return { from, to: today };
  const [y, m] = bulan.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate(); // m 1-based -> hari 0 bulan berikutnya = hari terakhir bulan ini
  return { from, to: `${bulan}-${String(lastDay).padStart(2, "0")}` };
}

export default async function AbsensiPage({
  searchParams,
}: { searchParams: Promise<{ bulan?: string }> }) {
  const profile = await requireProfile();
  const canViewAll = profile.role === "owner" || profile.role === "hrd";
  const { from, to } = monthRange();

  const sp = await searchParams;
  const bulan = isBulan(sp.bulan) ? sp.bulan : wibToday().slice(0, 7);
  const rekapRange = rangeForBulan(bulan);

  // Semua query dijalankan paralel (Promise.all) supaya tidak saling menunggu.
  // Utamakan shift yang masih berjalan (mis. shift malam yang dimulai kemarin)
  // supaya tombol Clock Out tetap muncul walau sudah ganti hari.
  const supabase = await createClient();
  const [open, todayRow, rows, profsRes, rekapRowsRaw, aktifRes] = await Promise.all([
    getOpenAttendance(profile.id),
    getTodayAttendance(profile.id),
    listAttendance(from, to, canViewAll ? undefined : profile.id),
    supabase.from("profiles").select("id, nama"),
    canViewAll ? listAttendance(rekapRange.from, rekapRange.to) : Promise.resolve([]),
    canViewAll
      ? supabase.from("profiles").select("id, nama").eq("aktif", true).order("nama")
      : Promise.resolve({ data: [] as { id: string; nama: string }[] }),
  ]);
  const today = open ?? todayRow;
  const namaById = new Map(((profsRes.data ?? []) as { id: string; nama: string }[]).map((p) => [p.id, p.nama]));
  const rekap = canViewAll
    ? aggregateByUser(rekapRowsRaw, (aktifRes.data ?? []) as { id: string; nama: string }[])
    : [];

  const myRows = rows.filter((r) => r.user_id === profile.id);
  const myTotal = sumWorkedMs(myRows);

  return (
    <div className="space-y-6">
      <PageHeader title="Absensi" description="Clock in / clock out & rekap jam kerja bulan ini." />

      <ClockCard
        state={attendanceState(today)}
        clockInLabel={jam(today?.clock_in ?? null)}
        clockOutLabel={jam(today?.clock_out ?? null)}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Hari tercatat (bulan ini)" value={myRows.length} />
        <StatCard label="Total jam kerja (bulan ini)" value={formatDuration(myTotal)} emphasis />
      </div>

      <section className="space-y-3">
        <SectionTitle>{canViewAll ? "Rekap semua karyawan (bulan ini)" : "Rekap saya (bulan ini)"}</SectionTitle>

        {/* Mobile: card list */}
        <div className="space-y-2 sm:hidden">
          {rows.map((r) => (
            <div key={r.id} className="rounded-xl border border-border bg-card p-3 shadow-card">
              <div className="flex items-center justify-between gap-2">
                <p className="tnum text-sm font-medium">{new Date(r.tanggal).toLocaleDateString("id-ID")}</p>
                <p className="tnum text-sm font-medium">{formatDuration(workedMs(r.clock_in, r.clock_out))}</p>
              </div>
              {canViewAll && (
                <p className="mt-0.5 text-xs text-muted-foreground">{namaById.get(r.user_id) ?? "—"}</p>
              )}
              <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                <span className="tnum">Masuk: <span className="text-foreground">{jam(r.clock_in) ?? "—"}</span></span>
                <span className="tnum">Pulang: <span className="text-foreground">{jam(r.clock_out) ?? "—"}</span></span>
              </div>
            </div>
          ))}
          {rows.length === 0 && (
            <div className="rounded-xl border border-dashed border-border bg-card/50 px-4 py-8 text-center text-sm text-muted-foreground">
              Belum ada data absensi bulan ini.
            </div>
          )}
        </div>

        {/* Desktop: table */}
        <div className="hidden overflow-x-auto rounded-xl border border-border bg-card shadow-card sm:block">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5">Tanggal</th>
                {canViewAll && <th className="px-4 py-2.5">Nama</th>}
                <th className="px-4 py-2.5">Masuk</th>
                <th className="px-4 py-2.5">Pulang</th>
                <th className="px-4 py-2.5">Durasi</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border hover:bg-accent/40">
                  <td className="tnum px-4 py-2.5">{new Date(r.tanggal).toLocaleDateString("id-ID")}</td>
                  {canViewAll && <td className="px-4 py-2.5">{namaById.get(r.user_id) ?? "—"}</td>}
                  <td className="tnum px-4 py-2.5">{jam(r.clock_in) ?? "—"}</td>
                  <td className="tnum px-4 py-2.5">{jam(r.clock_out) ?? "—"}</td>
                  <td className="tnum px-4 py-2.5">{formatDuration(workedMs(r.clock_in, r.clock_out))}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={canViewAll ? 5 : 4} className="px-4 py-6 text-center text-muted-foreground">Belum ada data absensi bulan ini.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {canViewAll && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <SectionTitle>Rekap per karyawan</SectionTitle>
            <BulanPicker bulan={bulan} />
          </div>
          <RekapPerOrang data={rekap} />
        </section>
      )}
    </div>
  );
}
