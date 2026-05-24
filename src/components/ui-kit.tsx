import type { ReactNode } from "react";

/** Header halaman: judul (display serif) + deskripsi opsional, aksi di kanan. */
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
    <div className="mb-7 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-3xl leading-[1.05] tracking-tight sm:text-[34px]">
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-prose text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}

/** Kartu metrik — warm card, angka pakai serif display untuk feel editorial. */
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
    <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-card transition-shadow hover:shadow-pop">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        {icon && <span className="text-muted-foreground/70">{icon}</span>}
      </div>
      <p
        className={`font-display tnum mt-3 text-[40px] leading-none tracking-tight ${
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
