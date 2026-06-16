export type Role = "owner" | "editor" | "hrd";

export type MenuItem = { label: string; href: string };

const MENUS: Record<Role, MenuItem[]> = {
  owner: [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Video", href: "/video" },
    { label: "Bank Konten", href: "/bank-konten" },
    { label: "Stok Konten", href: "/stok" },
    { label: "Rekap Kinerja", href: "/rekap" },
    { label: "Recruitment", href: "/recruitment" },
    { label: "Kelola User", href: "/users" },
    { label: "Absensi", href: "/absensi" },
    { label: "Pengaturan", href: "/pengaturan" },
  ],
  editor: [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Video Saya", href: "/video" },
    { label: "Bank Konten", href: "/bank-konten" },
    { label: "Recruitment", href: "/recruitment" },
    { label: "Absensi", href: "/absensi" },
  ],
  hrd: [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Recruitment", href: "/recruitment" },
    { label: "Absensi", href: "/absensi" },
  ],
};

export function menuForRole(role: Role): MenuItem[] {
  return MENUS[role] ?? [];
}
