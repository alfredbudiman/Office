import { describe, it, expect } from "vitest";
import { attendanceState, workedMs, sumWorkedMs, type AttendanceLite } from "@/lib/attendance";

describe("attendanceState", () => {
  it("null / tanpa clock_in -> belum masuk", () => {
    expect(attendanceState(null)).toBe("not_in");
    expect(attendanceState({ clock_in: null, clock_out: null })).toBe("not_in");
  });
  it("clock_in tanpa clock_out -> sedang bekerja", () => {
    expect(attendanceState({ clock_in: "2026-01-01T08:00:00Z", clock_out: null })).toBe("working");
  });
  it("clock_in & clock_out -> selesai", () => {
    expect(attendanceState({ clock_in: "2026-01-01T08:00:00Z", clock_out: "2026-01-01T17:00:00Z" })).toBe("done");
  });
});

describe("workedMs", () => {
  it("selisih clock_out - clock_in", () => {
    expect(workedMs("2026-01-01T08:00:00Z", "2026-01-01T17:00:00Z")).toBe(9 * 3600000);
  });
  it("null bila belum clock_out", () => {
    expect(workedMs("2026-01-01T08:00:00Z", null)).toBeNull();
  });
});

describe("sumWorkedMs", () => {
  it("jumlahkan durasi yang sudah selesai, abaikan yang belum", () => {
    const rows: AttendanceLite[] = [
      { clock_in: "2026-01-01T08:00:00Z", clock_out: "2026-01-01T12:00:00Z" },
      { clock_in: "2026-01-02T08:00:00Z", clock_out: "2026-01-02T11:00:00Z" },
      { clock_in: "2026-01-03T08:00:00Z", clock_out: null },
    ];
    expect(sumWorkedMs(rows)).toBe(7 * 3600000);
  });
});
