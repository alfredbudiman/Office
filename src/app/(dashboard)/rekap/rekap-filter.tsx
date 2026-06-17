"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Filter, Download } from "lucide-react";

type EditorOpt = { id: string; nama: string };

export function RekapFilter({ editors, from, to }: { editors: EditorOpt[]; from: string; to: string }) {
  const router = useRouter();
  const params = useSearchParams();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const sp = new URLSearchParams();
    sp.set("from", String(fd.get("from")));
    sp.set("to", String(fd.get("to")));
    const editor = String(fd.get("editor") ?? "");
    const tipe = String(fd.get("tipe") ?? "");
    if (editor) sp.set("editor", editor);
    if (tipe) sp.set("tipe", tipe);
    router.push(`/rekap?${sp.toString()}`);
  }

  const exportHref = `/rekap/export?${params.toString()}`;

  return (
    <form onSubmit={submit} className="rounded-xl border border-border bg-card p-4 shadow-card grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-end">
      <div className="space-y-1">
        <Label htmlFor="from">Dari</Label>
        <Input id="from" name="from" type="date" defaultValue={from} className="h-9 w-full rounded-lg sm:w-auto" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="to">Sampai</Label>
        <Input id="to" name="to" type="date" defaultValue={to} className="h-9 w-full rounded-lg sm:w-auto" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="editor">Editor</Label>
        <select id="editor" name="editor" defaultValue={params.get("editor") ?? ""}
          className="h-9 w-full rounded-lg border border-border bg-background px-2.5 text-sm sm:w-auto">
          <option value="">Semua</option>
          {editors.map((e) => <option key={e.id} value={e.id}>{e.nama}</option>)}
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="tipe">Tipe</Label>
        <select id="tipe" name="tipe" defaultValue={params.get("tipe") ?? ""}
          className="h-9 w-full rounded-lg border border-border bg-background px-2.5 text-sm sm:w-auto">
          <option value="">Semua</option>
          <option value="monolog">Monolog</option>
          <option value="podcast">Podcast</option>
          <option value="shorts">Shorts</option>
          <option value="clipping">Clipping</option>
        </select>
      </div>
      <button type="submit" className="col-span-2 inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-foreground px-3 text-sm font-medium text-background hover:opacity-90 transition-opacity sm:col-span-1 sm:justify-start">
        <Filter size={14} />
        Terapkan
      </button>
      <a href={exportHref} className="col-span-2 inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-border px-3 text-sm hover:bg-accent transition-colors sm:col-span-1 sm:justify-start">
        <Download size={14} />
        Export CSV
      </a>
    </form>
  );
}
