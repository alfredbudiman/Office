import { describe, it, expect } from "vitest";
import { stockReadyByType, pipelineByStatus, type StockVideo } from "@/lib/stock";

const v = (tipe: string, status: string, sudah_tayang = false): StockVideo =>
  ({ tipe: tipe as StockVideo["tipe"], status: status as StockVideo["status"], sudah_tayang });

describe("stockReadyByType", () => {
  it("hitung video final yang belum tayang per tipe", () => {
    const res = stockReadyByType([
      v("monolog", "final"), v("monolog", "final"), v("monolog", "final", true),
      v("shorts", "final"), v("shorts", "editing"),
    ]);
    expect(res.monolog).toBe(2);
    expect(res.shorts).toBe(1);
    expect(res.podcast).toBe(0);
    expect(res.clipping).toBe(0);
  });
});

describe("pipelineByStatus", () => {
  it("hitung jumlah video per status", () => {
    const res = pipelineByStatus([
      v("monolog", "editing"), v("shorts", "editing"), v("monolog", "review_draft"),
    ]);
    expect(res.editing).toBe(2);
    expect(res.review_draft).toBe(1);
    expect(res.draft_brief).toBe(0);
  });
});
