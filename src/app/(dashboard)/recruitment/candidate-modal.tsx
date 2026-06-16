"use client";

import { useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  STAGES,
  DOCS,
  JALUR,
  stageIndex,
  stageLabel,
  daysInStage,
  isStale,
  type Candidate,
} from "@/lib/recruitment";
import { Modal, SectionTitle, OutcomeBadge, fmtDT } from "./recruitment-ui";
import {
  updateCandidate,
  moveStage,
  setOutcome,
  reactivate,
  promoteAgent,
  setArchived,
  deleteCandidate,
  contactedToday,
} from "./actions";
import { exportAgentsJson } from "./export";

type Props = {
  candidate: Candidate;
  staleDays: number;
  followUpDays: number;
  onClose: () => void;
};

export function CandidateModal({ candidate, staleDays, followUpDays, onClose }: Props) {
  const c = candidate;
  const si = stageIndex(c.stage);
  const [pending, start] = useTransition();

  // state form: salin field yang bisa diedit
  const [f, setF] = useState<Record<string, string>>(() => ({
    jalur: c.jalur,
    email: c.email, domisili: c.domisili, birth: c.birth, marital: c.marital,
    education: c.education, jurusan: c.jurusan, universitas: c.universitas,
    salesExp: c.salesExp, experience: c.experience, cvNote: c.cvNote,
    interest: c.interest, followNote: c.followNote, lastContact: c.lastContact,
    nextFollowUp: c.nextFollowUp, interviewAt: c.interviewAt, scoreHR: c.scoreHR,
    noteHR: c.noteHR, recHR: c.recHR, noteAlfred: c.noteAlfred,
    joinDate: c.joinDate, contractStatus: c.contractStatus, contractLink: c.contractLink,
    docLink: c.docLink, agentStatus: c.agentStatus,
  }));
  const [docs, setDocs] = useState<Record<string, boolean>>(() => ({ ...c.docs }));

  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  function collectFields(): Record<string, string> {
    return { ...f, docs: JSON.stringify(docs) };
  }

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, okMsg?: string, close = true) {
    start(async () => {
      const res = await fn();
      if (!res.ok) {
        toast.error(res.error ?? "Gagal menyimpan.");
        return;
      }
      if (okMsg) toast.success(okMsg);
      if (close) onClose();
    });
  }

  const save = () => run(() => updateCandidate(c.id, collectFields()), "Perubahan disimpan.");

  // simpan field dulu, lalu jalankan transisi keputusan
  function saveThen(fn: () => Promise<{ ok: boolean; error?: string }>, okMsg?: string) {
    start(async () => {
      const s1 = await updateCandidate(c.id, collectFields());
      if (!s1.ok) {
        toast.error(s1.error ?? "Gagal menyimpan.");
        return;
      }
      const res = await fn();
      if (!res.ok) {
        toast.error(res.error ?? "Gagal.");
        return;
      }
      if (okMsg) toast.success(okMsg);
      onClose();
    });
  }

  const nextS = STAGES[si + 1];
  const ageLine =
    c.outcome === "active" && c.stage !== "agent"
      ? ` · ${isStale(c, staleDays) ? "⏳ " : ""}${daysInStage(c)} hari di tahap ini`
      : "";

  return (
    <Modal title={`${c.name} · ${c.code}`} onClose={onClose} wide>
      <p className="text-xs text-muted-foreground">
        📞 {c.whatsapp} &nbsp;·&nbsp; 🔗 {c.source || "-"} &nbsp;·&nbsp; 📅 Masuk {c.dateIn}
      </p>
      <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        Status: <OutcomeBadge outcome={c.outcome} />
        <span>
          {stageLabel(c.stage)}
          {c.agentCode ? ` · ${c.agentCode}` : ""}
          {c.archived ? " · 🗄 Arsip" : ""}
          {ageLine}
        </span>
      </p>

      <SectionTitle>Data Kandidat</SectionTitle>
      <Field label="Jalur Rekrutmen">
        <Select value={f.jalur} onChange={(v) => set("jalur", v)} options={["", ...JALUR]} />
      </Field>
      <Row>
        <Field label="Email">
          <TextInput value={f.email} onChange={(v) => set("email", v)} />
        </Field>
        <Field label="Domisili">
          <TextInput value={f.domisili} onChange={(v) => set("domisili", v)} />
        </Field>
      </Row>
      <Row>
        <Field label="Tanggal Lahir">
          <DateInput value={f.birth} onChange={(v) => set("birth", v)} />
        </Field>
        <Field label="Status">
          <Select
            value={f.marital}
            onChange={(v) => set("marital", v)}
            options={["", "Belum menikah", "Menikah"]}
          />
        </Field>
      </Row>
      <Row>
        <Field label="Pendidikan Terakhir">
          <Select
            value={f.education}
            onChange={(v) => set("education", v)}
            options={["", "SMA/SMK", "D3", "S1", "S2", "S3", "Lainnya"]}
          />
        </Field>
        <Field label="Jurusan">
          <TextInput value={f.jurusan} onChange={(v) => set("jurusan", v)} />
        </Field>
      </Row>
      <Field label="Universitas / Sekolah">
        <TextInput value={f.universitas} onChange={(v) => set("universitas", v)} />
      </Field>
      <Field label="Pengalaman sales / financial advisor?">
        <Select
          value={f.salesExp}
          onChange={(v) => set("salesExp", v)}
          options={["", "Ya", "Tidak"]}
        />
      </Field>
      <Field label="Catatan Pengalaman Kerja">
        <TextArea value={f.experience} onChange={(v) => set("experience", v)} />
      </Field>
      <Field label="Link CV (Google Drive / LinkedIn)">
        <TextInput value={f.cvNote} onChange={(v) => set("cvNote", v)} />
      </Field>

      {si >= stageIndex("followup") && (
        <>
          <SectionTitle>Follow Up & Pendekatan</SectionTitle>
          <Field label="Status Ketertarikan">
            <Select
              value={f.interest}
              onChange={(v) => set("interest", v)}
              options={["", "Sangat tertarik", "Tertarik", "Ragu", "Kurang tertarik"]}
            />
          </Field>
          <Field label="Catatan Hasil Percakapan">
            <TextArea value={f.followNote} onChange={(v) => set("followNote", v)} />
          </Field>
          <Row>
            <Field label="Kontak terakhir">
              <DateInput value={f.lastContact} onChange={(v) => set("lastContact", v)} />
            </Field>
            <Field label="Follow-up berikutnya">
              <DateInput value={f.nextFollowUp} onChange={(v) => set("nextFollowUp", v)} />
            </Field>
          </Row>
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => run(() => contactedToday(c.id), "Follow-up dijadwalkan ulang.")}
          >
            ✓ Sudah kontak hari ini (jadwalkan +{followUpDays} hari)
          </Button>
        </>
      )}

      {si >= stageIndex("interview_hr") && (
        <>
          <SectionTitle>Interview HR</SectionTitle>
          <Field label="Jadwal Wawancara">
            <input
              type="datetime-local"
              value={f.interviewAt}
              onChange={(e) => set("interviewAt", e.target.value)}
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            />
          </Field>
          <Field label="Nilai Interview (1–10)">
            <input
              type="number"
              min={1}
              max={10}
              value={f.scoreHR}
              onChange={(e) => set("scoreHR", e.target.value)}
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            />
          </Field>
          <Field label="Catatan Interview">
            <TextArea value={f.noteHR} onChange={(v) => set("noteHR", v)} />
          </Field>
          <Field label="Rekomendasi HR">
            <TextArea value={f.recHR} onChange={(v) => set("recHR", v)} />
          </Field>
        </>
      )}

      {si >= stageIndex("interview_alfred") && (
        <>
          <SectionTitle>Interview Pak Alfred</SectionTitle>
          <Field label="Catatan Pak Alfred">
            <TextArea value={f.noteAlfred} onChange={(v) => set("noteAlfred", v)} />
          </Field>
        </>
      )}

      {si >= stageIndex("onboarding") && (
        <>
          <SectionTitle>Onboarding — Kelengkapan Dokumen</SectionTitle>
          {DOCS.map((d) => (
            <label key={d.k} className="flex items-center gap-2 py-1 text-sm">
              <input
                type="checkbox"
                checked={!!docs[d.k]}
                onChange={(e) => setDocs((p) => ({ ...p, [d.k]: e.target.checked }))}
                className="h-4 w-4"
              />
              {d.l}
              {d.opt && <span className="text-muted-foreground">(opsional)</span>}
            </label>
          ))}
          <Field label="Link Folder Dokumen (Google Drive)">
            <TextInput value={f.docLink} onChange={(v) => set("docLink", v)} />
          </Field>
          <Field label="Tanggal Join">
            <DateInput value={f.joinDate} onChange={(v) => set("joinDate", v)} />
          </Field>
          {c.agentCode && (
            <p className="text-xs text-muted-foreground">
              ID Agent: <b>{c.agentCode}</b>
            </p>
          )}
          <SectionTitle>Kontrak</SectionTitle>
          <Field label="Status Kontrak">
            <Select
              value={f.contractStatus}
              onChange={(v) => set("contractStatus", v)}
              options={["", "Dikirim ke kandidat", "Ditandatangani"]}
            />
          </Field>
          <Field label="Link Kontrak (Google Drive)">
            <TextInput value={f.contractLink} onChange={(v) => set("contractLink", v)} />
          </Field>
        </>
      )}

      <SectionTitle>Keputusan Tahap Ini</SectionTitle>
      <div className="flex flex-wrap gap-2">
        {c.stage === "agent" ? (
          <div className="w-full">
            <p className="mb-2 text-xs text-muted-foreground">
              Sudah menjadi Agent Aktif 🎉 — unduh datanya untuk dashboard agen:
            </p>
            <Button variant="outline" className="w-full" onClick={() => exportAgentsJson([c])}>
              📤 Export data agen (JSON)
            </Button>
          </div>
        ) : c.outcome !== "active" ? (
          <div className="w-full">
            <p className="mb-2 text-xs text-muted-foreground">
              Saat ini: <b>{c.outcome === "talent_pool" ? "Talent Pool" : "Tidak Lolos"}</b> — di
              luar pipeline aktif.
            </p>
            <Button
              className="w-full"
              disabled={pending}
              onClick={() => saveThen(() => reactivate(c.id), "Diaktifkan kembali.")}
            >
              ↩ Aktifkan kembali ke pipeline ({stageLabel(c.stage)})
            </Button>
          </div>
        ) : c.stage === "onboarding" ? (
          <Button
            className="w-full"
            disabled={pending}
            onClick={() => {
              const missing = DOCS.filter((d) => !d.opt && !docs[d.k]).map((d) => d.l);
              const warns: string[] = [];
              if (missing.length) warns.push("Dokumen belum lengkap: " + missing.join(", "));
              if (f.contractStatus !== "Ditandatangani") warns.push("Kontrak belum ditandatangani");
              if (warns.length && !confirm(warns.join(".\n") + ".\nTetap jadikan Agent Aktif?"))
                return;
              saveThen(() => promoteAgent(c.id), "Kandidat kini Agent Aktif.");
            }}
          >
            ✓ Jadikan Agent Aktif
          </Button>
        ) : (
          <>
            <Button
              disabled={pending}
              onClick={() => saveThen(() => moveStage(c.id, nextS.k), `Lanjut ke ${nextS.l}.`)}
            >
              → Lanjut: {nextS.l}
            </Button>
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => saveThen(() => setOutcome(c.id, "talent_pool"), "Masuk Talent Pool.")}
            >
              Talent Pool
            </Button>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() => saveThen(() => setOutcome(c.id, "tidak_lolos"), "Ditandai Tidak Lolos.")}
            >
              Tidak Lolos
            </Button>
          </>
        )}
      </div>

      <SectionTitle>Histori</SectionTitle>
      <div className="max-h-40 space-y-1.5 overflow-y-auto text-xs text-muted-foreground">
        {c.history.length ? (
          c.history.map((h, i) => (
            <div key={i} className="border-b border-border/40 pb-1">
              <b className="text-foreground">{h.d}</b> — {h.t}
            </div>
          ))
        ) : (
          <div>—</div>
        )}
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <Button className="flex-1" disabled={pending} onClick={save}>
          💾 Simpan Perubahan
        </Button>
        {c.archived ? (
          <>
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => run(() => setArchived(c.id, false), "Dikeluarkan dari arsip.")}
            >
              ↩ Keluarkan arsip
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={pending}
              onClick={() => {
                if (confirm("Hapus kandidat ini PERMANEN? Tidak bisa dibatalkan."))
                  run(() => deleteCandidate(c.id), "Kandidat dihapus.");
              }}
            >
              🗑 Hapus permanen
            </Button>
          </>
        ) : (
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => run(() => setArchived(c.id, true), "Diarsipkan.")}
          >
            🗄 Arsipkan
          </Button>
        )}
      </div>
    </Modal>
  );
}

// ---- field primitives ----
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mb-3">
      <label className="mb-1 block text-xs font-semibold">{label}</label>
      {children}
    </div>
  );
}
function Row({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-3">{children}</div>;
}
function TextInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
    />
  );
}
function TextArea({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="min-h-[60px] w-full resize-y rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
    />
  );
}
function DateInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="date"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
    />
  );
}
function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  const opts = options.includes(value) ? options : [...options, value];
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
    >
      {opts.map((o) => (
        <option key={o} value={o}>
          {o === "" ? "— pilih —" : o}
        </option>
      ))}
    </select>
  );
}
