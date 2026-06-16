"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import {
  STAGES,
  SOURCES,
  stageLabel,
  isOverdue,
  type Candidate,
} from "@/lib/recruitment";
import { Tag, OutcomeBadge, fmtDT } from "./recruitment-ui";

type SortKey = keyof Candidate;

export function CandidateTable({
  candidates,
  onOpen,
}: {
  candidates: Candidate[];
  onOpen: (id: string) => void;
}) {
  const [q, setQ] = useState("");
  const [fOutcome, setFOutcome] = useState("");
  const [fStage, setFStage] = useState("");
  const [fSource, setFSource] = useState("");
  const [fOver, setFOver] = useState(false);
  const [fArch, setFArch] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("dateIn");
  const [sortDir, setSortDir] = useState<1 | -1>(-1);

  const rows = useMemo(() => {
    const ql = q.toLowerCase();
    const list = candidates.filter((c) => {
      if (!fArch && c.archived) return false;
      if (fOutcome && c.outcome !== fOutcome) return false;
      if (fStage && c.stage !== fStage) return false;
      if (fSource && c.source !== fSource) return false;
      if (fOver && !isOverdue(c)) return false;
      if (ql) {
        const blob = `${c.name} ${c.whatsapp} ${c.source} ${c.code} ${c.jalur}`.toLowerCase();
        if (!blob.includes(ql)) return false;
      }
      return true;
    });
    return list.sort((a, b) => {
      const x = a[sortKey] ?? "";
      const y = b[sortKey] ?? "";
      return (x < y ? -1 : x > y ? 1 : 0) * sortDir;
    });
  }, [candidates, q, fOutcome, fStage, fSource, fOver, fArch, sortKey, sortDir]);

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir((d) => (d === 1 ? -1 : 1));
    else {
      setSortKey(k);
      setSortDir(1);
    }
  }

  const selectCls =
    "h-8 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring dark:bg-input/30";
  const cols: { k: SortKey; label: string }[] = [
    { k: "code", label: "ID" },
    { k: "name", label: "Nama" },
    { k: "whatsapp", label: "WhatsApp" },
    { k: "source", label: "Source" },
    { k: "jalur", label: "Jalur" },
    { k: "universitas", label: "Universitas" },
    { k: "stage", label: "Tahap" },
    { k: "outcome", label: "Outcome" },
    { k: "interviewAt", label: "Wawancara" },
    { k: "nextFollowUp", label: "Follow-up" },
    { k: "dateIn", label: "Masuk" },
  ];

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          type="text"
          placeholder="🔎 Cari nama / WA / source..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="h-8 min-w-52 flex-1 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring dark:bg-input/30"
        />
        <select value={fOutcome} onChange={(e) => setFOutcome(e.target.value)} className={selectCls}>
          <option value="">Semua Outcome</option>
          <option value="active">Aktif di pipeline</option>
          <option value="talent_pool">Talent Pool</option>
          <option value="tidak_lolos">Tidak Lolos</option>
          <option value="agent_aktif">Agent Aktif</option>
        </select>
        <select value={fStage} onChange={(e) => setFStage(e.target.value)} className={selectCls}>
          <option value="">Semua Tahap</option>
          {STAGES.map((s) => (
            <option key={s.k} value={s.k}>
              {s.l}
            </option>
          ))}
        </select>
        <select value={fSource} onChange={(e) => setFSource(e.target.value)} className={selectCls}>
          <option value="">Semua Source</option>
          {SOURCES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">
          <input type="checkbox" checked={fOver} onChange={(e) => setFOver(e.target.checked)} />
          Hanya overdue
        </label>
        <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <input type="checkbox" checked={fArch} onChange={(e) => setFArch(e.target.checked)} />
          Tampilkan arsip
        </label>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border/70">
        <table className="w-full min-w-[1100px] border-collapse bg-card text-left">
          <thead>
            <tr>
              {cols.map((col) => (
                <th
                  key={col.k}
                  onClick={() => toggleSort(col.k)}
                  className="cursor-pointer whitespace-nowrap border-b border-border/70 bg-brand-muted/40 px-3 py-2.5 text-xs font-semibold text-brand"
                >
                  {col.label}
                  {sortKey === col.k ? (sortDir === 1 ? " ▲" : " ▼") : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr
                key={c.id}
                onClick={() => onOpen(c.id)}
                className={cn(
                  "cursor-pointer border-b border-border/50 transition-colors hover:bg-brand-muted/30",
                  c.archived && "opacity-55",
                )}
              >
                <td className="px-3 py-2 text-xs">{c.code}</td>
                <td className="px-3 py-2 text-xs font-semibold">{c.name}</td>
                <td className="px-3 py-2 text-xs">{c.whatsapp}</td>
                <td className="px-3 py-2 text-xs">{c.source || "-"}</td>
                <td className="px-3 py-2 text-xs">
                  {c.jalur ? <Tag tone="jl">{c.jalur}</Tag> : <span className="text-muted-foreground/50">—</span>}
                </td>
                <td className="px-3 py-2 text-xs">{c.universitas || "-"}</td>
                <td className="px-3 py-2 text-xs">{stageLabel(c.stage)}</td>
                <td className="px-3 py-2 text-xs">
                  <OutcomeBadge outcome={c.outcome} />
                </td>
                <td className="px-3 py-2 text-xs">{c.interviewAt ? fmtDT(c.interviewAt) : "-"}</td>
                <td className="px-3 py-2 text-xs">
                  {isOverdue(c) && "⏰ "}
                  {c.nextFollowUp || "-"}
                </td>
                <td className="px-3 py-2 text-xs">{c.dateIn}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && (
        <div className="py-12 text-center text-sm text-muted-foreground">
          🗂️ Belum ada kandidat yang cocok.
        </div>
      )}
    </div>
  );
}
