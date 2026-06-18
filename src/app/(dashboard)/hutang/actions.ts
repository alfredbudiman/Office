"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Category } from "@/lib/debt";

function rev() { revalidatePath("/hutang"); }
function num(v: FormDataEntryValue | null, def = 0) { const n = Number(String(v ?? "")); return Number.isFinite(n) ? n : def; }

export async function addPerson(_prev: unknown, formData: FormData) {
  const actor = await requireRole("owner", "finance");
  const name = String(formData.get("name") ?? "").trim();
  const monthly_pa = num(formData.get("monthly_pa"));
  if (!name) return { ok: false, error: "Nama wajib diisi" };
  const supabase = await createClient();
  const { error } = await supabase.from("debt_people").insert({ name, monthly_pa, created_by: actor.id });
  if (error) return { ok: false, error: error.message };
  rev();
  return { ok: true };
}

export async function updatePerson(id: string, name: string, monthlyPa: number, active: boolean) {
  await requireRole("owner", "finance");
  const supabase = await createClient();
  const { error } = await supabase.from("debt_people").update({ name: name.trim(), monthly_pa: monthlyPa, active }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  rev();
  return { ok: true };
}

/** Tambah acara Monday Lab. entriesJson = [{person_id, pax}]. */
export async function addMondayLab(date: string, pricePerBox: number, entriesJson: string) {
  const actor = await requireRole("owner", "finance");
  if (!date) return { ok: false, error: "Tanggal wajib" };
  let entries: { person_id: string; pax: number }[];
  try { entries = JSON.parse(entriesJson); } catch { return { ok: false, error: "Data pax tidak valid" }; }
  const rows = entries
    .filter((e) => e.pax > 0)
    .map((e) => ({
      person_id: e.person_id, category: "monday_lab" as const, occurred_on: date,
      qty: e.pax, unit_price: pricePerBox, amount: e.pax * pricePerBox, created_by: actor.id,
    }));
  if (rows.length === 0) return { ok: false, error: "Isi minimal 1 orang dengan pax > 0" };
  const supabase = await createClient();
  const { error } = await supabase.from("debt_charges").insert(rows);
  if (error) return { ok: false, error: error.message };
  rev();
  return { ok: true };
}

/** Pastikan tiap orang aktif punya tagihan PA untuk bulan ini (auto dari monthly_pa). */
export async function ensurePaEntries(month: string) {
  await requireRole("owner", "finance");
  if (!/^\d{4}-\d{2}$/.test(month)) return { ok: false, error: "Bulan tidak valid" };
  const occurred_on = `${month}-01`;
  const supabase = await createClient();
  const [{ data: people }, { data: existing }] = await Promise.all([
    supabase.from("debt_people").select("id, monthly_pa").eq("active", true),
    supabase.from("debt_charges").select("person_id").eq("category", "pa").eq("occurred_on", occurred_on),
  ]);
  const have = new Set((existing ?? []).map((r: { person_id: string }) => r.person_id));
  const rows = ((people ?? []) as { id: string; monthly_pa: number | string }[])
    .filter((p) => !have.has(p.id))
    .map((p) => ({
      person_id: p.id, category: "pa" as const, occurred_on,
      qty: 1, unit_price: Number(p.monthly_pa), amount: Number(p.monthly_pa),
    }));
  if (rows.length > 0) {
    const { error } = await supabase.from("debt_charges").insert(rows);
    if (error) return { ok: false, error: error.message };
    rev();
  }
  return { ok: true, added: rows.length };
}

export async function updateChargeAmount(id: string, amount: number) {
  await requireRole("owner", "finance");
  const supabase = await createClient();
  const { error } = await supabase.from("debt_charges").update({ amount, unit_price: amount, qty: 1 }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  rev();
  return { ok: true };
}

export async function addLainnya(formData: FormData) {
  const actor = await requireRole("owner", "finance");
  const person_id = String(formData.get("person_id") ?? "");
  const qty = num(formData.get("qty"), 1) || 1;
  const unit_price = num(formData.get("unit_price"));
  const description = String(formData.get("description") ?? "").trim() || null;
  const date = String(formData.get("date") ?? "");
  if (!person_id) return { ok: false, error: "Pilih orang" };
  if (!date) return { ok: false, error: "Tanggal wajib" };
  const supabase = await createClient();
  const { error } = await supabase.from("debt_charges").insert({
    person_id, category: "lainnya", occurred_on: date, qty, unit_price, amount: qty * unit_price, description, created_by: actor.id,
  });
  if (error) return { ok: false, error: error.message };
  rev();
  return { ok: true };
}

export async function togglePaid(id: string, paid: boolean) {
  await requireRole("owner", "finance");
  const supabase = await createClient();
  const { error } = await supabase.from("debt_charges")
    .update({ paid, paid_at: paid ? new Date().toISOString() : null }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  rev();
  return { ok: true };
}

export async function deleteCharge(id: string) {
  await requireRole("owner", "finance");
  const supabase = await createClient();
  const { error } = await supabase.from("debt_charges").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  rev();
  return { ok: true };
}

/** Hapus seluruh kolom: 1 tanggal (monday/lainnya) atau 1 bulan (pa). */
export async function deleteColumn(category: Category, key: string) {
  await requireRole("owner", "finance");
  const supabase = await createClient();
  let q = supabase.from("debt_charges").delete().eq("category", category);
  if (category === "pa") {
    const [y, m] = key.split("-").map(Number);
    const start = `${key}-01`;
    const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
    q = q.gte("occurred_on", start).lt("occurred_on", next);
  } else {
    q = q.eq("occurred_on", key);
  }
  const { error } = await q;
  if (error) return { ok: false, error: error.message };
  rev();
  return { ok: true };
}
