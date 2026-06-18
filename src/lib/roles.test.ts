import { describe, it, expect } from "vitest";
import { menuForRole, type Role } from "@/lib/roles";

// ratakan semua href dari semua grup
const hrefs = (role: Role) => menuForRole(role).flatMap((g) => g.items.map((i) => i.href));
const sections = (role: Role) => menuForRole(role).map((g) => g.section);

describe("menuForRole", () => {
  it("owner: konten + rekrutmen + admin", () => {
    expect(hrefs("owner")).toEqual([
      "/dashboard",
      "/video",
      "/bank-konten",
      "/jadwal",
      "/stok",
      "/rekap",
      "/recruitment",
      "/users",
      "/absensi",
      "/pengaturan",
      "/hutang",
    ]);
    expect(sections("owner")).toEqual(["Konten", "Rekrutmen", undefined]);
  });

  it("finance (Irene): HANYA rekapitulasi hutang", () => {
    expect(hrefs("finance")).toEqual(["/hutang"]);
  });

  it("social_media: jadwal + bank konten + absensi, TANPA recruitment/users/video", () => {
    const h = hrefs("social_media");
    expect(h).toEqual(["/dashboard", "/jadwal", "/bank-konten", "/absensi"]);
    expect(h).not.toContain("/recruitment");
    expect(h).not.toContain("/users");
    expect(h).not.toContain("/video");
  });

  it("editor: hanya konten + absensi, TANPA recruitment", () => {
    const h = hrefs("editor");
    expect(h).toEqual(["/dashboard", "/video", "/bank-konten", "/absensi"]);
    expect(h).not.toContain("/recruitment");
  });

  it("hrd (Sabina): recruitment + absensi, TANPA konten", () => {
    const h = hrefs("hrd");
    expect(h).toEqual(["/recruitment", "/absensi"]);
    expect(h).not.toContain("/video");
    expect(h).not.toContain("/dashboard");
  });

  it("role tak dikenal mendapat menu kosong (fail safe)", () => {
    expect(menuForRole("xxx" as Role)).toEqual([]);
  });
});
