import { createClient } from "@/lib/supabase/server";
import type { DebtPerson, DebtCharge } from "@/lib/debt";

export async function listPeople(): Promise<DebtPerson[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("debt_people").select("id, name, monthly_pa, active").order("name");
  return (data ?? []).map((p: { id: string; name: string; monthly_pa: number | string; active: boolean }) => ({
    id: p.id, name: p.name, monthly_pa: Number(p.monthly_pa), active: p.active,
  }));
}

export async function listCharges(): Promise<DebtCharge[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("debt_charges")
    .select("id, person_id, category, occurred_on, qty, unit_price, amount, description, paid, paid_at")
    .order("occurred_on", { ascending: false });
  return (data ?? []).map((c: Record<string, unknown>) => ({
    id: c.id as string,
    person_id: c.person_id as string,
    category: c.category as DebtCharge["category"],
    occurred_on: c.occurred_on as string,
    qty: Number(c.qty),
    unit_price: Number(c.unit_price),
    amount: Number(c.amount),
    description: (c.description as string) ?? null,
    paid: c.paid as boolean,
    paid_at: (c.paid_at as string) ?? null,
  }));
}
