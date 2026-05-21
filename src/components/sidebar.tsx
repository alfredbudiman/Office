"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import type { MenuItem } from "@/lib/roles";

export function Sidebar({ items, nama }: { items: MenuItem[]; nama: string }) {
  const pathname = usePathname();
  return (
    <aside className="flex w-60 flex-col border-r bg-background p-4">
      <div className="mb-6 px-2">
        <p className="text-sm text-muted-foreground">Halo,</p>
        <p className="font-semibold">{nama}</p>
      </div>
      <nav className="flex flex-col gap-1">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link key={item.href} href={item.href} className="relative rounded-md px-3 py-2 text-sm">
              {active && (
                <motion.span
                  layoutId="sidebar-active"
                  className="absolute inset-0 rounded-md bg-muted"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <span className={`relative ${active ? "font-medium" : "text-muted-foreground"}`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
