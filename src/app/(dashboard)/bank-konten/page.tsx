import { requireRole } from "@/lib/auth";
import {
  getBankKonten,
  summarize,
  STATUS_LABEL,
  type KontenStatus,
  type KontenItem,
  type KontenGroup,
} from "@/lib/bank-konten";
import { PageHeader, StatCard, SectionTitle } from "@/components/ui-kit";
import { ExternalLink, FileSpreadsheet, FolderOpen, CheckCircle2 } from "lucide-react";
import { listPostedKeys } from "@/lib/post-schedule-data";
import { contentKey } from "@/lib/post-schedule";
import { PostedToggle } from "@/components/posted-toggle";
import { ClippingButton } from "@/components/clipping-button";

export const metadata = { title: "Bank Konten" };

function bankKey(title: string) { return contentKey({ video_id: null, title }); }

const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1ZOlVV-bJKUhRUqUKCSsczAPv8pk5X5fd1sYS8bVcPvM/edit";

const STATUS_TONE: Record<KontenStatus, string> = {
  ongoing: "bg-muted text-foreground/70",
  editing: "bg-brand-muted text-brand",
  revisi: "bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300",
  done: "bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300",
};

function StatusPill({ status }: { status: KontenStatus | null }) {
  if (!status) return <span className="text-xs text-muted-foreground/60">—</span>;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_TONE[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

function DriveLink({ link }: { link: string | null }) {
  if (!link) return <span className="text-xs text-muted-foreground/50">—</span>;
  return (
    <a
      href={link}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline"
    >
      <ExternalLink className="h-3.5 w-3.5" /> Buka
    </a>
  );
}

export default async function BankKontenPage() {
  const profile = await requireRole("owner", "editor", "social_media");
  const canManage = profile.role === "owner" || profile.role === "social_media";
  const isOwner = profile.role === "owner";
  const result = await getBankKonten();
  const postedSet = new Set(canManage ? await listPostedKeys() : []);

  return (
    <div>
      <PageHeader
        title="Bank Konten"
        description="Cerminan live dari sheet CONTENT LIST — daftar konten, progres, & link hasil di Google Drive."
      >
        <a
          href={SHEET_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-foreground/80 transition-colors hover:bg-accent"
        >
          <FileSpreadsheet className="h-4 w-4 text-muted-foreground" /> Buka Sheet
        </a>
      </PageHeader>

      {!result.ok ? (
        <NotConfigured reason={result.error} />
      ) : (
        <BankKontenView groups={result.groups} canManage={canManage} isOwner={isOwner} postedSet={postedSet} />
      )}
    </div>
  );
}

function BankKontenView({ groups, canManage, isOwner, postedSet }: { groups: KontenGroup[]; canManage: boolean; isOwner: boolean; postedSet: Set<string> }) {
  const s = summarize(groups);

  if (s.total === 0) {
    return (
      <p className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
        Belum ada data konten yang terbaca dari sheet.
      </p>
    );
  }

  return (
    <>
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Total Konten" value={s.total} />
        <StatCard label="Selesai (Done)" value={s.done} emphasis={s.done > 0} />
        <StatCard label="Sudah Posting" value={s.posted} />
      </div>

      {/* List video selesai + link Drive yang bisa langsung diklik */}
      <section className="mt-8 space-y-3">
        <div className="flex items-center justify-between">
          <SectionTitle>Video Selesai — Link Drive</SectionTitle>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300">
            <CheckCircle2 className="h-3.5 w-3.5" /> {s.doneItems.length} done
          </span>
        </div>
        {s.doneItems.length === 0 ? (
          <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
            Belum ada konten berstatus Fix/Done.
          </p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {s.doneItems.map((item, i) => (
              <DoneCard key={`${item.konten}-${i}`} item={item} isOwner={isOwner} />
            ))}
          </ul>
        )}
      </section>

      {/* Tabel lengkap per kategori */}
      <section className="mt-10 space-y-6">
        <SectionTitle>Semua Konten</SectionTitle>
        {groups.map((g) => (
          <div key={g.jenis} className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
            <div className="flex items-center justify-between border-b border-border/70 bg-muted/40 px-4 py-2.5">
              <h3 className="text-sm font-semibold tracking-tight">{g.jenis}</h3>
              <span className="text-xs text-muted-foreground">{g.items.length} konten</span>
            </div>
            <div className="divide-y divide-border/60">
              {g.items.map((item, i) => (
                <div key={`${item.konten}-${i}`} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 text-sm">
                  <span className="tnum w-6 shrink-0 text-xs text-muted-foreground/70">{item.no ?? ""}</span>
                  <span className="min-w-0 flex-1 truncate">{item.konten}</span>
                  <span className="shrink-0">
                    <StatusPill status={item.status} />
                  </span>
                  <span className="w-12 shrink-0 text-right">
                    <DriveLink link={item.link} />
                  </span>
                  {canManage && (
                    <PostedToggle
                      contentKey={bankKey(item.konten)}
                      sourceType="bank_konten"
                      title={item.konten}
                      initial={postedSet.has(bankKey(item.konten))}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>
    </>
  );
}

function DoneCard({ item, isOwner }: { item: KontenItem; isOwner: boolean }) {
  return (
    <li className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-card">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
        <FolderOpen className="h-[18px] w-[18px]" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{item.konten}</p>
        <p className="text-[11px] text-muted-foreground">{item.jenis}</p>
      </div>
      {item.link ? (
        <a href={item.link} target="_blank" rel="noreferrer" aria-label="Buka Drive" className="shrink-0 text-muted-foreground transition-colors hover:text-brand">
          <ExternalLink className="h-4 w-4" />
        </a>
      ) : (
        <span className="shrink-0 text-[10px] text-muted-foreground/60">tanpa link</span>
      )}
      {isOwner && <ClippingButton title={item.konten} link={item.link} />}
    </li>
  );
}

function NotConfigured({ reason }: { reason: "not_configured" | "fetch_failed" }) {
  return (
    <div className="rounded-2xl border border-amber-300/60 bg-amber-50 p-6 dark:border-amber-400/20 dark:bg-amber-400/10">
      <h2 className="font-display text-lg text-amber-900 dark:text-amber-200">
        {reason === "not_configured" ? "Belum dikonfigurasi" : "Gagal membaca sheet"}
      </h2>
      {reason === "not_configured" ? (
        <div className="mt-2 space-y-2 text-sm text-amber-900/90 dark:text-amber-200/90">
          <p>Tambahkan 2 env var lalu redeploy/restart:</p>
          <pre className="overflow-x-auto rounded-lg bg-amber-900/10 p-3 text-xs dark:bg-black/30">
{`BANK_KONTEN_SHEET_ID=1ZOlVV-bJKUhRUqUKCSsczAPv8pk5X5fd1sYS8bVcPvM
GOOGLE_SHEETS_API_KEY=...`}
          </pre>
          <p className="text-xs">
            API key dibuat di Google Cloud Console → APIs &amp; Services → Credentials (aktifkan
            <span className="font-medium"> Google Sheets API</span>). Sheet sudah di-share
            &quot;anyone with the link can view&quot;, jadi cukup API key tanpa OAuth.
          </p>
        </div>
      ) : (
        <p className="mt-2 text-sm text-amber-900/90 dark:text-amber-200/90">
          API key / sheet ID terisi tapi permintaan gagal. Cek: Sheets API aktif, API key valid,
          dan sheet di-share &quot;anyone with the link&quot;.
        </p>
      )}
    </div>
  );
}
