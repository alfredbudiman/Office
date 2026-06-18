"use client";

import { useState, useEffect, useMemo, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, Check, Copy, Users, ChevronDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  rupiah, dayLabel, monthLabel, totalUnpaid,
  generateMondayLabText, generatePaText, generateLainnyaText, generateRekapText,
  DEFAULT_BOX_PRICE, type Category, type DebtPerson, type DebtCharge,
} from "@/lib/debt";
import {
  addPerson, updatePerson, addMondayLab, ensurePaEntries, updateChargeAmount, addLainnya, togglePaid, deleteCharge,
} from "./actions";

function wibMonth() { return new Date(new Date().getTime() + 7 * 3600000).toISOString().slice(0, 7); }
function wibDateStr() { return new Date(new Date().getTime() + 7 * 3600000).toISOString().slice(0, 10); }
const selCls = "h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";
const CAT_LABEL: Record<Category, string> = { monday_lab: "Monday Lab", pa: "PA", lainnya: "Lainnya" };
const MON_SHORT = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const VISIBLE_COLS = 4; // kolom terbaru yang ditampilkan; sisanya disembunyikan tapi tetap dihitung
function shortDay(ymd: string) { const [, m, d] = ymd.split("-").map(Number); return `${d} ${MON_SHORT[m - 1]}`; }
function shortMonth(ym: string) { const [y, m] = ym.split("-").map(Number); return `${MON_SHORT[m - 1]} '${String(y).slice(2)}`; }
function compactNum(n: number): string {
  if (n >= 1000000) return String(Math.round(n / 100000) / 10).replace(/\.0$/, "") + "jt";
  if (n >= 1000) return Math.round(n / 1000) + "k";
  return String(n);
}

type Run = (fn: () => Promise<{ ok: boolean; error?: string }>, okMsg: string) => void;

function chargeDetail(c: DebtCharge): string {
  if (c.category === "monday_lab") return `${dayLabel(c.occurred_on)} · ${c.qty} box`;
  if (c.category === "pa") return monthLabel(c.occurred_on);
  return `${c.description ?? "—"}${c.qty > 1 ? ` (${c.qty}×${rupiah(c.unit_price)})` : ""}`;
}

export function HutangView({ people, charges }: { people: DebtPerson[]; charges: DebtCharge[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [peopleOpen, setPeopleOpen] = useState(people.length === 0);
  const ensuredPa = useRef(false);

  const activePeople = people.filter((p) => p.active);

  // Auto-siapkan PA bulan ini sekali (biar muncul tanpa cape nulis).
  useEffect(() => {
    if (ensuredPa.current) return;
    ensuredPa.current = true;
    const m = wibMonth();
    if (!charges.some((c) => c.category === "pa" && c.occurred_on.slice(0, 7) === m)) {
      ensurePaEntries(m).then((r) => { if (r.ok && (r.added ?? 0) > 0) router.refresh(); });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, okMsg: string) {
    start(async () => {
      const res = await fn();
      if (!res.ok) { toast.error(res.error ?? "Gagal"); return; }
      if (okMsg) toast.success(okMsg);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Belum lunas (total)" value={rupiah(totalUnpaid(charges))} emphasis />
        <Stat label="Monday Lab" value={rupiah(totalUnpaid(charges, "monday_lab"))} />
        <Stat label="PA" value={rupiah(totalUnpaid(charges, "pa"))} />
        <Stat label="Lainnya" value={rupiah(totalUnpaid(charges, "lainnya"))} />
      </div>

      <PeopleManager people={people} open={peopleOpen} setOpen={setPeopleOpen} pending={pending} run={run} />

      <AddPanel activePeople={activePeople} pending={pending} run={run} />

      <Recap people={people} charges={charges} pending={pending} run={run} />

      <OutputPanel people={people} charges={charges} />
    </div>
  );
}

function Stat({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 shadow-card">
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`tnum mt-1 text-lg font-semibold tracking-tight ${emphasis ? "text-brand" : ""}`}>{value}</p>
    </div>
  );
}

function PeopleManager({ people, open, setOpen, pending, run }: {
  people: DebtPerson[]; open: boolean; setOpen: (b: boolean) => void; pending: boolean; run: Run;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <div className="rounded-2xl border border-border bg-card shadow-card">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between px-4 py-3">
        <span className="flex items-center gap-2 text-sm font-medium"><Users className="h-4 w-4 text-muted-foreground" /> Daftar orang ({people.length})</span>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="space-y-3 border-t border-border px-4 py-3">
          <form ref={formRef} action={(fd) => run(() => addPerson(null, fd).then((r) => { if (r.ok) formRef.current?.reset(); return r; }), "Orang ditambahkan")} className="flex flex-wrap items-end gap-2">
            <div className="space-y-1"><Label htmlFor="p-name">Nama</Label><Input id="p-name" name="name" placeholder="mis. Andi" className="w-40" /></div>
            <div className="space-y-1"><Label htmlFor="p-pa">Biaya PA / bulan</Label><Input id="p-pa" name="monthly_pa" type="number" min={0} defaultValue={0} className="w-32" /></div>
            <Button type="submit" size="sm" disabled={pending}><Plus className="mr-1 h-3.5 w-3.5" /> Tambah</Button>
          </form>
          <div className="divide-y divide-border/60">
            {people.map((p) => <PersonRow key={p.id} person={p} pending={pending} run={run} />)}
            {people.length === 0 && <p className="py-2 text-sm text-muted-foreground">Belum ada orang. Tambahkan dulu.</p>}
          </div>
        </div>
      )}
    </div>
  );
}

function PersonRow({ person, pending, run }: { person: DebtPerson; pending: boolean; run: Run }) {
  const [pa, setPa] = useState(String(person.monthly_pa));
  const dirty = Number(pa) !== person.monthly_pa;
  return (
    <div className="flex flex-wrap items-center gap-2 py-2 text-sm">
      <span className={`min-w-[6rem] flex-1 ${person.active ? "" : "text-muted-foreground line-through"}`}>{person.name}</span>
      <span className="text-xs text-muted-foreground">PA/bln</span>
      <Input type="number" min={0} value={pa} onChange={(e) => setPa(e.target.value)} className="w-28" />
      {dirty && <Button size="xs" disabled={pending} onClick={() => run(() => updatePerson(person.id, person.name, Number(pa), person.active), "Tersimpan")}>Simpan</Button>}
      <Button size="xs" variant="ghost" disabled={pending} onClick={() => run(() => updatePerson(person.id, person.name, person.monthly_pa, !person.active), person.active ? "Dinonaktifkan" : "Diaktifkan")}>
        {person.active ? "Nonaktifkan" : "Aktifkan"}
      </Button>
    </div>
  );
}

function AddPanel({ activePeople, pending, run }: { activePeople: DebtPerson[]; pending: boolean; run: Run }) {
  const [open, setOpen] = useState(true);
  const [sub, setSub] = useState<"monday" | "pa" | "lainnya">("monday");
  return (
    <div className="rounded-2xl border border-border bg-card shadow-card">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between px-4 py-3">
        <span className="flex items-center gap-2 text-sm font-medium"><Plus className="h-4 w-4 text-muted-foreground" /> Tambah catatan</span>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="border-t border-border px-4 py-3">
          <div className="mb-3 inline-flex flex-wrap gap-0.5 rounded-lg border border-border p-0.5">
            {([["monday", "Monday Lab"], ["pa", "PA"], ["lainnya", "Lainnya"]] as const).map(([k, lbl]) => (
              <button key={k} onClick={() => setSub(k)} className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${sub === k ? "bg-brand-muted text-[#1d5128]" : "text-muted-foreground hover:text-foreground"}`}>{lbl}</button>
            ))}
          </div>
          {activePeople.length === 0 ? (
            <p className="text-sm text-muted-foreground">Tambahkan orang dulu di &quot;Daftar orang&quot;.</p>
          ) : (
            <>
              {sub === "monday" && <MondayForm activePeople={activePeople} pending={pending} run={run} />}
              {sub === "pa" && <PaControl pending={pending} run={run} />}
              {sub === "lainnya" && <LainnyaForm activePeople={activePeople} pending={pending} run={run} />}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function MondayForm({ activePeople, pending, run }: { activePeople: DebtPerson[]; pending: boolean; run: Run }) {
  const [date, setDate] = useState(wibDateStr());
  const [price, setPrice] = useState(String(DEFAULT_BOX_PRICE));
  const [pax, setPax] = useState<Record<string, string>>({});
  function submit() {
    const entries = activePeople.map((p) => ({ person_id: p.id, pax: Number(pax[p.id] || 0) }));
    run(() => addMondayLab(date, Number(price), JSON.stringify(entries)).then((r) => { if (r.ok) setPax({}); return r; }), "Acara ditambahkan");
  }
  return (
    <div>
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1"><Label>Tanggal acara</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-auto" /></div>
        <div className="space-y-1"><Label>Harga / box</Label><Input type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} className="w-28" /></div>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {activePeople.map((p) => (
          <label key={p.id} className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-1.5 text-sm">
            <span className="flex-1">{p.name}</span>
            <Input type="number" min={0} placeholder="pax" value={pax[p.id] ?? ""} onChange={(e) => setPax((s) => ({ ...s, [p.id]: e.target.value }))} className="w-20" />
          </label>
        ))}
      </div>
      <Button size="sm" className="mt-3" disabled={pending} onClick={submit}><Plus className="mr-1 h-3.5 w-3.5" /> Simpan acara</Button>
    </div>
  );
}

function PaControl({ pending, run }: { pending: boolean; run: Run }) {
  const [month, setMonth] = useState(wibMonth());
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="space-y-1"><Label>Siapkan PA untuk bulan</Label><Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-auto" /></div>
      <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(() => ensurePaEntries(month), "Bulan disiapkan")}>Siapkan bulan</Button>
      <p className="w-full text-xs text-muted-foreground">PA bulan berjalan muncul otomatis. Pakai ini untuk menyiapkan bulan lain dari biaya PA tiap orang.</p>
    </div>
  );
}

function LainnyaForm({ activePeople, pending, run }: { activePeople: DebtPerson[]; pending: boolean; run: Run }) {
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <form ref={formRef} action={(fd) => run(() => addLainnya(fd).then((r) => { if (r.ok) formRef.current?.reset(); return r; }), "Item ditambahkan")} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="date" value={wibDateStr()} />
      <div className="space-y-1"><Label>Orang</Label><select name="person_id" className={`${selCls} w-40`} defaultValue=""><option value="" disabled>— pilih —</option>{activePeople.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
      <div className="space-y-1"><Label>Keterangan</Label><Input name="description" placeholder="mis. beli ATK" className="w-44" /></div>
      <div className="space-y-1"><Label>Qty</Label><Input name="qty" type="number" min={1} defaultValue={1} className="w-16" /></div>
      <div className="space-y-1"><Label>Harga</Label><Input name="unit_price" type="number" min={0} placeholder="nominal" className="w-28" /></div>
      <Button type="submit" size="sm" disabled={pending}><Plus className="mr-1 h-3.5 w-3.5" /> Tambah</Button>
    </form>
  );
}

function Recap({ people, charges, pending, run }: { people: DebtPerson[]; charges: DebtCharge[]; pending: boolean; run: Run }) {
  const [detailId, setDetailId] = useState<string | null>(null);
  const rowsPeople = people.filter((p) => p.active || charges.some((c) => c.person_id === p.id));
  const detailPerson = people.find((p) => p.id === detailId) ?? null;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-1">
        <h2 className="font-display text-lg tracking-tight">Rekap</h2>
        <span className="text-[11px] text-muted-foreground">klik sel = tandai lunas (hijau) · klik nama = detail / edit / hapus</span>
      </div>
      <MatrixSection title="Monday Lab" kind="monday_lab" people={rowsPeople} charges={charges} pending={pending} run={run} onOpenPerson={setDetailId} />
      <MatrixSection title="PA" kind="pa" people={rowsPeople} charges={charges} pending={pending} run={run} onOpenPerson={setDetailId} />
      <MatrixSection title="Lainnya" kind="lainnya" people={rowsPeople} charges={charges} pending={pending} run={run} onOpenPerson={setDetailId} />
      {detailPerson && (
        <PersonDetail person={detailPerson} charges={charges.filter((c) => c.person_id === detailPerson.id)} pending={pending} run={run} onClose={() => setDetailId(null)} />
      )}
    </div>
  );
}

function MatrixSection({ title, kind, people, charges, pending, run, onOpenPerson }: {
  title: string; kind: Category; people: DebtPerson[]; charges: DebtCharge[]; pending: boolean; run: Run; onOpenPerson: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const rows = charges.filter((c) => c.category === kind);
  const colKey = (c: DebtCharge) => (kind === "pa" ? c.occurred_on.slice(0, 7) : c.occurred_on);
  const colLabel = (k: string) => (kind === "pa" ? shortMonth(k) : shortDay(k));
  const allCols = [...new Set(rows.map(colKey))].sort().reverse(); // terbaru di kiri
  const visibleCols = expanded ? allCols : allCols.slice(0, VISIBLE_COLS);
  const hidden = allCols.length - visibleCols.length;
  const cellMap = new Map<string, DebtCharge[]>();
  rows.forEach((c) => { const k = `${c.person_id}|${colKey(c)}`; (cellMap.get(k) ?? cellMap.set(k, []).get(k)!).push(c); });
  const unpaidOf = (pid: string) => rows.filter((c) => c.person_id === pid && !c.paid).reduce((a, c) => a + c.amount, 0);
  const total = rows.filter((c) => !c.paid).reduce((a, c) => a + c.amount, 0);

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
      <div className="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-2.5">
        <span className="font-semibold">{title}</span>
        <span className="tnum text-xs text-muted-foreground">belum lunas: <span className="font-semibold text-brand">{rupiah(total)}</span></span>
      </div>
      {allCols.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">Belum ada data.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-muted/20 text-xs text-muted-foreground">
              <tr>
                <th className="sticky left-0 z-10 bg-card px-3 py-2 text-left">Nama</th>
                {visibleCols.map((k) => <th key={k} className="whitespace-nowrap px-2 py-2 text-center font-medium">{colLabel(k)}</th>)}
                {hidden > 0 && <th className="px-2 py-2 text-center"><button onClick={() => setExpanded(true)} className="font-medium text-brand hover:underline">+{hidden}</button></th>}
                <th className="px-3 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {people.map((p) => (
                <tr key={p.id} className="border-t border-border">
                  <td className="sticky left-0 z-10 whitespace-nowrap bg-card px-3 py-1.5">
                    <button onClick={() => onOpenPerson(p.id)} className="font-medium hover:text-brand hover:underline">{p.name}</button>
                  </td>
                  {visibleCols.map((k) => {
                    const cs = cellMap.get(`${p.id}|${k}`) ?? [];
                    return <td key={k} className="px-2 py-1.5 text-center">{cs.length ? <MatrixCell charges={cs} kind={kind} pending={pending} run={run} /> : <span className="text-muted-foreground/25">·</span>}</td>;
                  })}
                  {hidden > 0 && <td className="px-2 py-1.5 text-center text-muted-foreground/40">…</td>}
                  <td className="tnum px-3 py-1.5 text-right font-medium">{rupiah(unpaidOf(p.id))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {expanded && allCols.length > VISIBLE_COLS && (
        <button onClick={() => setExpanded(false)} className="w-full border-t border-border py-1.5 text-xs text-muted-foreground hover:text-foreground">Tampilkan lebih sedikit</button>
      )}
    </div>
  );
}

function MatrixCell({ charges, kind, pending, run }: { charges: DebtCharge[]; kind: Category; pending: boolean; run: Run }) {
  const allPaid = charges.every((c) => c.paid);
  const amount = charges.reduce((a, c) => a + c.amount, 0);
  const pax = charges.reduce((a, c) => a + c.qty, 0);
  const display = kind === "monday_lab" ? String(pax) : compactNum(amount);
  const title = charges.map((c) => `${rupiah(c.amount)}${c.description ? " · " + c.description : ""}`).join(" · ");
  function toggle() { charges.forEach((c) => { if (c.paid === allPaid) run(() => togglePaid(c.id, !allPaid), ""); }); }
  return (
    <button title={title} disabled={pending} onClick={toggle}
      className={`tnum rounded-md px-2 py-0.5 text-xs font-medium ${allPaid ? "bg-[#dff3d3] text-[#1d5128]" : "bg-muted hover:bg-accent"}`}>
      {display}{allPaid ? " ✓" : ""}
    </button>
  );
}

function PersonDetail({ person, charges, pending, run, onClose }: {
  person: DebtPerson; charges: DebtCharge[]; pending: boolean; run: Run; onClose: () => void;
}) {
  const sorted = [...charges].sort((a, b) => b.occurred_on.localeCompare(a.occurred_on) || a.category.localeCompare(b.category));
  const unpaid = charges.filter((c) => !c.paid).reduce((a, c) => a + c.amount, 0);
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-foreground/40 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-border bg-card shadow-pop sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 flex items-center justify-between border-b border-border bg-muted/30 px-4 py-3 backdrop-blur">
          <span className="font-semibold">{person.name} <span className="ml-1 text-sm font-normal text-muted-foreground">· belum lunas {rupiah(unpaid)}</span></span>
          <Button size="icon-xs" variant="ghost" onClick={onClose} aria-label="Tutup"><X className="h-4 w-4" /></Button>
        </div>
        <div className="divide-y divide-border/60">
          {sorted.length === 0 ? <p className="px-4 py-6 text-center text-sm text-muted-foreground">Belum ada catatan.</p> : sorted.map((c) => <ChargeLine key={c.id} charge={c} pending={pending} run={run} />)}
        </div>
      </div>
    </div>
  );
}

function ChargeLine({ charge, pending, run }: { charge: DebtCharge; pending: boolean; run: Run }) {
  const editable = charge.category !== "monday_lab";
  const [amt, setAmt] = useState(String(charge.amount));
  useEffect(() => { setAmt(String(charge.amount)); }, [charge.amount]);
  function saveIfDirty() { if (editable && Number(amt) !== charge.amount) run(() => updateChargeAmount(charge.id, Number(amt)), "Tersimpan"); }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 text-sm">
      <span className="min-w-[8rem] flex-1">
        <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">{CAT_LABEL[charge.category]}</span>
        <span className="ml-2 text-muted-foreground">{chargeDetail(charge)}</span>
      </span>
      {editable ? (
        <input type="number" min={0} value={amt} onChange={(e) => setAmt(e.target.value)} onBlur={saveIfDirty}
          className="tnum w-28 rounded-md border border-input bg-transparent px-2 py-1 text-right outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50" />
      ) : (
        <span className="tnum w-28 text-right font-medium">{rupiah(charge.amount)}</span>
      )}
      <Button size="sm" variant={charge.paid ? "secondary" : "default"} disabled={pending}
        onClick={() => run(() => togglePaid(charge.id, !charge.paid), charge.paid ? "Dibuka" : "Ditandai lunas")} className="min-w-[6.5rem]">
        {charge.paid ? <><Check className="mr-1 h-3.5 w-3.5" /> Lunas</> : "Tandai lunas"}
      </Button>
      <Button size="icon-sm" variant="ghost" aria-label="Hapus" disabled={pending}
        onClick={() => run(() => deleteCharge(charge.id), "Dihapus")} className="text-muted-foreground hover:text-destructive">
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

function OutputPanel({ people, charges }: { people: DebtPerson[]; charges: DebtCharge[] }) {
  const [active, setActive] = useState<"monday" | "pa" | "lainnya" | "rekap">("rekap");
  const text = useMemo(() => {
    if (active === "monday") return generateMondayLabText(people, charges);
    if (active === "pa") return generatePaText(people, charges);
    if (active === "lainnya") return generateLainnyaText(people, charges);
    return generateRekapText(people, charges);
  }, [active, people, charges]);

  function copy() { navigator.clipboard.writeText(text).then(() => toast.success("Disalin")); }

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">Generate teks ringkasan</p>
        <Button size="sm" variant="secondary" onClick={copy}><Copy className="mr-1.5 h-4 w-4" /> Copy</Button>
      </div>
      <div className="mb-2 flex flex-wrap gap-0.5 rounded-lg border border-border p-0.5">
        {([["rekap", "Rekap seluruhnya"], ["monday", "Monday Lab"], ["pa", "PA"], ["lainnya", "Lainnya"]] as const).map(([k, lbl]) => (
          <button key={k} onClick={() => setActive(k)} className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${active === k ? "bg-brand-muted text-[#1d5128]" : "text-muted-foreground hover:text-foreground"}`}>{lbl}</button>
        ))}
      </div>
      <textarea readOnly value={text} rows={12} className="w-full rounded-lg border border-input bg-muted/30 p-3 font-mono text-xs outline-none" />
    </div>
  );
}
