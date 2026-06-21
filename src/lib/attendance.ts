export type AttendanceLite = { clock_in: string | null; clock_out: string | null };
export type AttendanceState = "not_in" | "working" | "done";

export function attendanceState(row: AttendanceLite | null): AttendanceState {
  if (!row || !row.clock_in) return "not_in";
  if (!row.clock_out) return "working";
  return "done";
}

export function workedMs(clockIn: string | null, clockOut: string | null): number | null {
  if (!clockIn || !clockOut) return null;
  return new Date(clockOut).getTime() - new Date(clockIn).getTime();
}

export function sumWorkedMs(rows: AttendanceLite[]): number {
  return rows.reduce((acc, r) => acc + (workedMs(r.clock_in, r.clock_out) ?? 0), 0);
}

export type AttendanceDay = {
  id: string;
  tanggal: string;
  clock_in: string | null;
  clock_out: string | null;
};

export type RekapOrang = {
  id: string;
  nama: string;
  hariHadir: number;
  totalMs: number;
  days: AttendanceDay[];
};

/** Agregasi baris attendance menjadi ringkasan per orang.
 *  Semua orang di `people` selalu muncul (termasuk yang 0 hari). */
export function aggregateByUser(
  rows: (AttendanceDay & { user_id: string })[],
  people: { id: string; nama: string }[],
): RekapOrang[] {
  const byUser = new Map<string, AttendanceDay[]>();
  for (const r of rows) {
    const arr = byUser.get(r.user_id) ?? [];
    arr.push({ id: r.id, tanggal: r.tanggal, clock_in: r.clock_in, clock_out: r.clock_out });
    byUser.set(r.user_id, arr);
  }
  const result = people.map((p) => {
    const days = (byUser.get(p.id) ?? [])
      .slice()
      .sort((a, b) => a.tanggal.localeCompare(b.tanggal));
    return {
      id: p.id,
      nama: p.nama,
      hariHadir: days.filter((d) => d.clock_in).length,
      totalMs: sumWorkedMs(days),
      days,
    };
  });
  result.sort((a, b) => b.totalMs - a.totalMs || a.nama.localeCompare(b.nama));
  return result;
}

export type ClockInPlan =
  | { action: "create" }
  | { action: "resume"; id: string }
  | { action: "reject"; reason: string };

/** Tentukan apa yang harus dilakukan saat clock in.
 *  `open` = shift yang masih berjalan (clock_in ada, clock_out belum) APA PUN tanggalnya;
 *  bila ada, clock in ditolak supaya shift malam tidak terbelah jadi dua record. */
export function planClockIn(
  open: { id: string } | null,
  todayRow: { id: string; clock_in: string | null } | null,
): ClockInPlan {
  if (open) return { action: "reject", reason: "Masih ada shift berjalan, clock out dulu." };
  if (todayRow?.clock_in) return { action: "reject", reason: "Sudah clock in hari ini." };
  if (todayRow) return { action: "resume", id: todayRow.id };
  return { action: "create" };
}
