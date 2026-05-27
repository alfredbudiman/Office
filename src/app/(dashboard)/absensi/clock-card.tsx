"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { LogIn, LogOut, CheckCircle2 } from "lucide-react";
import { clockIn, clockOut } from "./actions";
import { Button } from "@/components/ui/button";
import type { AttendanceState } from "@/lib/attendance";

export function ClockCard({
  state,
  clockInLabel,
  clockOutLabel,
}: {
  state: AttendanceState;
  clockInLabel: string | null;
  clockOutLabel: string | null;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const [now] = useState(() =>
    new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
  );

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, okMsg: string) {
    start(async () => {
      const res = await fn();
      if (!res.ok) { toast.error(res.error ?? "Gagal"); return; }
      toast.success(okMsg);
      router.refresh();
    });
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6"
    >
      <p className="text-sm text-muted-foreground">{now}</p>
      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-4">
        <div>
          <p className="text-xs text-muted-foreground">Masuk</p>
          <p className="tnum text-2xl font-semibold tracking-tight">{clockInLabel ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Pulang</p>
          <p className="tnum text-2xl font-semibold tracking-tight">{clockOutLabel ?? "—"}</p>
        </div>
        <div className="w-full sm:ml-auto sm:w-auto">
          {state === "not_in" && (
            <Button size="lg" disabled={pending} onClick={() => run(clockIn, "Berhasil clock in")} className="w-full sm:w-auto">
              <LogIn className="mr-2 h-4 w-4" /> Clock In
            </Button>
          )}
          {state === "working" && (
            <Button size="lg" variant="secondary" disabled={pending} onClick={() => run(clockOut, "Berhasil clock out")} className="w-full sm:w-auto">
              <LogOut className="mr-2 h-4 w-4" /> Clock Out
            </Button>
          )}
          {state === "done" && (
            <span className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-100 px-4 py-2 text-sm font-medium text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300 sm:w-auto">
              <CheckCircle2 className="h-4 w-4" /> Absen hari ini selesai
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}
