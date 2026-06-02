import { requireRole } from "@/lib/auth";
import { getSetting } from "@/lib/settings";
import { PageHeader, SectionTitle } from "@/components/ui-kit";
import { SettingsForm } from "./settings-form";

export default async function PengaturanPage() {
  await requireRole("owner");
  const driveUrl = (await getSetting("drive_folder_url")) ?? "";

  return (
    <div className="space-y-6">
      <PageHeader title="Pengaturan" description="Konfigurasi global aplikasi." />

      <div className="rounded-xl border border-border bg-card p-5 shadow-card">
        <SectionTitle>Folder Drive Final</SectionTitle>
        <p className="mt-1 text-xs text-muted-foreground">
          URL folder Google Drive berisi hasil semua video. Akan tampil sebagai shortcut di sidebar &amp; dashboard.
        </p>
        <div className="mt-4">
          <SettingsForm initialUrl={driveUrl} />
        </div>
      </div>
    </div>
  );
}
