"use client";

import Link from "next/link";
import { useState } from "react";
import { motion } from "framer-motion";
import { STATUS_ORDER, STATUS_LABEL, TYPE_LABEL, type VideoStatus, type VideoType } from "@/lib/video-workflow";

type Card = { id: string; judul: string; tipe: VideoType; status: VideoStatus; editorNama: string | null };

export function VideoBoard({ cards }: { cards: Card[] }) {
  const [tipe, setTipe] = useState<VideoType | "all">("all");
  const filtered = tipe === "all" ? cards : cards.filter((c) => c.tipe === tipe);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {(["all", "monolog", "podcast", "shorts", "clipping"] as const).map((t) => (
          <button key={t} onClick={() => setTipe(t)}
            className={`rounded-full border px-3 py-1 text-xs ${tipe === t ? "bg-foreground text-background" : "text-muted-foreground"}`}>
            {t === "all" ? "Semua" : TYPE_LABEL[t]}
          </button>
        ))}
      </div>
      <div className="flex gap-3 overflow-x-auto pb-4">
        {STATUS_ORDER.map((status) => {
          const items = filtered.filter((c) => c.status === status);
          return (
            <div key={status} className="w-64 shrink-0">
              <div className="mb-2 flex items-center justify-between px-1">
                <span className="text-sm font-medium">{STATUS_LABEL[status]}</span>
                <span className="text-xs text-muted-foreground">{items.length}</span>
              </div>
              <div className="space-y-2">
                {items.map((c) => (
                  <motion.div key={c.id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                    <Link href={`/video/${c.id}`}
                      className="block rounded-lg border bg-card p-3 text-sm shadow-sm transition hover:shadow">
                      <p className="font-medium">{c.judul}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {TYPE_LABEL[c.tipe]}{c.editorNama ? ` · ${c.editorNama}` : ""}
                      </p>
                    </Link>
                  </motion.div>
                ))}
                {items.length === 0 && <p className="px-1 text-xs text-muted-foreground/60">—</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
