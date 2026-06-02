import { describe, it, expect } from "vitest";
import { buildProgressSummary } from "@/lib/progress-summary";

const baseTime = new Date("2026-06-02T17:30:00+07:00");

describe("buildProgressSummary", () => {
  it("tanpa aktivitas & tanpa note", () => {
    const s = buildProgressSummary({
      nama: "Agus",
      clockOutTime: baseTime,
      statusMoves: [],
      comments: [],
    });
    expect(s).toContain("Halo, saya Agus");
    expect(s).not.toContain("Yang dikerjakan");
    expect(s).not.toContain("Komentar");
    expect(s).not.toContain("Catatan");
  });

  it("hanya status moves", () => {
    const s = buildProgressSummary({
      nama: "Agus",
      clockOutTime: baseTime,
      statusMoves: [
        { judul: "Ep 1", statusBaru: "review_draft" },
        { judul: "Ep 2", statusBaru: "editing" },
      ],
      comments: [],
    });
    expect(s).toContain("Yang dikerjakan");
    expect(s).toContain("Ep 1 → Review Draft");
    expect(s).toContain("Ep 2 → Editing");
    expect(s).not.toContain("Komentar");
  });

  it("hanya komentar, truncate ke 80 char", () => {
    const long = "x".repeat(120);
    const s = buildProgressSummary({
      nama: "Agus",
      clockOutTime: baseTime,
      statusMoves: [],
      comments: [{ judul: "Ep 1", isi: long }],
    });
    expect(s).toContain("Komentar");
    expect(s).toMatch(/Ep 1:.*x{80}\.\.\./);
    expect(s).not.toContain("x".repeat(81));
  });

  it("status + komentar + extraNote", () => {
    const s = buildProgressSummary({
      nama: "Agus",
      clockOutTime: baseTime,
      statusMoves: [{ judul: "Ep 1", statusBaru: "final" }],
      comments: [{ judul: "Ep 1", isi: "revisi BGM" }],
      extraNote: "lanjut besok",
    });
    expect(s).toContain("Yang dikerjakan");
    expect(s).toContain("Ep 1 → Final");
    expect(s).toContain("Komentar");
    expect(s).toContain("Ep 1: revisi BGM");
    expect(s).toContain("Catatan: lanjut besok");
  });

  it("format jam HH:mm WIB (sesuai clockOutTime)", () => {
    const s = buildProgressSummary({
      nama: "Agus",
      clockOutTime: new Date("2026-06-02T09:05:00+07:00"),
      statusMoves: [], comments: [],
    });
    expect(s).toMatch(/jam 09:05/);
  });
});
