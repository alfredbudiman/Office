"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { StatCard } from "@/components/ui-kit";
import { funnelData, sourceBreakdown, bestSource, type Candidate } from "@/lib/recruitment";

const PIE_COLORS = ["#2e8b57", "#2c6fb3", "#b7791f", "#8e44ad", "#16a085", "#d35400", "#7f8c8d"];

export function DashboardView({ candidates }: { candidates: Candidate[] }) {
  const visible = candidates.filter((c) => !c.archived);
  const activePipe = visible.filter((c) => c.outcome === "active").length;
  const talent = visible.filter((c) => c.outcome === "talent_pool").length;
  const fail = visible.filter((c) => c.outcome === "tidak_lolos").length;
  const agent = visible.filter((c) => c.outcome === "agent_aktif").length;

  const funnel = funnelData(visible);
  const by = sourceBreakdown(visible);
  const pieData = Object.entries(by)
    .filter(([, v]) => v.t > 0)
    .map(([name, v]) => ({ name, value: v.t }));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Total Kandidat" value={visible.length} />
        <StatCard label="Aktif di Pipeline" value={activePipe} emphasis />
        <StatCard label="Talent Pool" value={talent} />
        <StatCard label="Tidak Lolos" value={fail} />
        <StatCard label="Agent Aktif" value={agent} emphasis />
        <StatCard label="Source Terbaik" value={bestSource(visible)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-card">
          <h3 className="mb-4 font-display text-base tracking-tight">
            Funnel & Conversion Rate per Tahap
          </h3>
          <div className="space-y-2">
            {funnel.map((row, i) => (
              <div key={row.stage} className="flex items-center gap-3">
                <div className="w-36 shrink-0 text-right text-xs font-medium text-muted-foreground">
                  {row.label}
                </div>
                <div className="relative h-6 flex-1 overflow-hidden rounded-md bg-brand-muted/40">
                  <div
                    className="h-full rounded-md bg-brand transition-all"
                    style={{ width: `${row.width}%`, minWidth: 2 }}
                  />
                </div>
                <div className="w-24 shrink-0 text-xs text-muted-foreground">
                  {row.count} org{i > 0 ? ` · ${row.conv}%` : ""}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-card">
          <h3 className="mb-4 font-display text-base tracking-tight">Kandidat per Source</h3>
          {pieData.length ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={2}
                >
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend
                  layout="vertical"
                  align="right"
                  verticalAlign="middle"
                  iconType="circle"
                  wrapperStyle={{ fontSize: 12 }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-12 text-center text-sm text-muted-foreground">Belum ada data.</p>
          )}
        </div>
      </div>
    </div>
  );
}
