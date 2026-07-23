"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";
import { StatCard } from "@/components/ui-kit";
import {
  funnelData,
  sourceBreakdown,
  bestSource,
  journeyFunnel,
  journeySummary,
  weeklyTrend,
  daysBetween,
  stageIndex,
  stageLabel,
  type Candidate,
} from "@/lib/recruitment";
import { updateMilestone } from "./actions";

const PIE_COLORS = ["#2e8b57", "#2c6fb3", "#b7791f", "#8e44ad", "#16a085", "#d35400", "#7f8c8d"];
const SERIES = { masuk: "#2c6fb3", interview: "#b7791f", office: "#8e44ad" };

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-card">
      <h3 className="mb-4 font-display text-base tracking-tight">{title}</h3>
      {children}
    </div>
  );
}

function MilestoneRow({ c }: { c: Candidate }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const save = (field: string, value: string) => {
    start(async () => {
      const r = await updateMilestone(c.id, field, value);
      if (r.ok) {
        toast.success("Milestone tersimpan");
        router.refresh();
      } else {
        toast.error(r.error ?? "Gagal menyimpan");
      }
    });
  };
  const leadN =
    c.joinDate && c.msFirstClosing ? daysBetween(c.joinDate, c.msFirstClosing) : NaN;
  const lead = Number.isNaN(leadN) ? "–" : `${leadN} hari`;
  const dateInput = (field: string, val: string) => {
    const labelText =
      (
        {
          ms_first_office: "Pertama ke Kantor",
          join_date: "Join / Kontrak",
          ms_aaji: "Lisensi AAJI",
          ms_first_closing: "Closing Pertama",
        } as Record<string, string>
      )[field] ?? field;
    return (
      <input
        type="date"
        defaultValue={val}
        disabled={pending}
        onChange={(e) => save(field, e.target.value)}
        aria-label={`${c.name} — ${labelText}`}
        className="rounded-md border border-border/70 bg-background px-2 py-1 text-xs text-foreground disabled:opacity-50"
      />
    );
  };
  return (
    <tr className="border-t border-border/60">
      <td className="py-2 pr-3">
        <div className="font-medium">{c.name}</div>
        <div className="text-[11px] text-muted-foreground">{stageLabel(c.stage)}</div>
      </td>
      <td className="px-2 py-2">{dateInput("ms_first_office", c.msFirstOffice)}</td>
      <td className="px-2 py-2">{dateInput("join_date", c.joinDate)}</td>
      <td className="px-2 py-2">{dateInput("ms_aaji", c.msAAJI)}</td>
      <td className="px-2 py-2">{dateInput("ms_first_closing", c.msFirstClosing)}</td>
      <td className="px-2 py-2 text-xs text-muted-foreground">{lead}</td>
    </tr>
  );
}

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

  const jf = journeyFunnel(visible);
  const js = journeySummary(visible);
  const trend = weeklyTrend(visible);

  const io = stageIndex("onboarding");
  const milestoneRows = visible.filter(
    (c) =>
      c.outcome !== "tidak_lolos" &&
      c.outcome !== "talent_pool" &&
      ((c.maxReached || 1) >= io || c.stage === "agent" || c.stage === "onboarding"),
  );

  return (
    <div className="space-y-5">
      {/* 1. KPI */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Total Kandidat" value={visible.length} />
        <StatCard label="Aktif di Pipeline" value={activePipe} emphasis />
        <StatCard label="Talent Pool" value={talent} />
        <StatCard label="Tidak Lolos" value={fail} />
        <StatCard label="Agent Aktif" value={agent} emphasis />
        <StatCard label="Source Terbaik" value={bestSource(visible)} />
      </div>

      {/* 2. Funnel lama + Source */}
      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <Panel title="Funnel & Conversion Rate per Tahap">
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
        </Panel>

        <Panel title="Kandidat per Source">
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
        </Panel>
      </div>

      {/* 3. Journey — Funnel & Konversi */}
      <Panel title="Journey Kandidat — Funnel & Konversi">
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatCard label="Total masuk pipeline" value={js.total} />
          <StatCard label="Masih aktif diproses" value={js.aktif} emphasis />
          <StatCard label="Diundang ke kantor" value={js.diundang} />
          <StatCard label="Datang ke kantor" value={js.office} hint={`${js.showRate}% dari diundang`} />
          <StatCard label="Jadi Agent" value={js.agent} emphasis />
          <StatCard label="Konversi Screening→Agent" value={`${js.convAll}%`} />
        </div>
        <div className="space-y-2">
          {jf.map((row, i) => (
            <div key={row.stage} className="flex items-center gap-3">
              <div className="w-40 shrink-0 text-right text-xs font-medium text-muted-foreground">
                {row.label}
              </div>
              <div className="relative h-6 flex-1 overflow-hidden rounded-md bg-brand-muted/40">
                <div
                  className="flex h-full items-center rounded-md bg-brand px-2 text-[11px] font-semibold text-white transition-all"
                  style={{ width: `${row.width}%`, minWidth: 24 }}
                >
                  {row.count}
                </div>
              </div>
              <div className="w-56 shrink-0 text-xs text-muted-foreground">
                {row.pctTop}% dari awal
                {i > 0 ? ` · ${row.pctPrev}% lanjut dari tahap sebelumnya` : ""}
              </div>
            </div>
          ))}
        </div>
      </Panel>

      {/* 4. Tren Mingguan */}
      <Panel title="Tren Mingguan (8 minggu terakhir)">
        {trend.length ? (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={trend} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar name="Masuk (Screening)" dataKey="masuk" fill={SERIES.masuk} radius={[3, 3, 0, 0]} />
              <Bar name="Interview terjadwal" dataKey="interview" fill={SERIES.interview} radius={[3, 3, 0, 0]} />
              <Bar name="Datang ke kantor" dataKey="office" fill={SERIES.office} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="py-12 text-center text-sm text-muted-foreground">Belum ada data mingguan.</p>
        )}
      </Panel>

      {/* 5. Milestone Agent */}
      <Panel title="Milestone Agent (sudah onboarding)">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="pb-2 pr-3 font-medium">Agent</th>
                <th className="px-2 pb-2 font-medium">Pertama ke Kantor</th>
                <th className="px-2 pb-2 font-medium">Join / Kontrak</th>
                <th className="px-2 pb-2 font-medium">Lisensi AAJI</th>
                <th className="px-2 pb-2 font-medium">Closing Pertama</th>
                <th className="px-2 pb-2 font-medium">Join→Closing</th>
              </tr>
            </thead>
            <tbody>
              {milestoneRows.length ? (
                milestoneRows.map((c) => (
                  <MilestoneRow
                    key={`${c.id}:${c.msFirstOffice}:${c.joinDate}:${c.msAAJI}:${c.msFirstClosing}`}
                    c={c}
                  />
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-4 text-sm text-muted-foreground">
                    Belum ada agent/onboarding. Baris muncul otomatis saat kandidat mencapai tahap
                    Onboarding/Agent.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">
          Isi tanggal langsung di kolom — tersimpan otomatis. Kolom “Join→Closing” dihitung otomatis.
        </p>
      </Panel>
    </div>
  );
}
