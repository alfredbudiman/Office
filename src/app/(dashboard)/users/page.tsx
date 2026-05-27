import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui-kit";
import { NewUserForm } from "./new-user-form";
import { UserRowActions } from "./user-row-actions";
import type { Role } from "@/lib/roles";

export default async function UsersPage() {
  await requireRole("owner");
  const supabase = await createClient();
  const { data: users } = await supabase
    .from("profiles")
    .select("id, nama, email, role, aktif")
    .order("created_at", { ascending: true });

  return (
    <div className="space-y-6">
      <PageHeader title="Kelola User" description="Buat akun & atur peran tim.">
        <NewUserForm />
      </PageHeader>

      {/* Mobile: card list */}
      <div className="space-y-2 sm:hidden">
        {(users ?? []).map((u: { id: string; nama: string; email: string; role: Role; aktif: boolean }) => (
          <div key={u.id} className="rounded-xl border border-border bg-card p-3 shadow-card">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{u.nama}</p>
                <p className="truncate text-xs text-muted-foreground">{u.email}</p>
              </div>
              <UserRowActions id={u.id} role={u.role} aktif={u.aktif} />
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs capitalize">{u.role}</span>
              {u.aktif ? (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300">
                  Aktif
                </span>
              ) : (
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  Nonaktif
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Desktop: table */}
      <div className="hidden rounded-xl border border-border bg-card shadow-card overflow-hidden overflow-x-auto sm:block">
        <table className="w-full">
          <thead>
            <tr className="bg-muted/50">
              <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Nama</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Email</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Role</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</th>
              <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {(users ?? []).map((u: { id: string; nama: string; email: string; role: Role; aktif: boolean }) => (
              <tr key={u.id} className="border-t border-border hover:bg-accent/40 transition-colors">
                <td className="px-4 py-2.5 text-sm">{u.nama}</td>
                <td className="px-4 py-2.5 text-sm">{u.email}</td>
                <td className="px-4 py-2.5 text-sm">
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs capitalize">{u.role}</span>
                </td>
                <td className="px-4 py-2.5 text-sm">
                  {u.aktif ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300">
                      Aktif
                    </span>
                  ) : (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      Nonaktif
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <UserRowActions id={u.id} role={u.role} aktif={u.aktif} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
