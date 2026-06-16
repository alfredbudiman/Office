"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  STAGES,
  daysInStage,
  isStale,
  isOverdue,
  type Candidate,
  type Stage,
} from "@/lib/recruitment";
import { Tag, fmtDT } from "./recruitment-ui";
import { moveStage } from "./actions";

export function KanbanBoard({
  candidates,
  staleDays,
  onOpen,
}: {
  candidates: Candidate[];
  staleDays: number;
  onOpen: (id: string) => void;
}) {
  const [dragOver, setDragOver] = useState<Stage | null>(null);
  const [, start] = useTransition();

  function drop(toStage: Stage, id: string) {
    setDragOver(null);
    const c = candidates.find((x) => x.id === id);
    if (!c || c.stage === toStage) return;
    start(async () => {
      const res = await moveStage(id, toStage);
      if (!res.ok) toast.error(res.error ?? "Gagal memindahkan.");
    });
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {STAGES.map((s) => {
        const list = candidates.filter(
          (c) =>
            !c.archived &&
            ((c.outcome === "active" && c.stage === s.k) ||
              (s.k === "agent" && c.outcome === "agent_aktif")),
        );
        return (
          <div
            key={s.k}
            className="flex w-60 shrink-0 flex-col rounded-xl border border-border/70 bg-card shadow-card"
          >
            <div className="flex items-center justify-between border-b border-border/70 px-3 py-2.5">
              <span className="text-xs font-semibold">{s.l}</span>
              <span className="rounded-full bg-brand-muted px-2 py-0.5 text-[11px] font-semibold text-brand">
                {list.length}
              </span>
            </div>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(s.k);
              }}
              onDragLeave={() => setDragOver((p) => (p === s.k ? null : p))}
              onDrop={(e) => {
                e.preventDefault();
                drop(s.k, e.dataTransfer.getData("text"));
              }}
              className={cn(
                "flex min-h-16 flex-1 flex-col gap-2 p-2",
                dragOver === s.k && "rounded-lg bg-brand-muted/40 outline-2 outline-dashed outline-brand",
              )}
            >
              {list.length === 0 && (
                <p className="py-3 text-center text-[11px] text-muted-foreground/60">—</p>
              )}
              {list.map((c) => {
                const stale = isStale(c, staleDays);
                return (
                  <div
                    key={c.id}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData("text", c.id)}
                    onClick={() => onOpen(c.id)}
                    className={cn(
                      "cursor-grab rounded-lg border border-border/70 border-l-[3px] bg-card p-2.5 shadow-card transition-shadow hover:shadow-pop active:cursor-grabbing",
                      stale ? "border-l-destructive" : "border-l-brand",
                    )}
                  >
                    <p className="mb-1 text-[13px] font-semibold leading-tight">{c.name}</p>
                    <div className="flex flex-wrap items-center gap-1">
                      <Tag tone="src">{c.source || "-"}</Tag>
                      {c.jalur && <Tag tone="jl">{c.jalur}</Tag>}
                      {c.interviewAt && <Tag tone="iv">🗓 {fmtDT(c.interviewAt)}</Tag>}
                      {s.k !== "agent" && (
                        <Tag tone={stale ? "stale" : "age"}>
                          {stale ? "⏳ " : ""}
                          {daysInStage(c)}h
                        </Tag>
                      )}
                      {isOverdue(c) && <Tag tone="over">⏰ follow-up</Tag>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
