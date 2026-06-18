import type { ReactNode } from "react";

/** Header halaman: judul (Syne display) + deskripsi opsional, aksi di kanan. */
export function PageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:mb-7 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-2xl leading-[1.1] tracking-tight sm:text-[34px] sm:leading-[1.05]">
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 max-w-prose text-sm text-muted-foreground sm:mt-2">{description}</p>
        )}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

/** Kartu metrik — kartu putih, angka pakai Syne display untuk feel editorial. */
export function StatCard({
  label,
  value,
  hint,
  icon,
  emphasis = false,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
  emphasis?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-card transition-shadow hover:shadow-pop sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground sm:text-[11px]">
          {label}
        </p>
        {icon && <span className="shrink-0 text-muted-foreground/70">{icon}</span>}
      </div>
      <p
        className={`font-display tnum mt-2 text-[32px] leading-none tracking-tight sm:mt-3 sm:text-[40px] ${
          emphasis ? "text-brand" : ""
        }`}
      >
        {value}
      </p>
      {hint && <p className="mt-2 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Judul seksi kecil. */
export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="font-display text-lg tracking-tight text-foreground/85">{children}</h2>
  );
}
