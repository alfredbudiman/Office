import { createClient } from "@/lib/supabase/server";
import { wibToday } from "@/lib/wib";

export type AttendanceRow = {
  id: string; user_id: string; tanggal: string;
  clock_in: string | null; clock_out: string | null;
  progress_summary: string | null;
};

export async function getTodayAttendance(userId: string): Promise<AttendanceRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("attendance")
    .select("id, user_id, tanggal, clock_in, clock_out, progress_summary")
    .eq("user_id", userId)
    .eq("tanggal", wibToday())
    .maybeSingle();
  return (data as AttendanceRow) ?? null;
}

export async function listAttendance(from: string, to: string, userId?: string): Promise<AttendanceRow[]> {
  const supabase = await createClient();
  let q = supabase
    .from("attendance")
    .select("id, user_id, tanggal, clock_in, clock_out, progress_summary")
    .gte("tanggal", from)
    .lte("tanggal", to)
    .order("tanggal", { ascending: false });
  if (userId) q = q.eq("user_id", userId);
  const { data } = await q;
  return (data ?? []) as AttendanceRow[];
}
