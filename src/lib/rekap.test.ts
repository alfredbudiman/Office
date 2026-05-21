import { describe, it, expect } from "vitest";
import {
  totalDurationMs, average, formatDuration, stageDurationsMs,
  type EventLite,
} from "@/lib/rekap";

describe("totalDurationMs", () => {
  it("selisih created -> final dalam ms", () => {
    expect(totalDurationMs("2026-01-01T00:00:00Z", "2026-01-02T00:00:00Z")).toBe(86400000);
  });
  it("null bila belum final", () => {
    expect(totalDurationMs("2026-01-01T00:00:00Z", null)).toBeNull();
  });
});

describe("average", () => {
  it("rata-rata abaikan null", () => {
    expect(average([100, 200, null, 300])).toBe(200);
  });
  it("null bila kosong", () => {
    expect(average([null, null])).toBeNull();
  });
});

describe("formatDuration", () => {
  it("format hari & jam", () => {
    expect(formatDuration(90000000)).toBe("1 hari 1 jam"); // 25 jam
  });
  it("format jam & menit untuk < 1 hari", () => {
    expect(formatDuration(3 * 3600000 + 30 * 60000)).toBe("3 jam 30 menit");
  });
  it("strip nol", () => {
    expect(formatDuration(2 * 86400000)).toBe("2 hari");
  });
  it("null -> tanda strip", () => {
    expect(formatDuration(null)).toBe("—");
  });
});

describe("stageDurationsMs", () => {
  it("hitung lama tiap status dari created + events (loop revisi dijumlahkan)", () => {
    const base = "2026-01-01T0";
    const events: EventLite[] = [
      { status_baru: "editing", created_at: base + "1:00:00Z" },
      { status_baru: "review_draft", created_at: base + "2:00:00Z" },
      { status_baru: "editing", created_at: base + "3:00:00Z" },
      { status_baru: "review_draft", created_at: base + "4:00:00Z" },
      { status_baru: "final", created_at: base + "5:00:00Z" },
    ];
    const res = stageDurationsMs("draft_brief", base + "0:00:00Z", events);
    expect(res.draft_brief).toBe(3600000);
    expect(res.editing).toBe(2 * 3600000);
    expect(res.review_draft).toBe(2 * 3600000);
    expect(res.final ?? 0).toBe(0);
  });
});
