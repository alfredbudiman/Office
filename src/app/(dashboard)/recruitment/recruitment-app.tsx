"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { UserPlus, Settings, Download, Upload, FileDown, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui-kit";
import { cn } from "@/lib/utils";
import {
  JALUR,
  SOURCES,
  isOverdue,
  ivDate,
  todayStr,
  stageLabel,
  type Candidate,
} from "@/lib/recruitment";
import { Modal } from "./recruitment-ui";
import { KanbanBoard } from "./kanban-board";
import { CandidateTable } from "./candidate-table";
import { DashboardView } from "./dashboard-view";
import { InterviewView } from "./interview-view";
import { CandidateModal } from "./candidate-modal";
import { createCandidate, updateRecruitmentSettings, importMerge } from "./actions";
import { exportJson, exportCsv, exportAgentsJson } from "./export";

type Tab = "kanban" | "table" | "dash" | "wawancara";
const TABS: { k: Tab; l: string }[] = [
  { k: "kanban", l: "Kanban" },
  { k: "table", l: "Database Kandidat" },
  { k: "dash", l: "Dashboard" },
  { k: "wawancara", l: "Wawancara" },
];

export function RecruitmentApp({
  candidates,
  followUpDays,
  staleDays,
}: {
  candidates: Candidate[];
  followUpDays: number;
  staleDays: number;
}) {
  const [tab, setTab] = useState<Tab>("kanban");
  const [jalur, setJalur] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const mergeRef = useRef<HTMLInputElement>(null);

  const byJalur = (c: Candidate) => !jalur || c.jalur === jalur;
  const filtered = candidates.filter(byJalur);
  const selected = openId ? candidates.find((c) => c.id === openId) ?? null : null;

  const overdue = filtered.filter((c) => isOverdue(c) && !c.archived);
  const today = todayStr();
  const ivToday = filtered.filter(
    (c) => !c.archived && c.outcome === "active" && !c.interviewDone && ivDate(c) === today,
  );

  function handleMergeFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const obj = JSON.parse(String(reader.result));
        const arr = Array.isArray(obj) ? obj : obj.cands;
        if (!Array.isArray(arr)) {
          toast.error("Format file tidak dikenal (harus ada 'cands').");
          return;
        }
        const res = await importMerge(arr);
        if (res.ok) toast.success(`Import: ${res.added} baru, ${res.updated} dilengkapi.`);
        else toast.error(res.error ?? "Gagal import.");
      } catch {
        toast.error("Gagal membaca file.");
      } finally {
        if (mergeRef.current) mergeRef.current.value = "";
      }
    };
    reader.readAsText(file);
  }

  return (
    <div>
      <PageHeader title="Recruitment" description="Pipeline rekrutmen Sproutlab — Sabina.">
        <Button size="sm" onClick={() => setShowAdd(true)}>
          <UserPlus /> Tambah Kandidat
        </Button>
        <Button variant="outline" size="sm" onClick={() => setShowSettings(true)}>
          <Settings /> Pengaturan
        </Button>
      </PageHeader>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-lg border border-border/70 bg-card p-1 shadow-card">
          {TABS.map((t) => (
            <button
              key={t.k}
              onClick={() => setTab(t.k)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                tab === t.k ? "bg-brand text-brand-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.l}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          Jalur:
          <select
            value={jalur}
            onChange={(e) => setJalur(e.target.value)}
            className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring dark:bg-input/30"
          >
            <option value="">Semua Jalur</option>
            {JALUR.map((j) => (
              <option key={j} value={j}>
                {j}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* utility actions */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        <Button variant="ghost" size="xs" onClick={() => exportJson(candidates)}>
          <Download /> JSON
        </Button>
        <Button variant="ghost" size="xs" onClick={() => exportCsv(candidates)}>
          <FileDown /> CSV
        </Button>
        <Button
          variant="ghost"
          size="xs"
          onClick={() => exportAgentsJson(candidates.filter(byJalur))}
        >
          <Send /> Export Agen
        </Button>
        <Button variant="ghost" size="xs" onClick={() => mergeRef.current?.click()}>
          <Upload /> Tambah dari file
        </Button>
        <input
          ref={mergeRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={handleMergeFile}
        />
      </div>

      {/* alert bars */}
      {ivToday.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-300">
          🗓 {ivToday.length} wawancara hari ini —{" "}
          {ivToday.map((c) => c.name).join(", ")}
          <button className="ml-auto underline" onClick={() => setTab("wawancara")}>
            Lihat jadwal
          </button>
        </div>
      )}
      {overdue.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-300">
          ⚠️ {overdue.length} kandidat perlu di-follow-up sekarang.
          <button
            className="underline"
            onClick={() => {
              const txt =
                "Follow-up " +
                today +
                ":\n" +
                overdue
                  .map((c) => `• ${c.name} (${c.whatsapp}) — ${stageLabel(c.stage)}${c.jalur ? " · " + c.jalur : ""}`)
                  .join("\n");
              navigator.clipboard
                ?.writeText(txt)
                .then(() => toast.success("Daftar follow-up disalin ✓"))
                .catch(() => toast.error("Gagal menyalin."));
            }}
          >
            📋 Salin daftar
          </button>
        </div>
      )}

      {/* views */}
      {tab === "kanban" && (
        <KanbanBoard candidates={filtered} staleDays={staleDays} onOpen={setOpenId} />
      )}
      {tab === "table" && <CandidateTable candidates={filtered} onOpen={setOpenId} />}
      {tab === "dash" && <DashboardView candidates={filtered} />}
      {tab === "wawancara" && <InterviewView candidates={filtered} onOpen={setOpenId} />}

      {selected && (
        <CandidateModal
          candidate={selected}
          staleDays={staleDays}
          followUpDays={followUpDays}
          onClose={() => setOpenId(null)}
        />
      )}
      {showAdd && <AddModal onClose={() => setShowAdd(false)} />}
      {showSettings && (
        <SettingsModal
          followUpDays={followUpDays}
          staleDays={staleDays}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}

function AddModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [wa, setWa] = useState("");
  const [source, setSource] = useState(SOURCES[0]);
  const [jalur, setJalur] = useState("");
  const [pending, start] = useTransition();

  function submit() {
    if (!name.trim() || !wa.trim()) {
      toast.error("Nama & WhatsApp wajib diisi.");
      return;
    }
    start(async () => {
      const res = await createCandidate({ name, whatsapp: wa, source, jalur });
      if (res.ok) {
        toast.success("Kandidat ditambahkan.");
        onClose();
      } else {
        toast.error(res.error ?? "Gagal menambah.");
      }
    });
  }

  const selectCls =
    "h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring dark:bg-input/30";

  return (
    <Modal title="Tambah Kandidat Baru" onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-semibold">Nama *</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama lengkap" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold">Nomor WhatsApp *</label>
          <Input value={wa} onChange={(e) => setWa(e.target.value)} placeholder="08xxx atau 62xxx" />
          <p className="mt-1 text-[11px] text-muted-foreground">Dipakai untuk deteksi duplikat.</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-semibold">Source Kandidat *</label>
            <select value={source} onChange={(e) => setSource(e.target.value)} className={selectCls}>
              {SOURCES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold">Jalur Rekrutmen</label>
            <select value={jalur} onChange={(e) => setJalur(e.target.value)} className={selectCls}>
              <option value="">— tentukan nanti —</option>
              {JALUR.map((j) => (
                <option key={j} value={j}>
                  {j}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Jalur bisa diubah & difinalkan saat interview. ID, tanggal masuk & status awal otomatis.
        </p>
        <Button className="w-full" disabled={pending} onClick={submit}>
          Simpan Kandidat
        </Button>
      </div>
    </Modal>
  );
}

function SettingsModal({
  followUpDays,
  staleDays,
  onClose,
}: {
  followUpDays: number;
  staleDays: number;
  onClose: () => void;
}) {
  const [fu, setFu] = useState(String(followUpDays));
  const [st, setSt] = useState(String(staleDays));
  const [pending, start] = useTransition();

  function submit() {
    start(async () => {
      const res = await updateRecruitmentSettings(parseInt(fu) || 3, parseInt(st) || 7);
      if (res.ok) {
        toast.success("Pengaturan disimpan.");
        onClose();
      } else {
        toast.error("Gagal menyimpan.");
      }
    });
  }

  return (
    <Modal title="Pengaturan" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-semibold">Jeda follow-up otomatis (hari)</label>
          <Input type="number" min={1} max={30} value={fu} onChange={(e) => setFu(e.target.value)} />
          <p className="mt-1 text-[11px] text-muted-foreground">
            Kandidat di tahap Follow-Up dijadwalkan ulang sekian hari setelah dikontak. Default 3.
          </p>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold">Ambang &quot;macet di tahap&quot; (hari)</label>
          <Input type="number" min={1} max={60} value={st} onChange={(e) => setSt(e.target.value)} />
          <p className="mt-1 text-[11px] text-muted-foreground">
            Kandidat yang diam di satu tahap lebih lama dari ini ditandai ⏳ macet. Default 7.
          </p>
        </div>
        <Button className="w-full" disabled={pending} onClick={submit}>
          Simpan
        </Button>
      </div>
    </Modal>
  );
}
