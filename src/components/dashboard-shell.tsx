"use client";

import { useState, type ReactNode } from "react";
import { Menu } from "lucide-react";
import { Sidebar, MobileSidebar } from "@/components/sidebar";
import type { MenuItem } from "@/lib/roles";

export function DashboardShell({
  items,
  nama,
  role,
  headerRight,
  children,
}: {
  items: MenuItem[];
  nama: string;
  role: string;
  headerRight: ReactNode;
  children: ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="bg-paper flex min-h-screen">
      <Sidebar items={items} nama={nama} role={role} />
      <MobileSidebar
        items={items}
        nama={nama}
        role={role}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-1 border-b border-border/70 bg-background/70 px-4 backdrop-blur-md sm:px-6">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Buka menu"
            className="-ml-1 inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground lg:hidden"
          >
            <Menu className="h-5 w-5" strokeWidth={2} />
          </button>
          <div className="ml-auto flex items-center gap-1">{headerRight}</div>
        </header>
        <main className="flex-1">
          <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-10">{children}</div>
        </main>
      </div>
    </div>
  );
}
