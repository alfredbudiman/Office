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
