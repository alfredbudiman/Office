import { requireProfile } from "@/lib/auth";
import { menuForRole } from "@/lib/roles";
import { DashboardShell } from "@/components/dashboard-shell";
import { logout } from "@/app/login/actions";
import { NotifBell } from "@/components/notif-bell";
import { LogOut } from "lucide-react";
import { getSetting } from "@/lib/settings";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();
  const groups = menuForRole(profile.role);
  const driveFolderUrl = await getSetting("drive_folder_url");
  return (
    <DashboardShell
      groups={groups}
      nama={profile.nama}
      role={profile.role}
      driveFolderUrl={driveFolderUrl}
      headerRight={
        <>
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
        </>
      }
    >
      {children}
    </DashboardShell>
  );
}
