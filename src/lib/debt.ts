export type Category = "monday_lab" | "pa" | "lainnya";

export type DebtPerson = { id: string; name: string; monthly_pa: number; active: boolean };
export type DebtCharge = {
  id: string;
  person_id: string;
  category: Category;
  occurred_on: string; // YYYY-MM-DD
  qty: number;
  unit_price: number;
  amount: number;
  description: string | null;
  paid: boolean;
  paid_at: string | null;
};

export const DEFAULT_BOX_PRICE = 25000;
const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const MON_SHORT = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

export function rupiah(n: number): string {
  return "Rp" + Math.round(n).toLocaleString("id-ID");
}
export function dayLabel(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return `${d} ${MON_SHORT[m - 1]} ${y}`;
}
export function monthLabel(ymd: string): string {
  const [y, m] = ymd.split("-").map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

const unpaid = (c: DebtCharge) => !c.paid;
const byPerson = (people: DebtPerson[]) => new Map(people.map((p) => [p.id, p.name]));

/** Total belum-lunas per orang, hanya yang punya tagihan. */
export function personTotals(people: DebtPerson[], charges: DebtCharge[]): { id: string; name: string; total: number }[] {
  const sum = new Map<string, number>();
  for (const c of charges) if (unpaid(c)) sum.set(c.person_id, (sum.get(c.person_id) ?? 0) + c.amount);
  return people
    .filter((p) => (sum.get(p.id) ?? 0) > 0)
    .map((p) => ({ id: p.id, name: p.name, total: sum.get(p.id) ?? 0 }));
}

export function totalUnpaid(charges: DebtCharge[], category?: Category): number {
  return charges.filter((c) => unpaid(c) && (!category || c.category === category)).reduce((a, c) => a + c.amount, 0);
}

// ---------- Generator teks (hanya yang belum lunas) ----------

export function generateMondayLabText(people: DebtPerson[], charges: DebtCharge[]): string {
  const name = byPerson(people);
  const rows = charges.filter((c) => c.category === "monday_lab" && unpaid(c));
  if (rows.length === 0) return "🍱 MONDAY LAB\n(tidak ada tagihan belum lunas)";
  const byDate = new Map<string, DebtCharge[]>();
  for (const c of rows) (byDate.get(c.occurred_on) ?? byDate.set(c.occurred_on, []).get(c.occurred_on)!).push(c);
  const dates = [...byDate.keys()].sort();
  const lines = ["🍱 MONDAY LAB (belum lunas)"];
  for (const d of dates) {
    const list = byDate.get(d)!;
    const price = list[0]?.unit_price ?? DEFAULT_BOX_PRICE;
    let sub = 0;
    lines.push("", `📅 Senin, ${dayLabel(d)} — ${rupiah(price)}/box`);
    for (const c of list) {
      sub += c.amount;
      lines.push(`• ${name.get(c.person_id) ?? "?"}: ${c.qty} box → ${rupiah(c.amount)}`);
    }
    lines.push(`Subtotal: ${rupiah(sub)}`);
  }
  lines.push("", `TOTAL belum lunas: ${rupiah(totalUnpaid(rows))}`);
  return lines.join("\n");
}

export function generatePaText(people: DebtPerson[], charges: DebtCharge[]): string {
  const name = byPerson(people);
  const rows = charges.filter((c) => c.category === "pa" && unpaid(c));
  if (rows.length === 0) return "💳 PA\n(tidak ada tagihan belum lunas)";
  const byMonth = new Map<string, DebtCharge[]>();
  for (const c of rows) { const key = c.occurred_on.slice(0, 7); (byMonth.get(key) ?? byMonth.set(key, []).get(key)!).push(c); }
  const months = [...byMonth.keys()].sort();
  const lines = ["💳 PA (belum lunas)"];
  for (const mk of months) {
    const list = byMonth.get(mk)!;
    let sub = 0;
    lines.push("", `📅 ${monthLabel(mk + "-01")}`);
    for (const c of list) { sub += c.amount; lines.push(`• ${name.get(c.person_id) ?? "?"}: ${rupiah(c.amount)}`); }
    lines.push(`Subtotal: ${rupiah(sub)}`);
  }
  lines.push("", `TOTAL belum lunas: ${rupiah(totalUnpaid(rows))}`);
  return lines.join("\n");
}

export function generateLainnyaText(people: DebtPerson[], charges: DebtCharge[]): string {
  const name = byPerson(people);
  const rows = charges.filter((c) => c.category === "lainnya" && unpaid(c));
  if (rows.length === 0) return "📦 LAINNYA\n(tidak ada tagihan belum lunas)";
  const lines = ["📦 LAINNYA (belum lunas)", ""];
  for (const c of rows) {
    const det = c.qty > 1 ? ` (${c.qty} × ${rupiah(c.unit_price)})` : "";
    const desc = c.description ? ` — ${c.description}` : "";
    lines.push(`• ${name.get(c.person_id) ?? "?"}${desc}${det} = ${rupiah(c.amount)}`);
  }
  lines.push("", `TOTAL belum lunas: ${rupiah(totalUnpaid(rows))}`);
  return lines.join("\n");
}

export function generateRekapText(people: DebtPerson[], charges: DebtCharge[]): string {
  const totals = personTotals(people, charges);
  if (totals.length === 0) return "🧾 REKAP HUTANG\n(semua sudah lunas / belum ada tagihan)";
  const lines = ["🧾 REKAP HUTANG (belum lunas) — per orang"];
  for (const p of totals) {
    lines.push("", `*${p.name}* — TOTAL ${rupiah(p.total)}`);
    for (const cat of ["monday_lab", "pa", "lainnya"] as Category[]) {
      const rows = charges.filter((c) => c.person_id === p.id && c.category === cat && unpaid(c));
      if (rows.length === 0) continue;
      const sub = rows.reduce((a, c) => a + c.amount, 0);
      const label = cat === "monday_lab" ? "Monday Lab" : cat === "pa" ? "PA" : "Lainnya";
      const detail = rows
        .map((c) => cat === "monday_lab" ? `${dayLabel(c.occurred_on)} ${c.qty}box`
          : cat === "pa" ? monthLabel(c.occurred_on)
          : (c.description ?? "item"))
        .join(", ");
      lines.push(`  • ${label}: ${rupiah(sub)} (${detail})`);
    }
  }
  lines.push("", `TOTAL KESELURUHAN: ${rupiah(totalUnpaid(charges))}`);
  return lines.join("\n");
}
