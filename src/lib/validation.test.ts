import { describe, it, expect } from "vitest";
import { validateNewUser } from "@/lib/validation";

describe("validateNewUser", () => {
  it("menerima input valid", () => {
    const r = validateNewUser({ nama: "Budi", email: "budi@mail.com", password: "rahasia123", role: "editor" });
    expect(r.ok).toBe(true);
  });

  it("menolak nama kosong", () => {
    const r = validateNewUser({ nama: " ", email: "budi@mail.com", password: "rahasia123", role: "editor" });
    expect(r.ok).toBe(false);
    expect(r.errors.nama).toBeDefined();
  });

  it("menolak email tidak valid", () => {
    const r = validateNewUser({ nama: "Budi", email: "bukan-email", password: "rahasia123", role: "editor" });
    expect(r.ok).toBe(false);
    expect(r.errors.email).toBeDefined();
  });

  it("menolak password < 8 karakter", () => {
    const r = validateNewUser({ nama: "Budi", email: "budi@mail.com", password: "123", role: "editor" });
    expect(r.ok).toBe(false);
    expect(r.errors.password).toBeDefined();
  });

  it("menolak role tak dikenal", () => {
    const r = validateNewUser({ nama: "Budi", email: "budi@mail.com", password: "rahasia123", role: "raja" as never });
    expect(r.ok).toBe(false);
    expect(r.errors.role).toBeDefined();
  });
});
