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
