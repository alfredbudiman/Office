import { requireRole } from "@/lib/auth";
import { getSetting } from "@/lib/settings";
import { createClient } from "@/lib/supabase/server";
import { rowToCandidate, type CandidateRow } from "@/lib/recruitment";
import { RecruitmentApp } from "./recruitment-app";

export const metadata = { title: "Recruitment — Sproutlab" };

export default async function RecruitmentPage() {
  // Akses dibatasi role: owner (Alfred) & hrd (Sabina). Editor tidak bisa masuk.
  await requireRole("owner", "hrd");
  const supabase = await createClient();
  const { data } = await supabase
    .from("recruitment_candidates")
    .select("*")
    .order("date_in", { ascending: false });

  const candidates = ((data as CandidateRow[] | null) ?? []).map(rowToCandidate);

  const followUpDays = parseInt((await getSetting("recruitment_follow_up_days")) ?? "3") || 3;
  const staleDays = parseInt((await getSetting("recruitment_stale_days")) ?? "7") || 7;

  return (
    <RecruitmentApp
      candidates={candidates}
      followUpDays={followUpDays}
      staleDays={staleDays}
    />
  );
}
