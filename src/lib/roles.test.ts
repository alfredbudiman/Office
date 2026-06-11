import { describe, it, expect } from "vitest";
import { menuForRole, type Role } from "@/lib/roles";

describe("menuForRole", () => {
  it("owner mendapat semua menu utama", () => {
    const hrefs = menuForRole("owner").map((m) => m.href);
    expect(hrefs).toEqual([
      "/dashboard",
      "/video",
      "/bank-konten",
      "/stok",
      "/rekap",
      "/users",
      "/absensi",
      "/pengaturan",
    ]);
  });

  it("editor mendapat dashboard, video saya, bank konten, absensi", () => {
    const hrefs = menuForRole("editor").map((m) => m.href);
    expect(hrefs).toEqual(["/dashboard", "/video", "/bank-konten", "/absensi"]);
  });

  it("hrd hanya dashboard dan absensi", () => {
    const hrefs = menuForRole("hrd").map((m) => m.href);
    expect(hrefs).toEqual(["/dashboard", "/absensi"]);
  });

  it("role tak dikenal mendapat menu kosong (fail safe)", () => {
    expect(menuForRole("xxx" as Role)).toEqual([]);
  });
});
