import { requireProfile } from "@/lib/auth";
import { menuForRole } from "@/lib/roles";
import { Sidebar } from "@/components/sidebar";
import { logout } from "@/app/login/actions";
import { NotifBell } from "@/components/notif-bell";
import { LogOut } from "lucide-react";
import { getSetting } from "@/lib/settings";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();
  const groups = menuForRole(profile.role);
  const driveFolderUrl = await getSetting("drive_folder_url");
  return (
    <div className="bg-paper flex min-h-screen">
      <Sidebar groups={groups} nama={profile.nama} role={profile.role} driveFolderUrl={driveFolderUrl} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-end gap-1 border-b border-border/70 bg-background/70 px-6 backdrop-blur-md">
          <NotifBell />
          <form action={logout}>
            <button
              type="submit"
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <LogOut className="h-4 w-4" strokeWidth={2} />
              <span className="hidden sm:inline">Keluar</span>
            </button>
          </form>
        </header>
        <main className="flex-1">
          <div className="mx-auto w-full max-w-6xl px-6 py-10">{children}</div>
        </main>
      </div>
    </div>
  );
}
