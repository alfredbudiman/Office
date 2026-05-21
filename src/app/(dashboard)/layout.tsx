import { requireProfile } from "@/lib/auth";
import { menuForRole } from "@/lib/roles";
import { Sidebar } from "@/components/sidebar";
import { logout } from "@/app/login/actions";
import { Button } from "@/components/ui/button";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();
  const items = menuForRole(profile.role);
  return (
    <div className="flex min-h-screen">
      <Sidebar items={items} nama={profile.nama} />
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b px-6 py-3">
          <span className="text-sm capitalize text-muted-foreground">{profile.role}</span>
          <form action={logout}>
            <Button variant="ghost" size="sm" type="submit">Keluar</Button>
          </form>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
