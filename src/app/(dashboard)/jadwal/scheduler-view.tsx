"use client";

import { useMemo, useState, useTransition, useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CalendarDays, LayoutGrid, Plus, ChevronLeft, ChevronRight, Download, Check, Trash2, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { wibDate, wibToday } from "@/lib/wib";
import {
  PLATFORMS, PLATFORM_LABEL, buildChecklist, scheduleProgress,
  type Platform, type ScheduleRow,
} from "@/lib/post-schedule";
import { createSchedule, togglePosted, deleteSchedule } from "./actions";
import type { VideoOption } from "@/lib/post-schedule-data";

const PLATFORM_DOT: Record<Platform, string> = {
  youtube: "bg-red-500",
  youtube_shorts: "bg-rose-400",
  tiktok: "bg-foreground",
  instagram: "bg-pink-500",
};

const WD = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

function pad(n: number) { return String(n).padStart(2, "0"); }
function timeWIB(iso: string) {
  return new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });
}
function prettyDate(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

type BankOption = { title: string; link: string | null };

export function SchedulerView({
  rows, videoOptions, bankOptions,
}: {
  rows: ScheduleRow[];
  videoOptions: VideoOption[];
  bankOptions: BankOption[];
}) {
  const router = useRouter();
  const [view, setView] = useState<"calendar" | "checklist">("calendar");
  const [formOpen, setFormOpen] = useState(false);
  const today = wibToday();
  const [cursor, setCursor] = useState(() => {
    const [y, m] = today.split("-").map(Number);
    return { y, m: m - 1 }; // m: 0-based
  });
  const [selected, setSelected] = useState<string>(today);
  const [pending, start] = useTransition();

  const byDate = useMemo(() => {
    const map = new Map<string, ScheduleRow[]>();
    for (const r of rows) {
      const k = wibDate(new Date(r.scheduled_at));
      (map.get(k) ?? map.set(k, []).get(k)!).push(r);
    }
    for (const list of map.values()) list.sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
    return map;
  }, [rows]);

  const progress = useMemo(() => scheduleProgress(rows), [rows]);
  const checklist = useMemo(() => buildChecklist(rows), [rows]);
  const selectedRows = byDate.get(selected) ?? [];

  function act(fn: () => Promise<{ ok: boolean; error?: string }>, okMsg: string) {
    start(async () => {
      const res = await fn();
      if (!res.ok) { toast.error(res.error ?? "Gagal"); return; }
      toast.success(okMsg);
      router.refresh();
    });
  }

  // grid bulan (Senin-awal)
  const monthCells = useMemo(() => {
    const first = new Date(Date.UTC(cursor.y, cursor.m, 1));
    const startOffset = (first.getUTCDay() + 6) % 7; // Senin=0
    const days = new Date(Date.UTC(cursor.y, cursor.m + 1, 0)).getUTCDate();
    const cells: (string | null)[] = [];
    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let d = 1; d <= days; d++) cells.push(`${cursor.y}-${pad(cursor.m + 1)}-${pad(d)}`);
    return cells;
  }, [cursor]);

  function shiftMonth(delta: number) {
    setCursor((c) => {
      const m = c.m + delta;
      return { y: c.y + Math.floor(m / 12), m: ((m % 12) + 12) % 12 };
    });
  }

  return (
    <div className="space-y-4">
      {/* Bar atas */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-border bg-card p-0.5">
            <button
              onClick={() => setView("calendar")}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${view === "calendar" ? "bg-brand-muted text-[#1d5128]" : "text-muted-foreground hover:text-foreground"}`}
            >
              <CalendarDays className="h-4 w-4" /> Kalender
            </button>
            <button
              onClick={() => setView("checklist")}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${view === "checklist" ? "bg-brand-muted text-[#1d5128]" : "text-muted-foreground hover:text-foreground"}`}
            >
              <LayoutGrid className="h-4 w-4" /> Checklist
            </button>
          </div>
          <span className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{progress.posted}</span>/{progress.total} diposting
          </span>
        </div>
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" /> Jadwalkan
        </Button>
      </div>

      {formOpen && (
        <ScheduleForm
          videoOptions={videoOptions}
          bankOptions={bankOptions}
          defaultDate={selected}
          onClose={() => setFormOpen(false)}
          onDone={() => { setFormOpen(false); router.refresh(); }}
        />
      )}

      {view === "calendar" ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
          {/* Kalender */}
          <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-lg tracking-tight">{MONTHS[cursor.m]} {cursor.y}</h2>
              <div className="flex gap-1">
                <Button size="icon-sm" variant="ghost" onClick={() => shiftMonth(-1)}><ChevronLeft className="h-4 w-4" /></Button>
                <Button size="icon-sm" variant="ghost" onClick={() => shiftMonth(1)}><ChevronRight className="h-4 w-4" /></Button>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center">
              {WD.map((w) => (
                <div key={w} className="font-mono py-1 text-[10px] uppercase tracking-wider text-muted-foreground">{w}</div>
              ))}
              {monthCells.map((ymd, i) => {
                if (!ymd) return <div key={`b${i}`} />;
                const list = byDate.get(ymd) ?? [];
                const isSel = ymd === selected;
                const isToday = ymd === today;
                return (
                  <button
                    key={ymd}
                    onClick={() => setSelected(ymd)}
                    className={`flex min-h-[58px] flex-col rounded-lg border p-1.5 text-left transition-colors ${isSel ? "border-brand bg-brand-muted/60" : "border-transparent hover:bg-accent"}`}
                  >
                    <span className={`tnum text-xs ${isToday ? "font-bold text-brand" : "text-foreground/70"}`}>{Number(ymd.slice(8))}</span>
                    {list.length > 0 && (
                      <span className="mt-auto flex flex-wrap gap-0.5">
                        {list.slice(0, 4).map((r) => (
                          <span key={r.id} className={`h-1.5 w-1.5 rounded-full ${PLATFORM_DOT[r.platform]} ${r.status === "posted" ? "" : "opacity-40"}`} />
                        ))}
                        {list.length > 4 && <span className="text-[9px] text-muted-foreground">+{list.length - 4}</span>}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Panel hari terpilih */}
          <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
            <h3 className="font-display text-base tracking-tight">{prettyDate(selected)}</h3>
            <div className="mt-3 space-y-2">
              {selectedRows.length === 0 && (
                <p className="rounded-lg border border-dashed border-border bg-muted/40 px-3 py-6 text-center text-sm text-muted-foreground">
                  Belum ada jadwal di tanggal ini.
                </p>
              )}
              {selectedRows.map((r) => (
                <PostItem key={r.id} row={r} pending={pending} act={act} />
              ))}
            </div>
          </div>
        </div>
      ) : (
        <ChecklistTable checklist={checklist} />
      )}
    </div>
  );
}

function PostItem({
  row, pending, act,
}: {
  row: ScheduleRow;
  pending: boolean;
  act: (fn: () => Promise<{ ok: boolean; error?: string }>, okMsg: string) => void;
}) {
  const posted = row.status === "posted";
  return (
    <div className="rounded-xl border border-border bg-background/60 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{row.title}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className={`h-2 w-2 rounded-full ${PLATFORM_DOT[row.platform]}`} />
            {PLATFORM_LABEL[row.platform]} · <span className="tnum">{timeWIB(row.scheduled_at)} WIB</span>
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${posted ? "bg-[#dff3d3] text-[#1d5128]" : "bg-muted text-muted-foreground"}`}>
          {posted ? "Diposting" : "Terjadwal"}
        </span>
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        {row.drive_url ? (
          <a href={row.drive_url} target="_blank" rel="noreferrer">
            <Button size="xs" variant="outline"><Download className="mr-1 h-3 w-3" /> Drive</Button>
          </a>
        ) : (
          <span className="text-[11px] text-muted-foreground/70">tanpa link Drive</span>
        )}
        <Button
          size="xs"
          variant={posted ? "ghost" : "default"}
          disabled={pending}
          onClick={() => act(() => togglePosted(row.id, !posted), posted ? "Dikembalikan ke terjadwal" : "Ditandai diposting")}
        >
          <Check className="mr-1 h-3 w-3" /> {posted ? "Batalkan" : "Tandai diposting"}
        </Button>
        <Button
          size="icon-xs"
          variant="ghost"
          disabled={pending}
          aria-label="Hapus"
          onClick={() => act(() => deleteSchedule(row.id), "Jadwal dihapus")}
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

function ChecklistTable({ checklist }: { checklist: ReturnType<typeof buildChecklist> }) {
  if (checklist.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/50 px-4 py-12 text-center text-sm text-muted-foreground">
        Belum ada konten yang dijadwalkan. Klik “Jadwalkan” untuk mulai.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-card">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-2.5">Konten</th>
            {PLATFORMS.map((p) => <th key={p} className="px-4 py-2.5 text-center">{PLATFORM_LABEL[p]}</th>)}
          </tr>
        </thead>
        <tbody>
          {checklist.map((c) => (
            <tr key={c.key} className="border-t border-border">
              <td className="px-4 py-2.5 font-medium">{c.title}</td>
              {PLATFORMS.map((p) => {
                const cell = c.cells[p];
                return (
                  <td key={p} className="px-4 py-2.5 text-center">
                    {!cell ? (
                      <span className="text-muted-foreground/40">—</span>
                    ) : cell.status === "posted" ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#dff3d3] px-2 py-0.5 text-xs font-medium text-[#1d5128]">
                        <Check className="h-3 w-3" /> <span className="tnum">{cell.date.slice(8)}/{cell.date.slice(5, 7)}</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                        <span className="h-1.5 w-1.5 rounded-full border border-current" /> <span className="tnum">{cell.date.slice(8)}/{cell.date.slice(5, 7)}</span>
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ScheduleForm({
  videoOptions, bankOptions, defaultDate, onClose, onDone,
}: {
  videoOptions: VideoOption[];
  bankOptions: BankOption[];
  defaultDate: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState(createSchedule, null);
  const [source, setSource] = useState<"video" | "bank_konten" | "manual">("manual");
  const [title, setTitle] = useState("");
  const [driveUrl, setDriveUrl] = useState("");

  useEffect(() => {
    if (state?.ok) { toast.success("Jadwal ditambahkan"); onDone(); }
  }, [state, onDone]);

  function pickVideo(id: string) {
    const v = videoOptions.find((o) => o.id === id);
    if (v) { setTitle(v.judul); if (v.link_source) setDriveUrl(v.link_source); }
  }
  function pickBank(idx: string) {
    const b = bankOptions[Number(idx)];
    if (b) { setTitle(b.title); setDriveUrl(b.link ?? ""); }
  }

  const selCls = "h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none";

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-card sm:p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-base tracking-tight">Jadwalkan posting</h3>
        <Button size="icon-xs" variant="ghost" onClick={onClose} aria-label="Tutup"><X className="h-4 w-4" /></Button>
      </div>
      <form action={action} className="grid gap-3 sm:grid-cols-2">
        <input type="hidden" name="source_type" value={source} />

        <div className="space-y-1">
          <Label>Sumber konten</Label>
          <select
            className={selCls}
            value={source}
            onChange={(e) => { setSource(e.target.value as typeof source); setTitle(""); setDriveUrl(""); }}
          >
            <option value="manual">Manual (ketik sendiri)</option>
            <option value="video">Video Final</option>
            <option value="bank_konten">Bank Konten</option>
          </select>
        </div>

        {source === "video" && (
          <div className="space-y-1">
            <Label htmlFor="video_id">Pilih video</Label>
            <select id="video_id" name="video_id" className={selCls} onChange={(e) => pickVideo(e.target.value)} defaultValue="">
              <option value="" disabled>— pilih —</option>
              {videoOptions.map((v) => <option key={v.id} value={v.id}>{v.judul}</option>)}
            </select>
          </div>
        )}
        {source === "bank_konten" && (
          <div className="space-y-1">
            <Label>Pilih dari Bank Konten</Label>
            <select className={selCls} onChange={(e) => pickBank(e.target.value)} defaultValue="">
              <option value="" disabled>— pilih —</option>
              {bankOptions.map((b, i) => <option key={i} value={i}>{b.title}</option>)}
            </select>
          </div>
        )}

        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="title">Judul konten</Label>
          <Input id="title" name="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="mis. Podcast Eps 5 — highlight" />
          {state?.errors?.title && <p className="text-xs text-destructive">{state.errors.title}</p>}
        </div>

        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="drive_url">Link Google Drive (untuk download)</Label>
          <Input id="drive_url" name="drive_url" value={driveUrl} onChange={(e) => setDriveUrl(e.target.value)} placeholder="https://drive.google.com/…" />
        </div>

        <div className="space-y-1">
          <Label htmlFor="platform">Platform</Label>
          <select id="platform" name="platform" className={selCls} defaultValue="">
            <option value="" disabled>— pilih —</option>
            {PLATFORMS.map((p) => <option key={p} value={p}>{PLATFORM_LABEL[p]}</option>)}
          </select>
          {state?.errors?.platform && <p className="text-xs text-destructive">{state.errors.platform}</p>}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label htmlFor="date">Tanggal</Label>
            <Input id="date" name="date" type="date" defaultValue={defaultDate} />
            {state?.errors?.date && <p className="text-xs text-destructive">{state.errors.date}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="time">Jam (WIB)</Label>
            <Input id="time" name="time" type="time" defaultValue="19:00" />
            {state?.errors?.time && <p className="text-xs text-destructive">{state.errors.time}</p>}
          </div>
        </div>

        {state?.errors?.general && <p className="text-xs text-destructive sm:col-span-2">{state.errors.general}</p>}

        <div className="flex gap-2 sm:col-span-2">
          <Button type="submit" disabled={pending}>{pending ? "Menyimpan…" : "Simpan jadwal"}</Button>
          <Button type="button" variant="ghost" onClick={onClose}>Batal</Button>
        </div>
      </form>
    </div>
  );
}
