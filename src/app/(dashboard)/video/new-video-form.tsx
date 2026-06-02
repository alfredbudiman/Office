"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { createVideo } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type EditorOpt = { id: string; nama: string };
type VideoOpt = { id: string; judul: string };

type ActionState = { ok: boolean; errors: Record<string, string>; id?: string } | null;

export function NewVideoForm({ editors, parents }: { editors: EditorOpt[]; parents: VideoOpt[] }) {
  const [open, setOpen] = useState(false);
  const [tipe, setTipe] = useState("monolog");
  const [tipeCustom, setTipeCustom] = useState("");
  const [state, action, pending] = useActionState(createVideo, null as ActionState);
  const router = useRouter();
  const errors = (state?.errors ?? {}) as Record<string, string>;

  useEffect(() => {
    if (state?.ok) { setOpen(false); router.refresh(); }
  }, [state, router]);

  if (!open) return <Button onClick={() => setOpen(true)}>+ Video baru</Button>;

  return (
    <AnimatePresence>
      <motion.form
        action={action}
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: "auto" }}
        className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2"
      >
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="judul">Judul</Label>
          <Input id="judul" name="judul" />
          {errors.judul && <p className="text-xs text-red-500">{errors.judul}</p>}
        </div>
        <div className="space-y-1">
          <Label htmlFor="tipe">Tipe</Label>
          <select id="tipe" name="tipe" value={tipe} onChange={(e) => setTipe(e.target.value)}
            className="h-9 w-full rounded-md border px-2 text-sm">
            <option value="monolog">Monolog</option>
            <option value="podcast">Podcast</option>
            <option value="shorts">Shorts</option>
            <option value="clipping">Clipping</option>
            <option value="lainnya">Lainnya</option>
          </select>
        </div>
        {tipe === "lainnya" && (
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="tipe_custom">Nama tipe</Label>
            <Input
              id="tipe_custom"
              name="tipe_custom"
              value={tipeCustom}
              onChange={(e) => setTipeCustom(e.target.value)}
              placeholder="mis. Behind the scenes, Tutorial, dll"
              maxLength={50}
            />
            {errors.tipe_custom && <p className="text-xs text-red-500">{errors.tipe_custom}</p>}
          </div>
        )}
        <div className="space-y-1">
          <Label htmlFor="editor_id">Editor</Label>
          <select
            id="editor_id"
            name="editor_id"
            defaultValue={editors[0]?.id ?? ""}
            className="h-9 w-full rounded-md border px-2 text-sm"
          >
            {editors.map((e) => <option key={e.id} value={e.id}>{e.nama}</option>)}
            <option value="">— belum ditugaskan —</option>
          </select>
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="link_source">Link source</Label>
          <Input id="link_source" name="link_source" placeholder="https://..." />
          {errors.link_source && <p className="text-xs text-red-500">{errors.link_source}</p>}
        </div>
        {tipe === "clipping" && (
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="parent_video_id">Video induk (untuk clipping)</Label>
            <select id="parent_video_id" name="parent_video_id" className="h-9 w-full rounded-md border px-2 text-sm">
              <option value="">— pilih —</option>
              {parents.map((p) => <option key={p.id} value={p.id}>{p.judul}</option>)}
            </select>
            {errors.parent_video_id && <p className="text-xs text-red-500">{errors.parent_video_id}</p>}
          </div>
        )}
        <div className="flex gap-2 sm:col-span-2">
          <Button type="submit" disabled={pending}>{pending ? "Menyimpan..." : "Simpan"}</Button>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Batal</Button>
        </div>
      </motion.form>
    </AnimatePresence>
  );
}
