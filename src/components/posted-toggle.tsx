"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { markPostedContent } from "@/app/(dashboard)/jadwal/actions";
import type { SourceType } from "@/lib/post-schedule";

/** Checkbox "sudah diposting (tanpa jadwal)" — dipakai di Bank Konten & detail Video.
 *  Hanya dirender untuk owner + social media manager. */
export function PostedToggle({
  contentKey, sourceType, title, videoId = null, initial, label = "sudah diposting",
}: {
  contentKey: string;
  sourceType: SourceType;
  title: string;
  videoId?: string | null;
  initial: boolean;
  label?: string;
}) {
  const [done, setDone] = useState(initial);
  const [pending, start] = useTransition();
  const router = useRouter();

  function toggle() {
    const next = !done;
    setDone(next);
    start(async () => {
      const res = await markPostedContent(contentKey, sourceType, title, videoId, next);
      if (!res.ok) { setDone(!next); toast.error(res.error ?? "Gagal"); return; }
      toast.success(next ? "Ditandai sudah diposting" : "Tanda dilepas");
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={done}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
        done ? "border-brand bg-brand-muted text-[#1d5128]" : "border-border text-muted-foreground hover:bg-accent"
      }`}
    >
      <span className={`flex h-3.5 w-3.5 items-center justify-center rounded-[4px] border ${done ? "border-brand bg-brand text-brand-foreground" : "border-current"}`}>
        {done && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
      </span>
      {label}
    </button>
  );
}
