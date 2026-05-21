import type { ReactNode } from "react";

/** Header halaman: judul + deskripsi opsional, aksi di kanan. */
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
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}

/** Kartu metrik clean-SaaS: label kecil + angka tabular besar + hint opsional. */
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
    <div className="rounded-xl border border-border bg-card p-4 shadow-card">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        {icon && <span className="text-muted-foreground/70">{icon}</span>}
      </div>
      <p className={`tnum mt-2 text-3xl font-semibold tracking-tight ${emphasis ? "text-brand" : ""}`}>
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Judul seksi kecil. */
export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="text-sm font-semibold tracking-tight text-foreground/80">{children}</h2>;
}
