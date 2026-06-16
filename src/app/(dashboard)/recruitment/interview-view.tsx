"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui-kit";
import {
  stageLabel,
  ivDate,
  todayStr,
  addDays,
  type Candidate,
} from "@/lib/recruitment";
import { Tag, fmtDT } from "./recruitment-ui";
import { setInterviewDone } from "./actions";

function status(c: Candidate): { tone: string; label: string } {
  if (c.interviewDone) return { tone: "agent", label: "Selesai" };
  const d = ivDate(c);
  const t = todayStr();
  if (d < t) return { tone: "fail", label: "Terlewat — belum ditandai" };
  if (d === t) return { tone: "talent", label: "Hari ini" };
  if (d === addDays(t, 1)) return { tone: "active", label: "Besok" };
  return { tone: "active", label: "Mendatang" };
}

export function InterviewView({
  candidates,
  onOpen,
}: {
  candidates: Candidate[];
  onOpen: (id: string) => void;
}) {
  const [pending, start] = useTransition();
  const all = candidates.filter((c) => !c.archived && c.interviewAt && c.outcome === "active");
  const belum = all
    .filter((c) => !c.interviewDone)
    .sort((a, b) => (a.interviewAt < b.interviewAt ? -1 : 1));
  const sudah = all
    .filter((c) => c.interviewDone)
    .sort((a, b) => (a.interviewAt > b.interviewAt ? -1 : 1));
  const t = todayStr();
  const todayN = belum.filter((c) => ivDate(c) === t).length;
  const overdueN = belum.filter((c) => ivDate(c) < t).length;

  function toggle(c: Candidate) {
    start(async () => {
      const res = await setInterviewDone(c.id, !c.interviewDone);
      if (!res.ok) toast.error(res.error ?? "Gagal.");
    });
  }

  function copySchedule() {
    if (!belum.length) {
      toast.info("Tidak ada wawancara yang masih perlu dilakukan.");
      return;
    }
    const txt =
      "Jadwal Wawancara:\n" +
      belum
        .map((c) => `• ${fmtDT(c.interviewAt)} — ${c.name} (${c.whatsapp})${c.jalur ? " · " + c.jalur : ""}`)
        .join("\n");
    navigator.clipboard
      ?.writeText(txt)
      .then(() => toast.success("Jadwal wawancara disalin ✓"))
      .catch(() => toast.error("Gagal menyalin."));
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Belum Dilakukan" value={belum.length} emphasis />
        <StatCard label="Hari Ini" value={todayN} />
        <StatCard label="Terlewat" value={overdueN} />
        <StatCard label="Sudah Dilakukan" value={sudah.length} />
      </div>

      <Button variant="outline" size="sm" onClick={copySchedule}>
        📋 Salin jadwal wawancara
      </Button>

      {all.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          🗓️ Belum ada wawancara terjadwal. Isi &quot;Jadwal Wawancara&quot; di profil kandidat
          (tahap Interview HR).
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border/70">
          <table className="w-full min-w-[760px] border-collapse bg-card text-left">
            <thead>
              <tr>
                {["Tanggal & Jam", "Status", "Nama", "Jalur", "Tahap", "WhatsApp", "Aksi"].map((h) => (
                  <th
                    key={h}
                    className="whitespace-nowrap border-b border-border/70 bg-brand-muted/40 px-3 py-2.5 text-xs font-semibold text-brand"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <Group label="Belum dilakukan" n={belum.length} />
              {belum.map((c) => (
                <Row key={c.id} c={c} onOpen={onOpen} onToggle={toggle} pending={pending} />
              ))}
              <Group label="Sudah dilakukan" n={sudah.length} />
              {sudah.map((c) => (
                <Row key={c.id} c={c} onOpen={onOpen} onToggle={toggle} pending={pending} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Group({ label, n }: { label: string; n: number }) {
  if (n === 0) return null;
  return (
    <tr>
      <td
        colSpan={7}
        className="bg-brand-muted/30 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-brand"
      >
        {label} ({n})
      </td>
    </tr>
  );
}

function Row({
  c,
  onOpen,
  onToggle,
  pending,
}: {
  c: Candidate;
  onOpen: (id: string) => void;
  onToggle: (c: Candidate) => void;
  pending: boolean;
}) {
  const st = status(c);
  return (
    <tr className="border-b border-border/50 hover:bg-brand-muted/20">
      <td className="cursor-pointer px-3 py-2 text-xs font-semibold" onClick={() => onOpen(c.id)}>
        {fmtDT(c.interviewAt)}
      </td>
      <td className="px-3 py-2 text-xs" onClick={() => onOpen(c.id)}>
        <Tag tone={st.tone}>{st.label}</Tag>
      </td>
      <td className="cursor-pointer px-3 py-2 text-xs" onClick={() => onOpen(c.id)}>
        {c.name}
      </td>
      <td className="px-3 py-2 text-xs" onClick={() => onOpen(c.id)}>
        {c.jalur || "—"}
      </td>
      <td className="px-3 py-2 text-xs" onClick={() => onOpen(c.id)}>
        {stageLabel(c.stage)}
      </td>
      <td className="px-3 py-2 text-xs" onClick={() => onOpen(c.id)}>
        {c.whatsapp}
      </td>
      <td className="px-3 py-2 text-xs">
        <Button variant="outline" size="xs" disabled={pending} onClick={() => onToggle(c)}>
          {c.interviewDone ? "↩ Tandai belum" : "✓ Tandai selesai"}
        </Button>
      </td>
    </tr>
  );
}
