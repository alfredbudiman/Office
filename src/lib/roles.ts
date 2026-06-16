export type Role = "owner" | "editor" | "hrd";

export type MenuItem = { label: string; href: string };
// Grup menu di sidebar. `section` opsional — bila kosong, item tampil tanpa judul grup.
export type MenuGroup = { section?: string; items: MenuItem[] };

const MENUS: Record<Role, MenuGroup[]> = {
  // Alfred — semua terbuka
  owner: [
    {
      section: "Konten",
      items: [
        { label: "Dashboard", href: "/dashboard" },
        { label: "Video", href: "/video" },
        { label: "Bank Konten", href: "/bank-konten" },
        { label: "Stok Konten", href: "/stok" },
        { label: "Rekap Kinerja", href: "/rekap" },
      ],
    },
    {
      section: "Rekrutmen",
      items: [{ label: "Recruitment", href: "/recruitment" }],
    },
    {
      items: [
        { label: "Kelola User", href: "/users" },
        { label: "Absensi", href: "/absensi" },
        { label: "Pengaturan", href: "/pengaturan" },
      ],
    },
  ],
  // Editor (mis. Agus) — hanya konten, tanpa rekrutmen
  editor: [
    {
      section: "Konten",
      items: [
        { label: "Dashboard", href: "/dashboard" },
        { label: "Video Saya", href: "/video" },
        { label: "Bank Konten", href: "/bank-konten" },
      ],
    },
    {
      items: [{ label: "Absensi", href: "/absensi" }],
    },
  ],
  // Recruitment (mis. Sabina) — hanya rekrutmen + absensi, tanpa konten
  hrd: [
    {
      section: "Rekrutmen",
      items: [{ label: "Recruitment", href: "/recruitment" }],
    },
    {
      items: [{ label: "Absensi", href: "/absensi" }],
    },
  ],
};

export function menuForRole(role: Role): MenuGroup[] {
  return MENUS[role] ?? [];
}
