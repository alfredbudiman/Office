// Domain recruitment — port dari "Dashboard Recruitment Sproutlab.html".
// Helper di sini murni (tanpa I/O) supaya gampang diuji & dipakai server + client.

export type Stage =
  | "sourcing"
  | "screening"
  | "followup"
  | "interview_hr"
  | "interview_alfred"
  | "onboarding"
  | "agent";

export type Outcome = "active" | "talent_pool" | "tidak_lolos" | "agent_aktif";

export const STAGES: { k: Stage; l: string }[] = [
  { k: "sourcing", l: "Sourcing Aktif" },
  { k: "screening", l: "Screening CV & Profil" },
  { k: "followup", l: "Follow Up & Pendekatan" },
  { k: "interview_hr", l: "Interview HR" },
  { k: "interview_alfred", l: "Interview Pak Alfred" },
  { k: "onboarding", l: "Onboarding" },
  { k: "agent", l: "Agent Aktif" },
];

export const SOURCES = [
  "WhatsApp",
  "Instagram",
  "LinkedIn",
  "Referral",
  "Glints",
  "Event",
  "Walk-in",
];

export const JALUR = ["Freelance", "Prohire Sprout", "Prohire Prudential"];

export const DOCS: { k: string; l: string; opt?: boolean }[] = [
  { k: "selfie", l: "Foto selfie" },
  { k: "ktp", l: "KTP calon agen" },
  { k: "ktp_pasangan", l: "KTP pasangan (bila menikah)", opt: true },
  { k: "ijazah_kk", l: "Ijazah / KK" },
  { k: "tabungan", l: "Buku tabungan" },
  { k: "npwp", l: "NPWP (bila ada)", opt: true },
];

// label + warna (badge variant via class) untuk tiap outcome
export const OUTCOME_TAG: Record<Outcome, { label: string; tone: string }> = {
  active: { label: "Aktif", tone: "active" },
  talent_pool: { label: "Talent Pool", tone: "talent" },
  tidak_lolos: { label: "Tidak Lolos", tone: "fail" },
  agent_aktif: { label: "Agent Aktif", tone: "agent" },
};

export type HistoryEntry = { d: string; t: string };

export type Candidate = {
  id: string;
  code: string;
  name: string;
  whatsapp: string;
  email: string;
  domisili: string;
  birth: string;
  marital: string;
  education: string;
  jurusan: string;
  universitas: string;
  salesExp: string;
  experience: string;
  cvNote: string;
  source: string;
  jalur: string;
  stage: Stage;
  outcome: Outcome;
  maxReached: number;
  archived: boolean;
  dateIn: string;
  stageSince: string;
  lastUpdated: string;
  interest: string;
  followNote: string;
  lastContact: string;
  nextFollowUp: string;
  interviewAt: string;
  interviewDone: boolean;
  scoreHR: string;
  noteHR: string;
  recHR: string;
  noteAlfred: string;
  docs: Record<string, boolean>;
  docLink: string;
  joinDate: string;
  contractStatus: string;
  contractLink: string;
  msFirstOffice: string;
  msAAJI: string;
  msFirstClosing: string;
  agentCode: string;
  agentStatus: string;
  history: HistoryEntry[];
};

// Bentuk baris mentah dari Supabase (snake_case, banyak nullable).
export type CandidateRow = {
  id: string;
  code: string;
  name: string;
  whatsapp: string;
  email: string | null;
  domisili: string | null;
  birth: string | null;
  marital: string | null;
  education: string | null;
  jurusan: string | null;
  universitas: string | null;
  sales_exp: string | null;
  experience: string | null;
  cv_note: string | null;
  source: string | null;
  jalur: string | null;
  stage: Stage;
  outcome: Outcome;
  max_reached: number;
  archived: boolean;
  date_in: string;
  stage_since: string | null;
  last_updated: string | null;
  interest: string | null;
  follow_note: string | null;
  last_contact: string | null;
  next_follow_up: string | null;
  interview_at: string | null;
  interview_done: boolean;
  score_hr: number | null;
  note_hr: string | null;
  rec_hr: string | null;
  note_alfred: string | null;
  docs: Record<string, boolean> | null;
  doc_link: string | null;
  join_date: string | null;
  contract_status: string | null;
  contract_link: string | null;
  ms_first_office: string | null;
  ms_aaji: string | null;
  ms_first_closing: string | null;
  agent_code: string | null;
  agent_status: string | null;
  history: HistoryEntry[] | null;
};

const s = (v: string | null | undefined) => v ?? "";

export function rowToCandidate(r: CandidateRow): Candidate {
  return {
    id: r.id,
    code: r.code,
    name: r.name,
    whatsapp: r.whatsapp,
    email: s(r.email),
    domisili: s(r.domisili),
    birth: s(r.birth),
    marital: s(r.marital),
    education: s(r.education),
    jurusan: s(r.jurusan),
    universitas: s(r.universitas),
    salesExp: s(r.sales_exp),
    experience: s(r.experience),
    cvNote: s(r.cv_note),
    source: s(r.source),
    jalur: s(r.jalur),
    stage: r.stage,
    outcome: r.outcome,
    maxReached: r.max_reached ?? 0,
    archived: !!r.archived,
    dateIn: r.date_in,
    stageSince: s(r.stage_since),
    lastUpdated: s(r.last_updated),
    interest: s(r.interest),
    followNote: s(r.follow_note),
    lastContact: s(r.last_contact),
    nextFollowUp: s(r.next_follow_up),
    interviewAt: s(r.interview_at),
    interviewDone: !!r.interview_done,
    scoreHR: r.score_hr == null ? "" : String(r.score_hr),
    noteHR: s(r.note_hr),
    recHR: s(r.rec_hr),
    noteAlfred: s(r.note_alfred),
    docs: r.docs ?? {},
    docLink: s(r.doc_link),
    joinDate: s(r.join_date),
    contractStatus: s(r.contract_status),
    contractLink: s(r.contract_link),
    msFirstOffice: s(r.ms_first_office),
    msAAJI: s(r.ms_aaji),
    msFirstClosing: s(r.ms_first_closing),
    agentCode: s(r.agent_code),
    agentStatus: s(r.agent_status),
    history: Array.isArray(r.history) ? r.history : [],
  };
}

// ---- helper murni ----

export const stageIndex = (k: Stage | string): number =>
  STAGES.findIndex((x) => x.k === k);

export const stageLabel = (k: Stage | string): string =>
  STAGES.find((x) => x.k === k)?.l ?? String(k);

export function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addDays(dateStr: string, n: number): string {
  // Pakai UTC supaya tidak bergeser oleh timezone lokal (mis. WIB +7).
  const x = new Date(dateStr + "T00:00:00Z");
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
}

export function daysBetween(a: string, b: string): number {
  return Math.round(
    (new Date(b + "T00:00:00Z").getTime() - new Date(a + "T00:00:00Z").getTime()) / 86400000,
  );
}

export function normWa(v: string): string {
  return (v || "").replace(/\D/g, "").replace(/^0/, "62");
}

export function effStageSince(c: Candidate): string {
  return c.stageSince || c.lastUpdated || c.dateIn || todayStr();
}

export function daysInStage(c: Candidate, today = todayStr()): number {
  return Math.max(0, daysBetween(effStageSince(c), today));
}

export function isOverdue(c: Candidate, today = todayStr()): boolean {
  return (
    c.outcome === "active" &&
    c.stage !== "agent" &&
    !!c.nextFollowUp &&
    c.nextFollowUp <= today
  );
}

export function isStale(c: Candidate, staleDays = 7, today = todayStr()): boolean {
  return (
    c.outcome === "active" &&
    c.stage !== "agent" &&
    daysInStage(c, today) >= staleDays
  );
}

export function ivDate(c: Candidate): string {
  return c.interviewAt ? c.interviewAt.slice(0, 10) : "";
}

// Funnel: jumlah kandidat yang PERNAH mencapai tiap tahap (pakai maxReached) + conversion.
export function funnelData(
  cands: Candidate[],
): { stage: Stage; label: string; count: number; conv: number; width: number }[] {
  const reached = STAGES.map((_, i) => cands.filter((c) => (c.maxReached ?? 0) >= i).length);
  const maxv = Math.max(reached[0], 1);
  return STAGES.map((st, i) => {
    const cur = reached[i];
    const prev = i > 0 ? reached[i - 1] : cur;
    const conv = i > 0 ? (prev > 0 ? Math.round((cur / prev) * 100) : 0) : 100;
    return { stage: st.k, label: st.l, count: cur, conv, width: Math.round((cur / maxv) * 100) };
  });
}

// Kandidat per source: total (t) & jadi agent (a).
export function sourceBreakdown(cands: Candidate[]): Record<string, { t: number; a: number }> {
  const by: Record<string, { t: number; a: number }> = {};
  SOURCES.forEach((src) => (by[src] = { t: 0, a: 0 }));
  cands.forEach((c) => {
    const key = c.source || "-";
    if (!by[key]) by[key] = { t: 0, a: 0 };
    by[key].t++;
    if (c.outcome === "agent_aktif") by[key].a++;
  });
  return by;
}

export function bestSource(cands: Candidate[]): string {
  const by = sourceBreakdown(cands);
  let best = "-";
  let bestScore = -1;
  Object.entries(by).forEach(([src, v]) => {
    const sc = v.a * 1000 + v.t;
    if (v.t > 0 && sc > bestScore) {
      bestScore = sc;
      best = src;
    }
  });
  return best;
}
