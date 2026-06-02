"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { applyVideoAction } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ACTIONS, ACTION_LABEL, type VideoAction } from "@/lib/video-workflow";

export function StatusActions({ videoId, actions }: { videoId: string; actions: VideoAction[] }) {
  const [pending, start] = useTransition();
  const [link, setLink] = useState("");
  const router = useRouter();
  const needsLink = actions.some((a) => a !== "force_set_status" && ACTIONS[a].requiresLink);

  if (actions.length === 0) {
    return (
      <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground shadow-card">
        Tidak ada aksi untuk Anda di status ini.
      </p>
    );
  }

  function run(action: VideoAction) {
    start(async () => {
      const res = await applyVideoAction(videoId, action, link || undefined);
      if (!res.ok) { toast.error(res.error ?? "Gagal"); return; }
      toast.success(ACTION_LABEL[action] + " berhasil");
      setLink("");
      router.refresh();
    });
  }

  return (
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
  );
}
