"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { addComment } from "../actions";
import { Button } from "@/components/ui/button";
import { SectionTitle } from "@/components/ui-kit";
import { linkifyText } from "@/lib/linkify";

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
    <div className="space-y-4">
      <SectionTitle>Komentar &amp; Catatan</SectionTitle>

      <div className="space-y-2">
        {comments.map((c) => (
          <motion.div
            key={c.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-lg border border-border bg-card/60 p-3"
          >
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-medium text-foreground">{c.nama}</span>
              <span className="text-xs text-muted-foreground">
                {new Date(c.created_at).toLocaleString("id-ID")}
              </span>
            </div>
            <p className="text-sm whitespace-pre-wrap break-words text-foreground/80">{linkifyText(c.isi)}</p>
          </motion.div>
        ))}
        {comments.length === 0 && (
          <p className="text-sm text-muted-foreground">Belum ada komentar.</p>
        )}
      </div>

      <div className="flex gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          className="flex-1 rounded-lg border border-border bg-background p-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand/50 transition"
          placeholder="Tulis catatan revisi / komentar..."
        />
        <Button disabled={pending} onClick={submit}>Kirim</Button>
      </div>
    </div>
  );
}
