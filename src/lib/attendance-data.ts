import { createClient } from "@/lib/supabase/server";

export type AttendanceRow = {
  id: string; user_id: string; tanggal: string;
  clock_in: string | null; clock_out: string | null;
};

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function getTodayAttendance(userId: string): Promise<AttendanceRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("attendance")
    .select("id, user_id, tanggal, clock_in, clock_out")
    .eq("user_id", userId)
    .eq("tanggal", todayStr())
    .maybeSingle();
  return (data as AttendanceRow) ?? null;
}

export async function listAttendance(from: string, to: string, userId?: string): Promise<AttendanceRow[]> {
  const supabase = await createClient();
  let q = supabase
    .from("attendance")
    .select("id, user_id, tanggal, clock_in, clock_out")
    .gte("tanggal", from)
    .lte("tanggal", to)
    .order("tanggal", { ascending: false });
  if (userId) q = q.eq("user_id", userId);
  const { data } = await q;
  return (data ?? []) as AttendanceRow[];
}
