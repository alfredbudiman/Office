"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  LayoutDashboard, Clapperboard, Library, Boxes, BarChart3, Users, Clock, Settings, Folder, UserSearch, CalendarClock,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import { MobileDrawer } from "@/components/mobile-drawer";
import type { MenuGroup } from "@/lib/roles";

const ICONS: Record<string, LucideIcon> = {
  "/dashboard": LayoutDashboard,
  "/video": Clapperboard,
  "/bank-konten": Library,
  "/jadwal": CalendarClock,
  "/stok": Boxes,
  "/rekap": BarChart3,
  "/recruitment": UserSearch,
  "/users": Users,
  "/absensi": Clock,
  "/pengaturan": Settings,
};

function SidebarContent({
  groups,
  nama,
  role,
  driveFolderUrl,
  onNavigate,
}: {
  groups: MenuGroup[];
  nama: string;
  role: string;
  driveFolderUrl: string | null;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const initial = (nama?.trim()?.[0] ?? "?").toUpperCase();

  return (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <div className="flex flex-col items-center gap-1.5 px-5 py-6">
        <Image
          src="/sprout-logo.png"
          alt="SPROUT"
          width={644}
          height={575}
          priority
          className="h-14 w-auto"
        />
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          Dashboard Tim
        </p>
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-2 px-3">
        {groups.map((group, gi) => (
          <div key={group.section ?? `g${gi}`} className="flex flex-col gap-0.5">
            <p className="font-mono px-3 pb-1 pt-2 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground/70">
              {group.section ?? "Menu"}
            </p>
            {group.items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + "/");
              const Icon = ICONS[item.href] ?? LayoutDashboard;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  className="relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors"
                >
                  {active && (
                    <motion.span
                      layoutId="nav-active"
                      className="absolute inset-0 rounded-lg bg-brand-muted"
                      transition={{ type: "spring", stiffness: 500, damping: 38 }}
                    />
                  )}
                  <Icon
                    className={`relative z-10 h-[18px] w-[18px] transition-colors ${
                      active ? "text-brand" : "text-muted-foreground"
                    }`}
                    strokeWidth={2}
                  />
                  <span
                    className={`relative z-10 transition-colors ${
                      active ? "font-medium text-brand" : "text-foreground/70"
                    }`}
                  >
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {driveFolderUrl && (
        <a
          href={driveFolderUrl}
          target="_blank"
          rel="noreferrer"
          className="mx-3 mb-2 flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-foreground/70 transition-colors hover:bg-accent"
        >
          <Folder className="h-[18px] w-[18px] text-muted-foreground" strokeWidth={2} />
          <span>Folder Drive Final</span>
        </a>
      )}

      {/* User chip */}
      <div className="m-3 flex items-center gap-3 rounded-xl border border-border bg-card/60 px-3 py-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand/10 text-xs font-semibold text-brand">
          {initial}
        </span>
        <div className="min-w-0 leading-tight">
          <p className="truncate text-sm font-medium">{nama}</p>
          <p className="text-[11px] capitalize text-muted-foreground">{role}</p>
        </div>
      </div>
    </div>
  );
}

export function Sidebar({
  groups, nama, role, driveFolderUrl,
}: {
  groups: MenuGroup[];
  nama: string;
  role: string;
  driveFolderUrl: string | null;
}) {
  return (
    <aside className="relative hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
      <SidebarContent groups={groups} nama={nama} role={role} driveFolderUrl={driveFolderUrl} />
    </aside>
  );
}

export function MobileSidebar({
  groups,
  nama,
  role,
  driveFolderUrl,
  open,
  onClose,
}: {
  groups: MenuGroup[];
  nama: string;
  role: string;
  driveFolderUrl: string | null;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <MobileDrawer open={open} onClose={onClose}>
      <div className="flex h-full flex-col border-r border-sidebar-border">
        <SidebarContent groups={groups} nama={nama} role={role} driveFolderUrl={driveFolderUrl} onNavigate={onClose} />
      </div>
    </MobileDrawer>
  );
}
