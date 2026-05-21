import Link from "next/link";
import { Bell } from "lucide-react";
import { unreadCount } from "@/lib/notifications";

export async function NotifBell() {
  const count = await unreadCount();
  return (
    <Link
      href="/notifikasi"
      aria-label={`Notifikasi${count > 0 ? `, ${count} belum dibaca` : ""}`}
      className="relative flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      <Bell className="h-[18px] w-[18px]" strokeWidth={2} />
      {count > 0 && (
        <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-semibold leading-none text-brand-foreground ring-2 ring-background tnum">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Link>
  );
}
