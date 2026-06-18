import { describe, it, expect } from "vitest";
import {
  rupiah, personTotals, totalUnpaid, generateMondayLabText, generatePaText, generateRekapText,
  type DebtPerson, type DebtCharge,
} from "@/lib/debt";

const people: DebtPerson[] = [
  { id: "a", name: "Andi", monthly_pa: 350000, active: true },
  { id: "b", name: "Budi", monthly_pa: 500000, active: true },
];

function charge(p: Partial<DebtCharge>): DebtCharge {
  return { id: Math.random().toString(36).slice(2), person_id: "a", category: "monday_lab", occurred_on: "2026-06-15", qty: 2, unit_price: 25000, amount: 50000, description: null, paid: false, paid_at: null, ...p };
}

describe("rupiah", () => {
  it("format Rupiah Indonesia", () => {
    expect(rupiah(25000)).toBe("Rp25.000");
    expect(rupiah(350000)).toBe("Rp350.000");
  });
});

describe("personTotals & totalUnpaid", () => {
  const charges = [
    charge({ person_id: "a", amount: 50000 }),
    charge({ person_id: "a", category: "pa", amount: 350000, paid: true }), // lunas → tidak dihitung
    charge({ person_id: "b", amount: 75000, qty: 3 }),
  ];
  it("abaikan yang sudah lunas", () => {
    expect(totalUnpaid(charges)).toBe(50000 + 75000);
    const t = personTotals(people, charges);
    expect(t.find((x) => x.id === "a")!.total).toBe(50000);
    expect(t.find((x) => x.id === "b")!.total).toBe(75000);
  });
  it("filter per kategori", () => {
    expect(totalUnpaid(charges, "monday_lab")).toBe(125000);
    expect(totalUnpaid(charges, "pa")).toBe(0); // yang pa sudah lunas
  });
});

describe("generateMondayLabText", () => {
  it("kelompok per tanggal + subtotal + total, hanya belum lunas", () => {
    const t = generateMondayLabText(people, [
      charge({ person_id: "a", occurred_on: "2026-06-15", qty: 2, amount: 50000 }),
      charge({ person_id: "b", occurred_on: "2026-06-15", qty: 3, amount: 75000 }),
      charge({ person_id: "a", occurred_on: "2026-06-22", qty: 1, amount: 25000, paid: true }),
    ]);
    expect(t).toContain("Senin, 15 Jun 2026");
    expect(t).toContain("Andi: 2 box → Rp50.000");
    expect(t).toContain("TOTAL belum lunas: Rp125.000");
    expect(t).not.toContain("22 Jun"); // yang lunas tak muncul
  });
});

describe("generatePaText", () => {
  it("kelompok per bulan", () => {
    const t = generatePaText(people, [
      charge({ person_id: "a", category: "pa", occurred_on: "2026-06-01", qty: 1, unit_price: 350000, amount: 350000 }),
    ]);
    expect(t).toContain("Juni 2026");
    expect(t).toContain("Andi: Rp350.000");
  });
});

describe("generateRekapText", () => {
  it("per orang dengan total + rincian kategori", () => {
    const t = generateRekapText(people, [
      charge({ person_id: "a", category: "monday_lab", amount: 50000 }),
      charge({ person_id: "a", category: "pa", occurred_on: "2026-06-01", amount: 350000 }),
    ]);
    expect(t).toContain("Andi");
    expect(t).toContain("TOTAL Rp400.000");
    expect(t).toContain("Monday Lab");
    expect(t).toContain("PA");
  });
});
