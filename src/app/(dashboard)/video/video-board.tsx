"use client";

import Link from "next/link";
import { useState } from "react";
import { motion } from "framer-motion";
import { STATUS_ORDER, STATUS_LABEL, TYPE_LABEL, typeLabel, type VideoStatus, type VideoType } from "@/lib/video-workflow";

type Card = {
  id: string; judul: string; tipe: VideoType; tipe_custom: string | null;
  status: VideoStatus; editorNama: string | null;
};

export function VideoBoard({ cards }: { cards: Card[] }) {
  const [tipe, setTipe] = useState<VideoType | "all">("all");
  const filtered = tipe === "all" ? cards : cards.filter((c) => c.tipe === tipe);

  return (
    <div className="space-y-4">
      {/* Filter chips */}
      <div className="flex flex-wrap gap-2">
        {(["all", "monolog", "podcast", "shorts", "clipping", "lainnya"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTipe(t)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              tipe === t
                ? "bg-brand text-brand-foreground"
                : "border border-border text-muted-foreground hover:bg-accent"
            }`}
          >
            {t === "all" ? "Semua" : TYPE_LABEL[t]}
          </button>
        ))}
      </div>

      {/* Kanban columns */}
      <div className="flex gap-3 overflow-x-auto pb-4">
        {STATUS_ORDER.map((status) => {
          const items = filtered.filter((c) => c.status === status);
          return (
            <div key={status} className="w-64 shrink-0">
              {/* Column header */}
              <div className="mb-2 flex items-center gap-2 px-1">
                <span className="text-xs font-medium text-foreground/70">{STATUS_LABEL[status]}</span>
                <span className="tnum rounded-full bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                  {items.length}
                </span>
              </div>

              {/* Cards */}
              <div className="space-y-2">
                {items.map((c) => (
                  <motion.div
                    key={c.id}
                    layout
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <Link
                      href={`/video/${c.id}`}
                      className="block rounded-xl border border-border bg-card p-3 shadow-card transition hover:shadow-soft hover:-translate-y-0.5"
                    >
                      <p className="text-sm font-medium text-foreground">{c.judul}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {typeLabel(c)}{c.editorNama ? ` · ${c.editorNama}` : ""}
                      </p>
                    </Link>
                  </motion.div>
                ))}

                {/* Empty placeholder */}
                {items.length === 0 && (
                  <div className="rounded-xl border border-dashed border-border/60 px-3 py-4 text-center">
                    <p className="text-xs text-muted-foreground/50">—</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
