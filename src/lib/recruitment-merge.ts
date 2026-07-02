import type { SupabaseClient } from "@supabase/supabase-js";
import { normWa, type CandidateRow, type HistoryEntry } from "@/lib/recruitment";

const TABLE = "recruitment_candidates";

function jakartaToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
function histStamp(): string {
  return new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date());
}
function withHistory(history: HistoryEntry[] | null, text: string): HistoryEntry[] {
  const h = Array.isArray(history) ? history.slice() : [];
  h.unshift({ d: histStamp(), t: text });
  return h;
}
async function nextCandCode(supa: SupabaseClient): Promise<string> {
  const { data } = await supa.rpc("recruitment_next_code");
  if (typeof data === "string" && data) return data;
  const { count } = await supa.from(TABLE).select("id", { count: "exact", head: true });
  return "CND-" + String((count ?? 0) + 1).padStart(4, "0");
}

// camelCase (format ekspor/dashboard) -> kolom DB
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

/** Import-merge non-destruktif: tambah kandidat baru + isi field kosong; TIDAK menimpa data lama.
 *  Dipakai UI (client user) & cron (service role). */
export async function importMergeCore(
  supabase: SupabaseClient,
  incoming: Record<string, unknown>[],
): Promise<{ ok: boolean; added: number; updated: number; error?: string }> {
  if (!Array.isArray(incoming)) return { ok: false, added: 0, updated: 0, error: "Format salah." };
  const { data } = await supabase.from(TABLE).select("*");
  const existing = (data as CandidateRow[] | null) ?? [];
  const today = jakartaToday();
  let added = 0;
  let updated = 0;

  for (const inc of incoming) {
    const incWa = normWa(String(inc.whatsapp ?? ""));
    let ex = existing.find((c) => normWa(c.whatsapp) === incWa && incWa !== "");
    if (!ex && inc.name) {
      ex = existing.find((c) => (c.name || "").trim().toLowerCase() === String(inc.name).trim().toLowerCase());
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
        patch.history = withHistory(ex.history, "Data dilengkapi dari sync");
        await supabase.from(TABLE).update(patch).eq("id", ex.id);
        updated++;
      }
    } else {
      const code = await nextCandCode(supabase);
      const insert: Record<string, unknown> = {
        code, stage: "sourcing", outcome: "active", max_reached: 0,
        date_in: today, stage_since: today, last_updated: today,
      };
      for (const [k, col] of Object.entries(COL)) {
        if (k in inc && inc[k] !== "") insert[col] = inc[k];
      }
      if (!insert.name || !insert.whatsapp) continue;
      insert.history = withHistory(Array.isArray(inc.history) ? (inc.history as HistoryEntry[]) : [], "Ditambahkan via sync");
      await supabase.from(TABLE).insert(insert);
      added++;
    }
  }
  return { ok: true, added, updated };
}
