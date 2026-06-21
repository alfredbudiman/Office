import { describe, it, expect } from "vitest";
import { attendanceState, workedMs, sumWorkedMs, planClockIn, type AttendanceLite, aggregateByUser } from "@/lib/attendance";

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

  it("shift malam yang melewati tengah malam tetap dihitung penuh", () => {
    // clock in 23:00 lalu clock out 05:00 esoknya = 6 jam
    const rows: AttendanceLite[] = [
      { clock_in: "2026-01-01T16:00:00Z", clock_out: "2026-01-01T22:00:00Z" },
    ];
    expect(sumWorkedMs(rows)).toBe(6 * 3600000);
  });
});

describe("planClockIn", () => {
  it("tolak bila masih ada shift berjalan (apa pun tanggalnya)", () => {
    expect(planClockIn({ id: "shift-kemarin" }, null).action).toBe("reject");
  });
  it("tolak bila sudah clock in di hari ini", () => {
    expect(planClockIn(null, { id: "x", clock_in: "2026-01-01T08:00:00Z" }).action).toBe("reject");
  });
  it("resume record hari ini yang belum ada clock_in", () => {
    expect(planClockIn(null, { id: "x", clock_in: null })).toEqual({ action: "resume", id: "x" });
  });
  it("buat record baru bila belum ada apa-apa", () => {
    expect(planClockIn(null, null)).toEqual({ action: "create" });
  });
});

describe("aggregateByUser", () => {
  const people = [
    { id: "a", nama: "Budi" },
    { id: "b", nama: "Ani" },
    { id: "c", nama: "Citra" },
  ];

  it("karyawan tanpa catatan -> 0 hari, 0 ms, days kosong", () => {
    const res = aggregateByUser([], people);
    expect(res).toHaveLength(3);
    for (const r of res) {
      expect(r.hariHadir).toBe(0);
      expect(r.totalMs).toBe(0);
      expect(r.days).toEqual([]);
    }
  });

  it("hari hadir hanya menghitung baris yang punya clock_in", () => {
    const rows = [
      { id: "1", user_id: "a", tanggal: "2026-06-01", clock_in: "2026-06-01T01:00:00Z", clock_out: "2026-06-01T05:00:00Z" },
      { id: "2", user_id: "a", tanggal: "2026-06-02", clock_in: null, clock_out: null },
    ];
    const res = aggregateByUser(rows, people);
    const budi = res.find((r) => r.id === "a")!;
    expect(budi.hariHadir).toBe(1);
    expect(budi.totalMs).toBe(4 * 3600000);
    expect(budi.days).toHaveLength(2);
  });

  it("baris tanpa clock_out tidak menambah total ms", () => {
    const rows = [
      { id: "1", user_id: "b", tanggal: "2026-06-01", clock_in: "2026-06-01T01:00:00Z", clock_out: null },
    ];
    const res = aggregateByUser(rows, people);
    const ani = res.find((r) => r.id === "b")!;
    expect(ani.hariHadir).toBe(1);
    expect(ani.totalMs).toBe(0);
  });

  it("urut total jam desc, lalu nama; days terurut tanggal asc", () => {
    const rows = [
      { id: "1", user_id: "a", tanggal: "2026-06-02", clock_in: "2026-06-02T01:00:00Z", clock_out: "2026-06-02T03:00:00Z" },
      { id: "2", user_id: "a", tanggal: "2026-06-01", clock_in: "2026-06-01T01:00:00Z", clock_out: "2026-06-01T02:00:00Z" },
      { id: "3", user_id: "b", tanggal: "2026-06-01", clock_in: "2026-06-01T01:00:00Z", clock_out: "2026-06-01T11:00:00Z" },
    ];
    const res = aggregateByUser(rows, people);
    // Ani (b) = 10 jam, Budi (a) = 3 jam, Citra (c) = 0 -> Citra terakhir
    expect(res.map((r) => r.id)).toEqual(["b", "a", "c"]);
    const budi = res.find((r) => r.id === "a")!;
    expect(budi.days.map((d) => d.tanggal)).toEqual(["2026-06-01", "2026-06-02"]);
  });
});
