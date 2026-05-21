export type Role = "owner" | "editor" | "hrd";

export type MenuItem = { label: string; href: string };

const MENUS: Record<Role, MenuItem[]> = {
  owner: [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Video", href: "/video" },
    { label: "Stok Konten", href: "/stok" },
    { label: "Rekap Kinerja", href: "/rekap" },
    { label: "Kelola User", href: "/users" },
    { label: "Absensi", href: "/absensi" },
  ],
  editor: [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Video Saya", href: "/video" },
    { label: "Absensi", href: "/absensi" },
  ],
  hrd: [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Absensi", href: "/absensi" },
  ],
};

export function menuForRole(role: Role): MenuItem[] {
  return MENUS[role] ?? [];
}
