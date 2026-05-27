"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ShieldAlert } from "lucide-react";
import { applyVideoAction, overrideVideoStatus } from "../actions";
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
  const router = useRouter();
  const needsLink = actions.some((a) => ACTIONS[a].requiresLink);

  function run(action: VideoAction) {
    start(async () => {
      const res = await applyVideoAction(videoId, action, link || undefined);
      if (!res.ok) { toast.error(res.error ?? "Gagal"); return; }
      toast.success(ACTION_LABEL[action] + " berhasil");
      setLink("");
      router.refresh();
    });
  }

  function runOverride() {
    if (target === currentStatus) {
      toast.error("Status sudah pada posisi tersebut");
      return;
    }
    const ok = window.confirm(
      `Pindahkan status dari "${STATUS_LABEL[currentStatus]}" ke "${STATUS_LABEL[target]}"?\n\nIni bypass workflow normal.`
    );
    if (!ok) return;
    start(async () => {
      const res = await overrideVideoStatus(videoId, target);
      if (!res.ok) { toast.error(res.error ?? "Gagal"); return; }
      toast.success(`Status dipindahkan ke ${STATUS_LABEL[target]}`);
      router.refresh();
    });
  }

  const hasNormalActions = actions.length > 0;

  return (
    <div className="space-y-3">
      {/* Normal workflow actions */}
      {hasNormalActions ? (
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
      ) : (
        !isOwner && (
          <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground shadow-card">
            Tidak ada aksi untuk Anda di status ini.
          </p>
        )
      )}

      {/* Owner-only manual override */}
      {isOwner && (
        <div className="rounded-xl border border-dashed border-border bg-card/60 p-4">
          <div className="mb-2 flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-medium">Ubah status manual</p>
          </div>
          <p className="mb-3 text-xs text-muted-foreground">
            Bypass workflow normal. Gunakan kalau approval sudah dilakukan di luar sistem (mis. WhatsApp).
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <select
              value={target}
              onChange={(e) => setTarget(e.target.value as VideoStatus)}
              className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm sm:flex-1"
            >
              {STATUS_ORDER.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}{s === currentStatus ? " (sekarang)" : ""}
                </option>
              ))}
            </select>
            <Button
              variant="secondary"
              disabled={pending || target === currentStatus}
              onClick={runOverride}
              className="sm:w-auto"
            >
              Pindahkan
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
