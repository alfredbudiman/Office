import { describe, it, expect } from "vitest";
import { wibDate, wibToday } from "@/lib/wib";

describe("wibDate", () => {
  it("UTC 02:00 → WIB 09:00 hari yang sama", () => {
    expect(wibDate(new Date("2026-06-03T02:00:00Z"))).toBe("2026-06-03");
  });

  it("UTC 23:00 → WIB 06:00 hari berikutnya", () => {
    expect(wibDate(new Date("2026-06-03T23:00:00Z"))).toBe("2026-06-04");
  });

  it("UTC midnight → WIB 07:00 hari yang sama", () => {
    expect(wibDate(new Date("2026-06-03T00:00:00Z"))).toBe("2026-06-03");
  });

  it("UTC 17:00 → WIB midnight (boundary tepat)", () => {
    expect(wibDate(new Date("2026-06-03T17:00:00Z"))).toBe("2026-06-04");
  });

  it("UTC 16:59:59 → WIB 23:59:59 hari yang sama", () => {
    expect(wibDate(new Date("2026-06-03T16:59:59Z"))).toBe("2026-06-03");
  });
});

describe("wibToday", () => {
  it("kembalikan string YYYY-MM-DD valid", () => {
    expect(wibToday()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("konsisten dengan wibDate(new Date())", () => {
    expect(wibToday()).toBe(wibDate(new Date()));
  });
});
