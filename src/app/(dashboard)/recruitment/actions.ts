"use server";

import { revalidatePath } from "next/cache";
import { requireProfile, requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { setSetting, getSetting } from "@/lib/settings";
import { fetchHrDatabase, DEFAULT_DRIVE_FILE_ID } from "@/lib/recruitment-drive";
import {
  stageIndex,
  stageLabel,
  normWa,
  addDays,
  type Stage,
  type Outcome,
  type HistoryEntry,
  type CandidateRow,
} from "@/lib/recruitment";

const TABLE = "recruitment_candidates";

type Result = { ok: boolean; error?: string };

// "Hari ini" menurut zona Asia/Jakarta (server bisa UTC) — YYYY-MM-DD.
function jakartaToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

// Label histori: "16 Jun, 14:30" gaya id-ID, zona Jakarta.
function histStamp(): string {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());
}

function withHistory(history: HistoryEntry[] | null, text: string): HistoryEntry[] {
  const h = Array.isArray(history) ? history.slice() : [];
  h.unshift({ d: histStamp(), t: text });
  return h;
}

async function getRow(id: string): Promise<CandidateRow | null> {
  const supabase = await createClient();
  const { data } = await supabase.from(TABLE).select("*").eq("id", id).maybeSingle();
  return (data as CandidateRow | null) ?? null;
}

type Supa = Awaited<ReturnType<typeof createClient>>;

async function nextCandCode(supa: Supa): Promise<string> {
  const { data } = await supa.rpc("recruitment_next_code");
  if (typeof data === "string" && data) return data;
  // fallback bila RPC belum ada
  const { count } = await supa.from(TABLE).select("id", { count: "exact", head: true });
  return "CND-" + String((count ?? 0) + 1).padStart(4, "0");
}

async function nextAgentCode(supa: Supa, fallbackCode: string): Promise<string> {
  const { data } = await supa.rpc("recruitment_next_agent_code");
  if (typeof data === "string" && data) return data;
  return "AGT-" + fallbackCode.replace(/\D/g, "");
}

async function followUpDays(): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "recruitment_follow_up_days")
    .maybeSingle();
  const n = parseInt((data as { value: string } | null)?.value ?? "");
  return Number.isFinite(n) && n > 0 ? n : 3;
}

// Field yang boleh di-update bebas dari modal: camelCase -> kolom DB.
const EDITABLE: Record<string, string> = {
  email: "email",
  domisili: "domisili",
  birth: "birth",
  marital: "marital",
  education: "education",
  jurusan: "jurusan",
  universitas: "universitas",
  salesExp: "sales_exp",
  experience: "experience",
  cvNote: "cv_note",
  interest: "interest",
  followNote: "follow_note",
  lastContact: "last_contact",
  nextFollowUp: "next_follow_up",
  interviewAt: "interview_at",
  scoreHR: "score_hr",
  noteHR: "note_hr",
  recHR: "rec_hr",
  noteAlfred: "note_alfred",
  docLink: "doc_link",
  joinDate: "join_date",
  contractStatus: "contract_status",
  contractLink: "contract_link",
  agentStatus: "agent_status",
};

// kolom date: string kosong harus jadi null
const DATE_COLS = new Set(["birth", "last_contact", "next_follow_up", "join_date"]);

export async function createCandidate(input: {
  name: string;
  whatsapp: string;
  source: string;
  jalur: string;
}) {
  await requireProfile();
  const name = input.name.trim();
  const wa = input.whatsapp.trim();
  if (!name || !wa) return { ok: false, error: "Nama & WhatsApp wajib diisi." };

  const supabase = await createClient();
  const { data: existing } = await supabase.from(TABLE).select("code, name, stage, whatsapp");
  const dup = (existing as Pick<CandidateRow, "code" | "name" | "stage" | "whatsapp">[] | null)?.find(
    (c) => normWa(c.whatsapp) === normWa(wa) && normWa(wa) !== "",
  );
  if (dup) {
    return {
      ok: false,
      error: `Nomor ini sudah terdaftar: ${dup.name} (${dup.code}, ${stageLabel(dup.stage)}).`,
    };
  }

  const today = jakartaToday();
  const supa = await createClient();
  const code = await nextCandCode(supa);

  const { error } = await supa.from(TABLE).insert({
    code,
    name,
    whatsapp: wa,
    source: input.source || null,
    jalur: input.jalur || null,
    stage: "sourcing",
    outcome: "active",
    max_reached: 0,
    date_in: today,
    stage_since: today,
    last_updated: today,
    history: [{ d: histStamp(), t: "Kandidat dibuat (Sourcing Aktif)" + (input.jalur ? ` · Jalur: ${input.jalur}` : "") }],
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/recruitment");
  return { ok: true };
}

export async function updateCandidate(id: string, fields: Record<string, string>) {
  await requireProfile();
  const row = await getRow(id);
  if (!row) return { ok: false, error: "Kandidat tidak ditemukan." };

  const patch: Record<string, unknown> = {};
  for (const [k, col] of Object.entries(EDITABLE)) {
    if (k in fields) {
      const v = fields[k];
      if (col === "score_hr") patch[col] = v === "" ? null : parseInt(v) || null;
      else if (DATE_COLS.has(col)) patch[col] = v === "" ? null : v;
      else patch[col] = v;
    }
  }

  let history = row.history;
  // jalur diubah → catat histori
  if ("jalur" in fields && fields.jalur !== (row.jalur ?? "")) {
    history = withHistory(history, `Jalur diubah: ${row.jalur || "—"} → ${fields.jalur || "—"}`);
    patch.jalur = fields.jalur || null;
  }
  // docs (checklist)
  if ("docs" in fields) {
    try {
      patch.docs = JSON.parse(fields.docs);
    } catch {
      /* abaikan */
    }
  }

  patch.last_updated = jakartaToday();
  patch.history = history;

  const supabase = await createClient();
  const { error } = await supabase.from(TABLE).update(patch).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/recruitment");
  return { ok: true };
}

export async function moveStage(id: string, toStage: Stage): Promise<Result> {
  await requireProfile();
  const row = await getRow(id);
  if (!row || row.stage === toStage) return { ok: true };
  if (toStage === "agent") return promoteAgent(id);

  const today = jakartaToday();
  const toI = stageIndex(toStage);
  const patch: Record<string, unknown> = {
    stage: toStage,
    outcome: "active",
    max_reached: Math.max(row.max_reached ?? 0, toI),
    stage_since: today,
    last_updated: today,
    history: withHistory(row.history, `Pindah ke ${stageLabel(toStage)}`),
  };
  if (toStage === "followup" && !row.next_follow_up) {
    patch.next_follow_up = addDays(today, await followUpDays());
  }
  const supabase = await createClient();
  const { error } = await supabase.from(TABLE).update(patch).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/recruitment");
  return { ok: true };
}

export async function setOutcome(id: string, outcome: Outcome) {
  await requireProfile();
  const row = await getRow(id);
  if (!row) return { ok: false, error: "Tidak ditemukan." };
  const text = outcome === "talent_pool" ? "Masuk Talent Pool" : "Ditandai Tidak Lolos";
  const supabase = await createClient();
  const { error } = await supabase
    .from(TABLE)
    .update({ outcome, last_updated: jakartaToday(), history: withHistory(row.history, text) })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/recruitment");
  return { ok: true };
}

export async function reactivate(id: string) {
  await requireProfile();
  const row = await getRow(id);
  if (!row) return { ok: false, error: "Tidak ditemukan." };
  const today = jakartaToday();
  const patch: Record<string, unknown> = {
    outcome: "active",
    archived: false,
    stage_since: today,
    last_updated: today,
    history: withHistory(row.history, `Diaktifkan kembali ke pipeline (${stageLabel(row.stage)})`),
  };
  if (row.stage === "followup" && !row.next_follow_up) {
    patch.next_follow_up = addDays(today, await followUpDays());
  }
  const supabase = await createClient();
  const { error } = await supabase.from(TABLE).update(patch).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/recruitment");
  return { ok: true };
}

export async function promoteAgent(id: string) {
  await requireProfile();
  const row = await getRow(id);
  if (!row) return { ok: false, error: "Tidak ditemukan." };
  const today = jakartaToday();
  const supabase = await createClient();

  let agentCode = row.agent_code;
  if (!agentCode) {
    agentCode = await nextAgentCode(supabase, row.code);
  }

  const { error } = await supabase
    .from(TABLE)
    .update({
      stage: "agent",
      outcome: "agent_aktif",
      max_reached: stageIndex("agent"),
      next_follow_up: null,
      stage_since: today,
      last_updated: today,
      join_date: row.join_date ?? today,
      agent_code: agentCode,
      agent_status: row.agent_status ?? "Aktif",
      history: withHistory(row.history, `Menjadi Agent Aktif (${agentCode})`),
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/recruitment");
  return { ok: true };
}

export async function setArchived(id: string, archived: boolean) {
  await requireProfile();
  const row = await getRow(id);
  if (!row) return { ok: false, error: "Tidak ditemukan." };
  const supabase = await createClient();
  const { error } = await supabase
    .from(TABLE)
    .update({
      archived,
      history: withHistory(row.history, archived ? "Diarsipkan" : "Dikeluarkan dari arsip"),
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/recruitment");
  return { ok: true };
}

export async function deleteCandidate(id: string) {
  await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.from(TABLE).delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/recruitment");
  return { ok: true };
}

export async function contactedToday(id: string) {
  await requireProfile();
  const row = await getRow(id);
  if (!row) return { ok: false, error: "Tidak ditemukan." };
  const today = jakartaToday();
  const supabase = await createClient();
  const { error } = await supabase
    .from(TABLE)
    .update({
      last_contact: today,
      next_follow_up: addDays(today, await followUpDays()),
      last_updated: today,
      history: withHistory(row.history, "Follow-up dilakukan"),
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/recruitment");
  return { ok: true };
}

export async function setInterviewDone(id: string, done: boolean) {
  await requireProfile();
  const row = await getRow(id);
  if (!row) return { ok: false, error: "Tidak ditemukan." };
  const supabase = await createClient();
  const { error } = await supabase
    .from(TABLE)
    .update({
      interview_done: done,
      last_updated: jakartaToday(),
      history: withHistory(
        row.history,
        done ? "Wawancara ditandai selesai" : "Wawancara ditandai belum dilakukan",
      ),
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/recruitment");
  return { ok: true };
}

export async function updateRecruitmentSettings(followUp: number, stale: number) {
  const profile = await requireProfile();
  await setSetting("recruitment_follow_up_days", String(Math.max(1, followUp || 3)), profile.id);
  await setSetting("recruitment_stale_days", String(Math.max(1, stale || 7)), profile.id);
  revalidatePath("/recruitment");
  return { ok: true };
}

// Import-merge dari file JSON (format dashboard lama). Tambah yang baru, lengkapi yang kosong.
export async function importMerge(
  incoming: Record<string, unknown>[],
): Promise<{ ok: boolean; added: number; updated: number; error?: string }> {
  await requireProfile();
  if (!Array.isArray(incoming)) return { ok: false, added: 0, updated: 0, error: "Format salah." };
  const supabase = await createClient();
  const { data } = await supabase.from(TABLE).select("*");
  const existing = (data as CandidateRow[] | null) ?? [];

  // map camelCase (file lama) -> kolom
  const COL: Record<string, string> = {
    name: "name", whatsapp: "whatsapp", email: "email", domisili: "domisili", birth: "birth",
    marital: "marital", education: "education", jurusan: "jurusan", universitas: "universitas",
    salesExp: "sales_exp", experience: "experience", cvNote: "cv_note", source: "source",
    jalur: "jalur", stage: "stage", outcome: "outcome", maxReached: "max_reached",
    stageSince: "stage_since", interest: "interest", followNote: "follow_note",
    lastContact: "last_contact", nextFollowUp: "next_follow_up", interviewAt: "interview_at",
    interviewDone: "interview_done", scoreHR: "score_hr", noteHR: "note_hr", recHR: "rec_hr",
    noteAlfred: "note_alfred", docLink: "doc_link", joinDate: "join_date",
    contractStatus: "contract_status", contractLink: "contract_link", agentStatus: "agent_status",
    dateIn: "date_in",
  };
  const today = jakartaToday();
  let added = 0;
  let updated = 0;

  for (const inc of incoming) {
    const incWa = normWa(String(inc.whatsapp ?? ""));
    let ex = existing.find((c) => normWa(c.whatsapp) === incWa && incWa !== "");
    if (!ex && inc.name) {
      ex = existing.find(
        (c) => (c.name || "").trim().toLowerCase() === String(inc.name).trim().toLowerCase(),
      );
    }
    if (ex) {
      const patch: Record<string, unknown> = {};
      const exRec = ex as unknown as Record<string, unknown>;
      for (const [k, col] of Object.entries(COL)) {
        if (k in inc && (exRec[col] === undefined || exRec[col] === "" || exRec[col] === null)) {
          patch[col] = inc[k] === "" ? null : inc[k];
        }
      }
      if (Object.keys(patch).length) {
        patch.last_updated = today;
        patch.history = withHistory(ex.history, "Data dilengkapi dari import");
        await supabase.from(TABLE).update(patch).eq("id", ex.id);
        updated++;
      }
    } else {
      const code = await nextCandCode(supabase);
      const insert: Record<string, unknown> = {
        code,
        stage: "sourcing",
        outcome: "active",
        max_reached: 0,
        date_in: today,
        stage_since: today,
        last_updated: today,
      };
      for (const [k, col] of Object.entries(COL)) {
        if (k in inc && inc[k] !== "") insert[col] = inc[k];
      }
      if (!insert.name || !insert.whatsapp) continue;
      insert.history = withHistory(
        Array.isArray(inc.history) ? (inc.history as HistoryEntry[]) : [],
        "Ditambahkan via import (gabung)",
      );
      await supabase.from(TABLE).insert(insert);
      added++;
    }
  }
  revalidatePath("/recruitment");
  return { ok: true, added, updated };
}

// Sync dari Google Drive HR (Cowork): tarik JSON publik lalu import-merge (non-destruktif).
export async function syncFromDrive(): Promise<{ ok: boolean; added?: number; updated?: number; exported?: string | null; error?: string }> {
  const profile = await requireRole("owner", "hrd");
  const fileId = (await getSetting("recruitment_drive_file_id")) || DEFAULT_DRIVE_FILE_ID;
  const fetched = await fetchHrDatabase(fileId);
  if (!fetched.ok) return { ok: false, error: fetched.error };

  const res = await importMerge(fetched.data.cands);
  if (!res.ok) return { ok: false, error: res.error };

  await setSetting("recruitment_last_sync", new Date().toISOString(), profile.id);
  if (fetched.data.exported) await setSetting("recruitment_data_date", fetched.data.exported, profile.id);
  revalidatePath("/recruitment");
  return { ok: true, added: res.added, updated: res.updated, exported: fetched.data.exported };
}
