"use client";

import { useState, useTransition, useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { X, Download, Check, Trash2, Pencil, Copy, Plus, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PlatformIcon } from "@/components/platform-icon";
import { PLATFORMS, PLATFORM_LABEL, type Platform, type ContentGroup, type ContentPrep } from "@/lib/post-schedule";
import { createSchedule, updateSchedule, togglePosted, deleteSchedule, saveContentPrep, uploadThumbnail } from "./actions";

function wibDateOf(iso: string) {
  return new Date(new Date(iso).getTime() + 7 * 3600000).toISOString().slice(0, 10);
}
function wibTimeOf(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });
}
function pretty(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", timeZone: "Asia/Jakarta" }) + " " + wibTimeOf(iso) + " WIB";
}

export function ContentEditor({
  group, prep, onClose, onChanged,
}: {
  group: ContentGroup;
  prep: ContentPrep | undefined;
  onClose: () => void;
  onChanged: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editId, setEditId] = useState<string | null>(null);
  const [eDate, setEDate] = useState("");
  const [eTime, setETime] = useState("");

  const used = new Set(group.rows.map((r) => r.platform));
  const available = PLATFORMS.filter((p) => !used.has(p));
  const [addP, setAddP] = useState<Platform | "">("");
  const [addDate, setAddDate] = useState(group.rows[0] ? wibDateOf(group.rows[0].scheduled_at) : "");
  const [addTime, setAddTime] = useState("19:00");

  function refresh() { onChanged(); router.refresh(); }
  function act(fn: () => Promise<{ ok: boolean; error?: string }>, okMsg: string) {
    start(async () => {
      const res = await fn();
      if (!res.ok) { toast.error(res.error ?? "Gagal"); return; }
      toast.success(okMsg); refresh();
    });
  }

  function startEdit(id: string, iso: string) { setEditId(id); setEDate(wibDateOf(iso)); setETime(wibTimeOf(iso)); }
  function saveEdit(id: string) { act(() => updateSchedule(id, eDate, eTime), "Jadwal diperbarui"); setEditId(null); }

  function addPlatform() {
    if (!addP || !addDate || !addTime) { toast.error("Lengkapi platform, tanggal & jam"); return; }
    start(async () => {
      const fd = new FormData();
      fd.set("title", group.title);
      fd.set("source_type", group.source_type);
      if (group.video_id) fd.set("video_id", group.video_id);
      if (group.drive_url) fd.set("drive_url", group.drive_url);
      fd.set(`pf_${addP}`, "on");
      fd.set(`date_${addP}`, addDate);
      fd.set(`time_${addP}`, addTime);
      const res = await createSchedule(null, fd);
      if (!res.ok) { toast.error(res.errors?.general ?? "Gagal menambah platform"); return; }
      toast.success("Platform ditambahkan"); setAddP(""); refresh();
    });
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-foreground/40 backdrop-blur-sm p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-border bg-card p-4 shadow-pop sm:rounded-2xl sm:p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-2">
          <h3 className="font-display text-lg tracking-tight">{group.title}</h3>
          <Button size="icon-xs" variant="ghost" onClick={onClose} aria-label="Tutup"><X className="h-4 w-4" /></Button>
        </div>

        {/* Jadwal per platform */}
        <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">Jadwal</p>
        <div className="space-y-2">
          {group.rows.map((r) => {
            const posted = r.status === "posted";
            return (
              <div key={r.id} className="rounded-xl border border-border bg-background/60 p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-sm font-medium"><PlatformIcon platform={r.platform} size={18} /> {PLATFORM_LABEL[r.platform]}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${posted ? "bg-[#dff3d3] text-[#1d5128]" : "bg-muted text-muted-foreground"}`}>{posted ? "Diposting" : "Terjadwal"}</span>
                </div>
                {editId === r.id ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Input type="date" value={eDate} onChange={(e) => setEDate(e.target.value)} className="w-auto" />
                    <Input type="time" value={eTime} onChange={(e) => setETime(e.target.value)} className="w-auto" />
                    <Button size="xs" disabled={pending} onClick={() => saveEdit(r.id)}>Simpan</Button>
                    <Button size="xs" variant="ghost" onClick={() => setEditId(null)}>Batal</Button>
                  </div>
                ) : (
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <span className="tnum text-xs text-muted-foreground">{pretty(r.scheduled_at)}</span>
                    <div className="ml-auto flex items-center gap-1">
                      <Button size="icon-xs" variant="ghost" aria-label="Edit jam" disabled={pending} onClick={() => startEdit(r.id, r.scheduled_at)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button size="icon-xs" variant={posted ? "ghost" : "default"} aria-label="Tandai diposting" disabled={pending} onClick={() => act(() => togglePosted(r.id, !posted), posted ? "Dikembalikan" : "Ditandai diposting")}><Check className="h-3.5 w-3.5" /></Button>
                      <Button size="icon-xs" variant="ghost" aria-label="Hapus" disabled={pending} onClick={() => act(() => deleteSchedule(r.id), "Dihapus")} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Tambah platform */}
        {available.length > 0 && (
          <div className="mt-2.5 flex flex-wrap items-end gap-2 rounded-xl border border-dashed border-border p-2.5">
            <select value={addP} onChange={(e) => setAddP(e.target.value as Platform)} className="h-9 rounded-lg border border-input bg-transparent px-2 text-sm outline-none">
              <option value="">+ platform…</option>
              {available.map((p) => <option key={p} value={p}>{PLATFORM_LABEL[p]}</option>)}
            </select>
            <Input type="date" value={addDate} onChange={(e) => setAddDate(e.target.value)} className="w-auto" />
            <Input type="time" value={addTime} onChange={(e) => setAddTime(e.target.value)} className="w-auto" />
            <Button size="sm" variant="secondary" disabled={pending || !addP} onClick={addPlatform}><Plus className="mr-1 h-3.5 w-3.5" /> Tambah</Button>
          </div>
        )}

        {/* Persiapan materi */}
        <div className="mt-5 border-t border-border pt-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Persiapan materi</p>
          <ThumbnailUploader contentKey={group.key} url={prep?.thumbnail_url ?? null} onDone={refresh} />
          <PrepForm contentKey={group.key} description={prep?.description ?? ""} tags={prep?.tags ?? ""} onDone={refresh} />
        </div>
      </div>
    </div>
  );
}

function ThumbnailUploader({ contentKey, url, onDone }: { contentKey: string; url: string | null; onDone: () => void }) {
  const [state, action, pending] = useActionState(uploadThumbnail, null);
  useEffect(() => { if (state?.ok) { toast.success("Thumbnail diunggah"); onDone(); } else if (state && !state.ok) toast.error(state.error ?? "Gagal upload"); }, [state, onDone]);
  return (
    <div className="mb-3">
      <Label>Thumbnail</Label>
      <div className="mt-1 flex flex-wrap items-center gap-3">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="thumbnail" className="h-16 w-28 rounded-lg border border-border object-cover" />
        ) : (
          <div className="flex h-16 w-28 items-center justify-center rounded-lg border border-dashed border-border text-muted-foreground"><ImageIcon className="h-5 w-5" /></div>
        )}
        <form action={action} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="content_key" value={contentKey} />
          <input type="file" name="file" accept="image/*" className="max-w-[12rem] text-xs file:mr-2 file:rounded-md file:border-0 file:bg-secondary file:px-2 file:py-1 file:text-xs file:font-medium" />
          <Button size="sm" type="submit" variant="secondary" disabled={pending}>{pending ? "Mengunggah…" : "Upload"}</Button>
          {url && <a href={url} target="_blank" rel="noreferrer"><Button size="sm" type="button" variant="outline"><Download className="mr-1 h-3.5 w-3.5" /> Unduh</Button></a>}
        </form>
      </div>
    </div>
  );
}

function PrepForm({ contentKey, description, tags, onDone }: { contentKey: string; description: string; tags: string; onDone: () => void }) {
  const [state, action, pending] = useActionState(saveContentPrep, null);
  const [desc, setDesc] = useState(description);
  const [tg, setTg] = useState(tags);
  useEffect(() => { if (state?.ok) { toast.success("Materi disimpan"); onDone(); } }, [state, onDone]);
  function copy(text: string, label: string) {
    if (!text) { toast.error("Masih kosong"); return; }
    navigator.clipboard.writeText(text).then(() => toast.success(label + " disalin"));
  }
  const ta = "w-full rounded-lg border border-input bg-transparent p-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="content_key" value={contentKey} />
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <Label htmlFor="description">Description</Label>
          <Button size="xs" type="button" variant="ghost" onClick={() => copy(desc, "Description")}><Copy className="mr-1 h-3 w-3" /> Copy</Button>
        </div>
        <textarea id="description" name="description" rows={4} value={desc} onChange={(e) => setDesc(e.target.value)} className={ta} placeholder="Caption / deskripsi untuk diposting…" />
      </div>
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <Label htmlFor="tags">Tags / hashtag</Label>
          <Button size="xs" type="button" variant="ghost" onClick={() => copy(tg, "Tags")}><Copy className="mr-1 h-3 w-3" /> Copy</Button>
        </div>
        <textarea id="tags" name="tags" rows={2} value={tg} onChange={(e) => setTg(e.target.value)} className={ta} placeholder="#sprout #finansial …" />
      </div>
      <Button size="sm" type="submit" disabled={pending}>{pending ? "Menyimpan…" : "Simpan materi"}</Button>
    </form>
  );
}
