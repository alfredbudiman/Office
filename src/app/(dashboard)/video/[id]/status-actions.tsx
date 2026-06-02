"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { applyVideoAction } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ACTIONS, ACTION_LABEL, STATUS_ORDER, STATUS_LABEL,
  type VideoAction, type VideoStatus,
} from "@/lib/video-workflow";

export function StatusActions({
  videoId,
  actions,
  isOwner,
  currentStatus,
}: {
  videoId: string;
  actions: VideoAction[];
  isOwner: boolean;
  currentStatus: VideoStatus;
}) {
  const [pending, start] = useTransition();
  const [link, setLink] = useState("");
  const [target, setTarget] = useState<VideoStatus>(currentStatus);
  const [note, setNote] = useState("");
  const router = useRouter();
  const needsLink = actions.some((a) => a !== "force_set_status" && ACTIONS[a].requiresLink);
  const otherStatuses = STATUS_ORDER.filter((s) => s !== currentStatus);

  function run(action: VideoAction) {
    start(async () => {
      const res = await applyVideoAction(videoId, action, link || undefined);
      if (!res.ok) { toast.error(res.error ?? "Gagal"); return; }
      toast.success(ACTION_LABEL[action] + " berhasil");
      setLink("");
      router.refresh();
    });
  }

  function runForce() {
    if (target === currentStatus) {
      toast.error("Pilih status berbeda dulu");
      return;
    }
    start(async () => {
      const res = await applyVideoAction(videoId, "force_set_status", undefined, target, note);
      if (!res.ok) { toast.error(res.error ?? "Gagal"); return; }
      toast.success(`Status diubah → ${STATUS_LABEL[target]}`);
      setNote("");
      router.refresh();
    });
  }

  const showNormalCard = actions.length > 0;
  const showForcePanel = isOwner;

  if (!showNormalCard && !showForcePanel) {
    return (
      <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground shadow-card">
        Tidak ada aksi untuk Anda di status ini.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {showNormalCard && (
        <div className="rounded-xl border border-border bg-card p-4 shadow-card">
          {needsLink && (
            <div className="mb-3 space-y-1">
              <label className="text-sm font-medium">Link draft / hasil</label>
              <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://..." />
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {actions.map((a) => {
              const danger = a === "request_revision" || a === "request_cut_revision";
              return (
                <Button key={a} disabled={pending} variant={danger ? "secondary" : "default"} onClick={() => run(a)}>
                  {ACTION_LABEL[a]}
                </Button>
              );
            })}
          </div>
        </div>
      )}

      {showForcePanel && (
        <details className="rounded-xl border border-dashed border-amber-400/60 bg-amber-50/40 p-4 dark:bg-amber-400/5">
          <summary className="cursor-pointer text-sm font-medium text-amber-700 dark:text-amber-300">
            Ubah status manual (lompat)
          </summary>
          <p className="mt-2 text-xs text-muted-foreground">
            Lompat status — pastikan sengaja. Side-effect untuk Final/Tayang ikut diatur otomatis.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
            <select
              value={target}
              onChange={(e) => setTarget(e.target.value as VideoStatus)}
              className="h-9 rounded-md border border-border bg-background px-2 text-sm"
            >
              {otherStatuses.map((s) => (
                <option key={s} value={s}>{STATUS_LABEL[s]}</option>
              ))}
            </select>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Alasan singkat (3–200 char)"
              maxLength={200}
            />
            <Button disabled={pending} variant="secondary" onClick={runForce}>
              Ubah status
            </Button>
          </div>
        </details>
      )}
    </div>
  );
}
