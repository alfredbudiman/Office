"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
    <form onSubmit={submit} className="flex flex-wrap items-end gap-3 rounded-lg border p-4">
      <div className="space-y-1">
        <Label htmlFor="from">Dari</Label>
        <Input id="from" name="from" type="date" defaultValue={from} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="to">Sampai</Label>
        <Input id="to" name="to" type="date" defaultValue={to} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="editor">Editor</Label>
        <select id="editor" name="editor" defaultValue={params.get("editor") ?? ""}
          className="h-9 rounded-md border px-2 text-sm">
          <option value="">Semua</option>
          {editors.map((e) => <option key={e.id} value={e.id}>{e.nama}</option>)}
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="tipe">Tipe</Label>
        <select id="tipe" name="tipe" defaultValue={params.get("tipe") ?? ""}
          className="h-9 rounded-md border px-2 text-sm">
          <option value="">Semua</option>
          <option value="monolog">Monolog</option>
          <option value="podcast">Podcast</option>
          <option value="shorts">Shorts</option>
          <option value="clipping">Clipping</option>
        </select>
      </div>
      <Button type="submit">Terapkan</Button>
      <a href={exportHref} className="inline-flex h-9 items-center rounded-md border px-3 text-sm">Export CSV</a>
    </form>
  );
}
