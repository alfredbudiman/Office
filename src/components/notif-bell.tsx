import Link from "next/link";
import { unreadCount } from "@/lib/notifications";

export async function NotifBell() {
  const count = await unreadCount();
  return (
    <Link href="/notifikasi" className="relative inline-flex items-center rounded-md px-2 py-1 text-sm hover:bg-muted">
      <span aria-hidden>🔔</span>
      {count > 0 && (
        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-medium text-white">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Link>
  );
}
