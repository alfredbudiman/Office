import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { listNotifications } from "@/lib/notifications";
import { markAllRead } from "./actions";
import { Button } from "@/components/ui/button";

export default async function NotifikasiPage() {
  await requireProfile();
  const items = await listNotifications();
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Notifikasi</h1>
        <form action={markAllRead}><Button variant="ghost" size="sm">Tandai semua dibaca</Button></form>
      </div>
      <div className="space-y-2">
        {items.map((n: { id: string; pesan: string; link: string | null; sudah_dibaca: boolean; created_at: string }) => (
          <Link key={n.id} href={n.link ?? "#"}
            className={`block rounded-md border p-3 text-sm ${n.sudah_dibaca ? "opacity-60" : "bg-muted/40"}`}>
            <p>{n.pesan}</p>
            <p className="mt-1 text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString("id-ID")}</p>
          </Link>
        ))}
        {items.length === 0 && <p className="text-sm text-muted-foreground">Belum ada notifikasi.</p>}
      </div>
    </div>
  );
}
