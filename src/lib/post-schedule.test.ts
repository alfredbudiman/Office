import { describe, it, expect } from "vitest";
import { buildChecklist, scheduleProgress, contentKey, type ScheduleRow } from "@/lib/post-schedule";

function row(p: Partial<ScheduleRow>): ScheduleRow {
  return {
    id: Math.random().toString(36).slice(2),
    title: "Konten A",
    source_type: "manual",
    video_id: null,
    drive_url: null,
    platform: "youtube",
    scheduled_at: "2026-06-18T12:00:00+07:00",
    status: "scheduled",
    posted_at: null,
    note: null,
    created_by: null,
    created_at: "2026-06-01T00:00:00Z",
    ...p,
  };
}

describe("contentKey", () => {
  it("pakai video_id bila ada, kalau tidak pakai judul (case-insensitive)", () => {
    expect(contentKey({ video_id: "abc", title: "X" })).toBe("v:abc");
    expect(contentKey({ video_id: null, title: " Podcast 5 " })).toBe("t:podcast 5");
  });
});

describe("buildChecklist", () => {
  it("mengelompokkan per konten dan mengisi sel per platform", () => {
    const rows = [
      row({ title: "Podcast 5", platform: "youtube", status: "posted", scheduled_at: "2026-06-15T19:00:00+07:00" }),
      row({ title: "Podcast 5", platform: "tiktok", status: "scheduled", scheduled_at: "2026-06-16T20:00:00+07:00" }),
    ];
    const cl = buildChecklist(rows);
    expect(cl).toHaveLength(1);
    expect(cl[0].cells.youtube).toMatchObject({ status: "posted", date: "2026-06-15" });
    expect(cl[0].cells.tiktok).toMatchObject({ status: "scheduled", date: "2026-06-16" });
    expect(cl[0].cells.instagram).toBeNull();
  });

  it("'posted' menang atas 'scheduled' di platform yang sama", () => {
    const rows = [
      row({ title: "A", platform: "instagram", status: "scheduled", scheduled_at: "2026-06-10T10:00:00+07:00" }),
      row({ title: "A", platform: "instagram", status: "posted", scheduled_at: "2026-06-12T10:00:00+07:00" }),
    ];
    expect(buildChecklist(rows)[0].cells.instagram).toMatchObject({ status: "posted", date: "2026-06-12" });
  });

  it("video_id memisahkan konten meski judul sama", () => {
    const rows = [
      row({ title: "Sama", video_id: "v1", platform: "youtube" }),
      row({ title: "Sama", video_id: "v2", platform: "youtube" }),
    ];
    expect(buildChecklist(rows)).toHaveLength(2);
  });
});

describe("scheduleProgress", () => {
  it("hitung posted dari total", () => {
    const rows = [row({ status: "posted" }), row({ status: "scheduled" }), row({ status: "posted" })];
    expect(scheduleProgress(rows)).toEqual({ posted: 2, total: 3 });
  });
});
