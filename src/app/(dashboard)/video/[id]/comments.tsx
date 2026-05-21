"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { addComment } from "../actions";
import { Button } from "@/components/ui/button";

type C = { id: string; isi: string; created_at: string; nama: string };

export function Comments({ videoId, comments }: { videoId: string; comments: C[] }) {
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();

  function submit() {
    if (!text.trim()) return;
    start(async () => {
      const res = await addComment(videoId, text);
      if (!res.ok) { toast.error(res.error ?? "Gagal kirim komentar"); return; }
      setText(""); router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <h3 className="font-medium">Komentar & Catatan</h3>
      <div className="space-y-2">
        {comments.map((c) => (
          <motion.div key={c.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="rounded-md border p-2 text-sm">
            <div className="mb-0.5 flex justify-between text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{c.nama}</span>
              <span>{new Date(c.created_at).toLocaleString("id-ID")}</span>
            </div>
            <p className="whitespace-pre-wrap">{c.isi}</p>
          </motion.div>
        ))}
        {comments.length === 0 && <p className="text-sm text-muted-foreground">Belum ada komentar.</p>}
      </div>
      <div className="flex gap-2">
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2}
          className="flex-1 rounded-md border p-2 text-sm" placeholder="Tulis catatan revisi / komentar..." />
        <Button disabled={pending} onClick={submit}>Kirim</Button>
      </div>
    </div>
  );
}
