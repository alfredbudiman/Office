import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { listNotifications } from "@/lib/notifications";
import { markAllRead } from "./actions";
import { PageHeader } from "@/components/ui-kit";
import { CheckCheck, Bell } from "lucide-react";

export default async function NotifikasiPage() {
  await requireProfile();
  const items = await listNotifications();
  return (
    <div className="space-y-6">
      <PageHeader title="Notifikasi" description="Aktivitas terbaru yang membutuhkan perhatian Anda.">
        <form action={markAllRead}>
          <button
            type="submit"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm hover:bg-accent transition-colors"
          >
            <CheckCheck size={14} />
            Tandai semua dibaca
          </button>
        </form>
      </PageHeader>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-border bg-card px-6 py-16 text-center shadow-card">
          <Bell size={32} className="text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Belum ada notifikasi.</p>
        </div>
      ) : (
        <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-card">
          {items.map((n: { id: string; pesan: string; link: string | null; sudah_dibaca: boolean; created_at: string }) => (
            <Link
              key={n.id}
              href={n.link ?? "#"}
              className={`flex items-start gap-3 px-4 py-3 transition-colors hover:bg-accent/50 ${
                n.sudah_dibaca ? "" : "bg-brand-muted/40"
              }`}
            >
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.sudah_dibaca ? "bg-transparent" : "bg-brand"}`} />
              <div className="min-w-0 flex-1">
                <p className={`text-sm ${n.sudah_dibaca ? "text-muted-foreground" : "text-foreground"}`}>{n.pesan}</p>
                <p className="tnum mt-0.5 text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString("id-ID")}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
