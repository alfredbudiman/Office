"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, LayoutGrid, Plus, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PlatformIcon } from "@/components/platform-icon";
import { wibDate, wibToday } from "@/lib/wib";
import {
  PLATFORMS, PLATFORM_LABEL, buildChecklist, scheduleProgress, groupByContent, scheduledContentKeys, contentKey,
  type ScheduleRow, type ContentPrep,
} from "@/lib/post-schedule";
import { ScheduleForm } from "./schedule-form";
import { ContentEditor } from "./content-editor";
import type { VideoOption } from "@/lib/post-schedule-data";

const WD = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

function pad(n: number) { return String(n).padStart(2, "0"); }
function timeWIB(iso: string) { return new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }); }
function prettyDate(ymd: string) { const [y, m, d] = ymd.split("-").map(Number); return `${d} ${MONTHS[m - 1]} ${y}`; }

type BankOption = { title: string; link: string | null };

export function SchedulerView({
  rows, videoOptions, bankOptions, postedKeys, prep, initialVideoId,
}: {
  rows: ScheduleRow[];
  videoOptions: VideoOption[];
  bankOptions: BankOption[];
  postedKeys: string[];
  prep: ContentPrep[];
  initialVideoId?: string;
}) {
  const router = useRouter();
  const [view, setView] = useState<"calendar" | "checklist">("calendar");
  const [formOpen, setFormOpen] = useState(!!initialVideoId);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const today = wibToday();
  const [cursor, setCursor] = useState(() => { const [y, m] = today.split("-").map(Number); return { y, m: m - 1 }; });
  const [selected, setSelected] = useState<string>(today);

  const byDate = useMemo(() => {
    const map = new Map<string, ScheduleRow[]>();
    for (const r of rows) { const k = wibDate(new Date(r.scheduled_at)); (map.get(k) ?? map.set(k, []).get(k)!).push(r); }
    for (const list of map.values()) list.sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
    return map;
  }, [rows]);

  const groups = useMemo(() => groupByContent(rows), [rows]);
  const prepMap = useMemo(() => new Map(prep.map((p) => [p.content_key, p])), [prep]);
  const progress = useMemo(() => scheduleProgress(rows), [rows]);
  const checklist = useMemo(() => buildChecklist(rows), [rows]);

  // dropdown sumber: sembunyikan konten yang sudah terjadwal ATAU ditandai sudah diposting
  const excluded = useMemo(() => {
    const s = scheduledContentKeys(rows);
    for (const k of postedKeys) s.add(k);
    return s;
  }, [rows, postedKeys]);
  const availVideos = videoOptions.filter((v) => !excluded.has(`v:${v.id}`));
  const availBank = bankOptions.filter((b) => !excluded.has(`t:${b.title.trim().toLowerCase()}`));

  const selectedRows = byDate.get(selected) ?? [];
  const openGroup = openKey ? groups.find((g) => g.key === openKey) ?? null : null;

  const monthCells = useMemo(() => {
    const first = new Date(Date.UTC(cursor.y, cursor.m, 1));
    const startOffset = (first.getUTCDay() + 6) % 7;
    const days = new Date(Date.UTC(cursor.y, cursor.m + 1, 0)).getUTCDate();
    const cells: (string | null)[] = [];
    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let d = 1; d <= days; d++) cells.push(`${cursor.y}-${pad(cursor.m + 1)}-${pad(d)}`);
    return cells;
  }, [cursor]);
  function shiftMonth(delta: number) { setCursor((c) => { const m = c.m + delta; return { y: c.y + Math.floor(m / 12), m: ((m % 12) + 12) % 12 }; }); }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-border bg-card p-0.5">
            <button onClick={() => setView("calendar")} className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${view === "calendar" ? "bg-brand-muted text-[#1d5128]" : "text-muted-foreground hover:text-foreground"}`}><CalendarDays className="h-4 w-4" /> Kalender</button>
            <button onClick={() => setView("checklist")} className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${view === "checklist" ? "bg-brand-muted text-[#1d5128]" : "text-muted-foreground hover:text-foreground"}`}><LayoutGrid className="h-4 w-4" /> Checklist</button>
          </div>
          <span className="text-sm text-muted-foreground"><span className="font-semibold text-foreground">{progress.posted}</span>/{progress.total} diposting</span>
        </div>
        <Button onClick={() => setFormOpen(true)}><Plus className="mr-1.5 h-4 w-4" /> Jadwalkan</Button>
      </div>

      {formOpen && (
        <ScheduleForm videoOptions={availVideos} bankOptions={availBank} defaultDate={selected} initialVideoId={initialVideoId} onClose={() => setFormOpen(false)} onDone={() => { setFormOpen(false); router.refresh(); }} />
      )}

      {view === "calendar" ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
          <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-lg tracking-tight">{MONTHS[cursor.m]} {cursor.y}</h2>
              <div className="flex gap-1">
                <Button size="icon-sm" variant="ghost" onClick={() => shiftMonth(-1)}><ChevronLeft className="h-4 w-4" /></Button>
                <Button size="icon-sm" variant="ghost" onClick={() => shiftMonth(1)}><ChevronRight className="h-4 w-4" /></Button>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center">
              {WD.map((w) => <div key={w} className="font-mono py-1 text-[10px] uppercase tracking-wider text-muted-foreground">{w}</div>)}
              {monthCells.map((ymd, i) => {
                if (!ymd) return <div key={`b${i}`} />;
                const list = byDate.get(ymd) ?? [];
                const isSel = ymd === selected, isToday = ymd === today;
                return (
                  <button key={ymd} onClick={() => setSelected(ymd)} className={`flex min-h-[58px] flex-col rounded-lg border p-1.5 text-left transition-colors ${isSel ? "border-brand bg-brand-muted/60" : "border-transparent hover:bg-accent"}`}>
                    <span className={`tnum text-xs ${isToday ? "font-bold text-brand" : "text-foreground/70"}`}>{Number(ymd.slice(8))}</span>
                    {list.length > 0 && (
                      <span className="mt-auto flex flex-wrap items-center gap-0.5">
                        {list.slice(0, 4).map((r) => <span key={r.id} className={r.status === "posted" ? "" : "opacity-45"}><PlatformIcon platform={r.platform} size={13} /></span>)}
                        {list.length > 4 && <span className="text-[9px] text-muted-foreground">+{list.length - 4}</span>}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
            <h3 className="font-display text-base tracking-tight">{prettyDate(selected)}</h3>
            <div className="mt-3 space-y-2">
              {selectedRows.length === 0 && <p className="rounded-lg border border-dashed border-border bg-muted/40 px-3 py-6 text-center text-sm text-muted-foreground">Belum ada jadwal di tanggal ini.</p>}
              {selectedRows.map((r) => {
                const posted = r.status === "posted";
                return (
                  <button key={r.id} onClick={() => setOpenKey(contentKey(r))} className="flex w-full items-center gap-2 rounded-xl border border-border bg-background/60 p-2.5 text-left transition-colors hover:bg-accent/50">
                    <PlatformIcon platform={r.platform} size={20} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{r.title}</span>
                      <span className="tnum text-xs text-muted-foreground">{PLATFORM_LABEL[r.platform]} · {timeWIB(r.scheduled_at)} WIB</span>
                    </span>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${posted ? "bg-[#dff3d3] text-[#1d5128]" : "bg-muted text-muted-foreground"}`}>{posted ? "Diposting" : "Terjadwal"}</span>
                    {r.drive_url && (
                      <a href={r.drive_url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} aria-label="Download Drive" className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"><Download className="h-4 w-4" /></a>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <ChecklistTable checklist={checklist} onOpen={setOpenKey} groups={groups} />
      )}

      {openGroup && <ContentEditor group={openGroup} prep={prepMap.get(openGroup.key)} onClose={() => setOpenKey(null)} onChanged={() => router.refresh()} />}
    </div>
  );
}

function ChecklistTable({
  checklist, onOpen, groups,
}: {
  checklist: ReturnType<typeof buildChecklist>;
  onOpen: (key: string) => void;
  groups: ReturnType<typeof groupByContent>;
}) {
  if (checklist.length === 0) {
    return <div className="rounded-2xl border border-dashed border-border bg-card/50 px-4 py-12 text-center text-sm text-muted-foreground">Belum ada konten yang dijadwalkan. Klik “Jadwalkan” untuk mulai.</div>;
  }
  const keyByTitle = new Map(groups.map((g) => [g.title, g.key]));
  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-card">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-2.5">Konten</th>
            {PLATFORMS.map((p) => <th key={p} className="px-3 py-2.5 text-center"><span className="inline-flex flex-col items-center gap-1"><PlatformIcon platform={p} size={18} /><span className="text-[10px] normal-case">{PLATFORM_LABEL[p]}</span></span></th>)}
          </tr>
        </thead>
        <tbody>
          {checklist.map((c) => (
            <tr key={c.key} className="cursor-pointer border-t border-border hover:bg-accent/40" onClick={() => onOpen(keyByTitle.get(c.title) ?? c.key)}>
              <td className="px-4 py-2.5 font-medium">{c.title}</td>
              {PLATFORMS.map((p) => {
                const cell = c.cells[p];
                return (
                  <td key={p} className="px-3 py-2.5 text-center">
                    {!cell ? <span className="text-muted-foreground/40">—</span>
                      : cell.status === "posted"
                        ? <span className="inline-flex items-center gap-1 rounded-full bg-[#dff3d3] px-2 py-0.5 text-xs font-medium text-[#1d5128]">✓ <span className="tnum">{cell.date.slice(8)}/{cell.date.slice(5, 7)}</span></span>
                        : <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">○ <span className="tnum">{cell.date.slice(8)}/{cell.date.slice(5, 7)}</span></span>}
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
