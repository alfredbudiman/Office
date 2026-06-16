"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { OUTCOME_TAG, type Outcome } from "@/lib/recruitment";

// Nada warna untuk tag/badge — selaras token tema (light + dark).
export const TONE: Record<string, string> = {
  active: "bg-brand-muted text-brand",
  talent: "bg-blue-100 text-blue-700 dark:bg-blue-400/15 dark:text-blue-300",
  fail: "bg-destructive/10 text-destructive",
  agent: "bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300",
  src: "bg-blue-100 text-blue-700 dark:bg-blue-400/15 dark:text-blue-300",
  jl: "bg-purple-100 text-purple-700 dark:bg-purple-400/15 dark:text-purple-300",
  over: "bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300",
  iv: "bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300",
  age: "bg-muted text-muted-foreground",
  stale: "bg-destructive/10 text-destructive",
};

export function Tag({
  tone,
  children,
  className,
}: {
  tone: keyof typeof TONE | string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
        TONE[tone] ?? "bg-muted text-muted-foreground",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function OutcomeBadge({ outcome }: { outcome: Outcome }) {
  const o = OUTCOME_TAG[outcome];
  return <Tag tone={o.tone}>{o.label}</Tag>;
}

// Modal sederhana (overlay + kartu) — meniru perilaku dashboard asli.
export function Modal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-8"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={cn(
          "w-full rounded-2xl border border-border/70 bg-card shadow-pop",
          wide ? "max-w-2xl" : "max-w-xl",
        )}
      >
        <div className="flex items-center justify-between border-b border-border/70 px-5 py-3.5">
          <h2 className="font-display text-lg tracking-tight">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Tutup"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="max-h-[75vh] overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <p className="mt-5 mb-2 border-t border-border/60 pt-3 text-[11px] font-semibold uppercase tracking-wider text-brand first:mt-0 first:border-t-0 first:pt-0">
      {children}
    </p>
  );
}

// Format datetime-local lokal "2026-06-09T19:00" -> "09 Jun, 19.00"
export function fmtDT(s: string): string {
  if (!s) return "";
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}
