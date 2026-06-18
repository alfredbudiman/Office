"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PlatformIcon } from "@/components/platform-icon";
import { PLATFORMS, PLATFORM_LABEL, type Platform } from "@/lib/post-schedule";
import { createSchedule } from "./actions";
import type { VideoOption } from "@/lib/post-schedule-data";

type BankOption = { title: string; link: string | null; jenis: string };
type PfState = Record<Platform, { on: boolean; date: string; time: string }>;

const selCls =
  "h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function ScheduleForm({
  videoOptions, bankOptions, defaultDate, initialVideoId, onClose, onDone,
}: {
  videoOptions: VideoOption[];
  bankOptions: BankOption[];
  defaultDate: string;
  initialVideoId?: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState(createSchedule, null);
  const initialVideo = initialVideoId ? videoOptions.find((v) => v.id === initialVideoId) : undefined;
  const [source, setSource] = useState<"manual" | "video" | "bank_konten">(initialVideo ? "video" : bankOptions.length ? "bank_konten" : "manual");
  // Bank Konten: yang sudah ada link dikelompokkan per jenis di atas; yang belum ada link
  // (belum beres) ditaruh satu grup di bawah. Index asli dipertahankan untuk memilih.
  const bankGroups = (() => {
    const ready = new Map<string, { idx: number; title: string }[]>();
    const notReady: { idx: number; title: string }[] = [];
    bankOptions.forEach((b, i) => {
      if (b.link) (ready.get(b.jenis) ?? ready.set(b.jenis, []).get(b.jenis)!).push({ idx: i, title: b.title });
      else notReady.push({ idx: i, title: `${b.jenis} · ${b.title}` });
    });
    const groups = [...ready.entries()].map(([label, items]) => ({ label, items }));
    if (notReady.length) groups.push({ label: "⚠ Belum ada link (belum beres)", items: notReady });
    return groups;
  })();
  const [title, setTitle] = useState(initialVideo?.judul ?? "");
  const [driveUrl, setDriveUrl] = useState(initialVideo?.link_source ?? "");
  const [defTime, setDefTime] = useState("19:00");
  const [pf, setPf] = useState<PfState>(() =>
    Object.fromEntries(PLATFORMS.map((p) => [p, { on: false, date: defaultDate, time: "19:00" }])) as PfState,
  );

  useEffect(() => {
    if (state?.ok) { toast.success("Jadwal ditambahkan"); onDone(); }
  }, [state, onDone]);

  function togglePf(p: Platform) {
    setPf((s) => ({ ...s, [p]: { ...s[p], on: !s[p].on, date: s[p].date || defaultDate, time: s[p].time || defTime } }));
  }
  function setPfField(p: Platform, field: "date" | "time", v: string) {
    setPf((s) => ({ ...s, [p]: { ...s[p], [field]: v } }));
  }
  function applyDefaultToAll() {
    setPf((s) => Object.fromEntries(PLATFORMS.map((p) => [p, { ...s[p], date: defaultDate, time: defTime }])) as PfState);
  }
  function pickVideo(id: string) {
    const v = videoOptions.find((o) => o.id === id);
    if (v) { setTitle(v.judul); if (v.link_source) setDriveUrl(v.link_source); }
  }
  function pickBank(idx: string) {
    const b = bankOptions[Number(idx)];
    if (b) { setTitle(b.title); setDriveUrl(b.link ?? ""); }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-card sm:p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-base tracking-tight">Jadwalkan posting</h3>
        <Button size="icon-xs" variant="ghost" onClick={onClose} aria-label="Tutup"><X className="h-4 w-4" /></Button>
      </div>

      <form action={action} className="space-y-4">
        <input type="hidden" name="source_type" value={source} />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>Sumber konten</Label>
            <select className={selCls} value={source} onChange={(e) => { setSource(e.target.value as typeof source); setTitle(""); setDriveUrl(""); }}>
              <option value="manual">Manual (ketik sendiri)</option>
              <option value="video">Video Final ({videoOptions.length})</option>
              <option value="bank_konten">Bank Konten ({bankOptions.length})</option>
            </select>
          </div>
          {source === "video" && (
            <div className="space-y-1">
              <Label htmlFor="video_id">Pilih video</Label>
              <select id="video_id" name="video_id" className={selCls} defaultValue={initialVideoId ?? ""} onChange={(e) => pickVideo(e.target.value)}>
                <option value="" disabled>— pilih —</option>
                {videoOptions.map((v) => <option key={v.id} value={v.id}>{v.judul}</option>)}
              </select>
            </div>
          )}
          {source === "bank_konten" && (
            <div className="space-y-1">
              <Label>Pilih dari Bank Konten</Label>
              <select className={selCls} defaultValue="" onChange={(e) => pickBank(e.target.value)}>
                <option value="" disabled>— pilih —</option>
                {bankGroups.map((g) => (
                  <optgroup key={g.label} label={g.label}>
                    {g.items.map((it) => <option key={it.idx} value={it.idx}>{it.title}</option>)}
                  </optgroup>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="space-y-1">
          <Label htmlFor="title">Judul konten</Label>
          <Input id="title" name="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="mis. Podcast Eps 5 — highlight" />
          {state?.errors?.title && <p className="text-xs text-destructive">{state.errors.title}</p>}
        </div>
        <div className="space-y-1">
          <Label htmlFor="drive_url">Link Google Drive (untuk download)</Label>
          <Input id="drive_url" name="drive_url" value={driveUrl} onChange={(e) => setDriveUrl(e.target.value)} placeholder="https://drive.google.com/…" />
        </div>

        {/* Default tanggal/jam + terapkan ke semua */}
        <div className="rounded-xl border border-border bg-muted/30 p-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label htmlFor="def-date">Tanggal default</Label>
              <Input id="def-date" type="date" value={pf[PLATFORMS[0]].date} onChange={(e) => PLATFORMS.forEach((p) => setPfField(p, "date", e.target.value))} className="w-auto" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="def-time">Jam default (WIB)</Label>
              <Input id="def-time" type="time" value={defTime} onChange={(e) => setDefTime(e.target.value)} className="w-auto" />
            </div>
            <Button type="button" size="sm" variant="secondary" onClick={applyDefaultToAll}>Terapkan ke semua</Button>
          </div>

          <p className="mt-3 mb-1.5 text-xs font-medium text-muted-foreground">Platform (centang yang mau dijadwalkan):</p>
          <div className="space-y-2">
            {PLATFORMS.map((p) => (
              <div key={p} className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-2">
                <label className="flex min-w-[8.5rem] items-center gap-2 text-sm font-medium">
                  <input type="checkbox" name={pf[p].on ? `pf_${p}` : undefined} checked={pf[p].on} onChange={() => togglePf(p)} className="h-4 w-4 accent-[#2d7d3a]" />
                  <PlatformIcon platform={p} size={18} /> {PLATFORM_LABEL[p]}
                </label>
                {pf[p].on && (
                  <div className="flex flex-1 flex-wrap gap-2">
                    <Input type="date" name={`date_${p}`} value={pf[p].date} onChange={(e) => setPfField(p, "date", e.target.value)} className="w-auto" />
                    <Input type="time" name={`time_${p}`} value={pf[p].time} onChange={(e) => setPfField(p, "time", e.target.value)} className="w-auto" />
                  </div>
                )}
              </div>
            ))}
          </div>
          {state?.errors?.platform && <p className="mt-2 text-xs text-destructive">{state.errors.platform}</p>}
        </div>

        {state?.errors?.general && <p className="text-xs text-destructive">{state.errors.general}</p>}

        <div className="flex gap-2">
          <Button type="submit" disabled={pending}>{pending ? "Menyimpan…" : "Simpan jadwal"}</Button>
          <Button type="button" variant="ghost" onClick={onClose}>Batal</Button>
        </div>
      </form>
    </div>
  );
}
