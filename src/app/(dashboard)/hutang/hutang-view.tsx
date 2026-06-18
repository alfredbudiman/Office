"use client";

import { useState, useEffect, useMemo, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, Check, Copy, X, Users, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  rupiah, dayLabel, monthLabel, totalUnpaid,
  generateMondayLabText, generatePaText, generateLainnyaText, generateRekapText,
  DEFAULT_BOX_PRICE, type DebtPerson, type DebtCharge,
} from "@/lib/debt";
import {
  addPerson, updatePerson, addMondayLab, ensurePaEntries, updateChargeAmount, addLainnya, togglePaid, deleteCharge,
} from "./actions";

function wibMonth() { return new Date(new Date().getTime() + 7 * 3600000).toISOString().slice(0, 7); }
function wibDateStr() { return new Date(new Date().getTime() + 7 * 3600000).toISOString().slice(0, 10); }
const selCls = "h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function HutangView({ people, charges }: { people: DebtPerson[]; charges: DebtCharge[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [tab, setTab] = useState<"monday" | "pa" | "lainnya">("monday");
  const [peopleOpen, setPeopleOpen] = useState(people.length === 0);
  const [output, setOutput] = useState<{ title: string; text: string } | null>(null);

  const name = useMemo(() => new Map(people.map((p) => [p.id, p.name])), [people]);
  const activePeople = people.filter((p) => p.active);

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
      {/* Ringkasan total belum lunas */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Belum lunas (total)" value={rupiah(totalUnpaid(charges))} emphasis />
        <Stat label="Monday Lab" value={rupiah(totalUnpaid(charges, "monday_lab"))} />
        <Stat label="PA" value={rupiah(totalUnpaid(charges, "pa"))} />
        <Stat label="Lainnya" value={rupiah(totalUnpaid(charges, "lainnya"))} />
      </div>

      <PeopleManager people={people} open={peopleOpen} setOpen={setPeopleOpen} pending={pending} run={run} />

      {/* Tabs */}
      <div className="inline-flex flex-wrap gap-0.5 rounded-lg border border-border bg-card p-0.5">
        {([["monday", "Monday Lab"], ["pa", "PA"], ["lainnya", "Lainnya"]] as const).map(([k, lbl]) => (
          <button key={k} onClick={() => setTab(k)} className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${tab === k ? "bg-brand-muted text-[#1d5128]" : "text-muted-foreground hover:text-foreground"}`}>{lbl}</button>
        ))}
      </div>

      {tab === "monday" && <MondayTab people={activePeople} charges={charges} name={name} pending={pending} run={run} />}
      {tab === "pa" && <PaTab charges={charges} name={name} pending={pending} run={run} />}
      {tab === "lainnya" && <LainnyaTab people={activePeople} charges={charges} name={name} pending={pending} run={run} />}

      {/* Output */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
        <p className="mb-2 text-sm font-medium">Generate teks ringkasan</p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => setOutput({ title: "Ringkasan Monday Lab", text: generateMondayLabText(people, charges) })}>Monday Lab</Button>
          <Button size="sm" variant="secondary" onClick={() => setOutput({ title: "Ringkasan PA", text: generatePaText(people, charges) })}>PA</Button>
          <Button size="sm" variant="secondary" onClick={() => setOutput({ title: "Ringkasan Lainnya", text: generateLainnyaText(people, charges) })}>Lainnya</Button>
          <Button size="sm" onClick={() => setOutput({ title: "Rekap Seluruhnya", text: generateRekapText(people, charges) })}>Rekap seluruhnya</Button>
        </div>
      </div>

      {output && <OutputModal title={output.title} text={output.text} onClose={() => setOutput(null)} />}
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
  people: DebtPerson[]; open: boolean; setOpen: (b: boolean) => void; pending: boolean;
  run: (fn: () => Promise<{ ok: boolean; error?: string }>, okMsg: string) => void;
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
          <form
            ref={formRef}
            action={(fd) => run(() => addPerson(null, fd).then((r) => { if (r.ok) formRef.current?.reset(); return r; }), "Orang ditambahkan")}
            className="flex flex-wrap items-end gap-2"
          >
            <div className="space-y-1">
              <Label htmlFor="p-name">Nama</Label>
              <Input id="p-name" name="name" placeholder="mis. Andi" className="w-40" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="p-pa">Biaya PA / bulan</Label>
              <Input id="p-pa" name="monthly_pa" type="number" min={0} defaultValue={0} className="w-32" />
            </div>
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

function PersonRow({ person, pending, run }: {
  person: DebtPerson; pending: boolean;
  run: (fn: () => Promise<{ ok: boolean; error?: string }>, okMsg: string) => void;
}) {
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

function ChargeRow({ charge, name, pending, run, detail }: {
  charge: DebtCharge; name: Map<string, string>; pending: boolean; detail: string;
  run: (fn: () => Promise<{ ok: boolean; error?: string }>, okMsg: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 py-2 text-sm">
      <span className="min-w-[6rem] flex-1 font-medium">{name.get(charge.person_id) ?? "?"}</span>
      <span className="text-xs text-muted-foreground">{detail}</span>
      <span className="tnum w-24 text-right font-medium">{rupiah(charge.amount)}</span>
      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${charge.paid ? "bg-[#dff3d3] text-[#1d5128]" : "bg-muted text-muted-foreground"}`}>{charge.paid ? "Lunas" : "Belum"}</span>
      <Button size="icon-xs" variant={charge.paid ? "ghost" : "default"} aria-label="Tandai lunas" disabled={pending} onClick={() => run(() => togglePaid(charge.id, !charge.paid), charge.paid ? "Dibuka" : "Ditandai lunas")}><Check className="h-3.5 w-3.5" /></Button>
      <Button size="icon-xs" variant="ghost" aria-label="Hapus" disabled={pending} onClick={() => run(() => deleteCharge(charge.id), "Dihapus")} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
    </div>
  );
}

function MondayTab({ people, charges, name, pending, run }: {
  people: DebtPerson[]; charges: DebtCharge[]; name: Map<string, string>; pending: boolean;
  run: (fn: () => Promise<{ ok: boolean; error?: string }>, okMsg: string) => void;
}) {
  const [date, setDate] = useState(wibDateStr());
  const [price, setPrice] = useState(String(DEFAULT_BOX_PRICE));
  const [pax, setPax] = useState<Record<string, string>>({});
  const rows = charges.filter((c) => c.category === "monday_lab");
  const byDate = new Map<string, DebtCharge[]>();
  for (const c of rows) (byDate.get(c.occurred_on) ?? byDate.set(c.occurred_on, []).get(c.occurred_on)!).push(c);
  const dates = [...byDate.keys()].sort().reverse();

  function submit() {
    const entries = people.map((p) => ({ person_id: p.id, pax: Number(pax[p.id] || 0) }));
    run(() => addMondayLab(date, Number(price), JSON.stringify(entries)).then((r) => { if (r.ok) setPax({}); return r; }), "Acara ditambahkan");
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
        <p className="mb-3 text-sm font-medium">Tambah acara Senin</p>
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1"><Label>Tanggal</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-auto" /></div>
          <div className="space-y-1"><Label>Harga / box</Label><Input type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} className="w-28" /></div>
        </div>
        {people.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Tambahkan orang dulu di "Daftar orang".</p>
        ) : (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {people.map((p) => (
              <label key={p.id} className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-1.5 text-sm">
                <span className="flex-1">{p.name}</span>
                <Input type="number" min={0} placeholder="pax" value={pax[p.id] ?? ""} onChange={(e) => setPax((s) => ({ ...s, [p.id]: e.target.value }))} className="w-20" />
              </label>
            ))}
          </div>
        )}
        <Button size="sm" className="mt-3" disabled={pending || people.length === 0} onClick={submit}><Plus className="mr-1 h-3.5 w-3.5" /> Simpan acara</Button>
      </div>

      {dates.map((d) => {
        const list = byDate.get(d)!;
        const sub = list.filter((c) => !c.paid).reduce((a, c) => a + c.amount, 0);
        return (
          <div key={d} className="rounded-2xl border border-border bg-card shadow-card">
            <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-2.5">
              <span className="text-sm font-semibold">Senin, {dayLabel(d)} <span className="font-normal text-muted-foreground">· {rupiah(list[0].unit_price)}/box</span></span>
              <span className="tnum text-xs text-muted-foreground">belum lunas: {rupiah(sub)}</span>
            </div>
            <div className="divide-y divide-border/60 px-4">
              {list.map((c) => <ChargeRow key={c.id} charge={c} name={name} pending={pending} run={run} detail={`${c.qty} box`} />)}
            </div>
          </div>
        );
      })}
      {dates.length === 0 && <Empty>Belum ada acara Monday Lab.</Empty>}
    </div>
  );
}

function PaTab({ charges, name, pending, run }: {
  charges: DebtCharge[]; name: Map<string, string>; pending: boolean;
  run: (fn: () => Promise<{ ok: boolean; error?: string }>, okMsg: string) => void;
}) {
  const router = useRouter();
  const [month, setMonth] = useState(wibMonth());
  const ensured = useRef<Set<string>>(new Set());
  const monthRows = charges.filter((c) => c.category === "pa" && c.occurred_on.slice(0, 7) === month);

  useEffect(() => {
    if (ensured.current.has(month)) return;
    ensured.current.add(month);
    if (monthRows.length === 0) {
      ensurePaEntries(month).then((r) => { if (r.ok && (r.added ?? 0) > 0) router.refresh(); });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  const sub = monthRows.filter((c) => !c.paid).reduce((a, c) => a + c.amount, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-card p-4 shadow-card">
        <div className="space-y-1"><Label>Bulan</Label><Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-auto" /></div>
        <span className="tnum text-sm text-muted-foreground">belum lunas: <span className="font-semibold text-foreground">{rupiah(sub)}</span></span>
      </div>
      <div className="rounded-2xl border border-border bg-card shadow-card">
        <div className="border-b border-border bg-muted/40 px-4 py-2.5 text-sm font-semibold">PA — {monthLabel(month + "-01")}</div>
        <div className="divide-y divide-border/60 px-4">
          {monthRows.map((c) => <PaRow key={c.id} charge={c} name={name} pending={pending} run={run} />)}
          {monthRows.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">Belum ada data PA bulan ini (otomatis muncul bila ada orang aktif).</p>}
        </div>
      </div>
    </div>
  );
}

function PaRow({ charge, name, pending, run }: {
  charge: DebtCharge; name: Map<string, string>; pending: boolean;
  run: (fn: () => Promise<{ ok: boolean; error?: string }>, okMsg: string) => void;
}) {
  const [amt, setAmt] = useState(String(charge.amount));
  const dirty = Number(amt) !== charge.amount;
  return (
    <div className="flex flex-wrap items-center gap-2 py-2 text-sm">
      <span className="min-w-[6rem] flex-1 font-medium">{name.get(charge.person_id) ?? "?"}</span>
      <Input type="number" min={0} value={amt} onChange={(e) => setAmt(e.target.value)} className="w-28" />
      {dirty && <Button size="xs" disabled={pending} onClick={() => run(() => updateChargeAmount(charge.id, Number(amt)), "Tersimpan")}>Simpan</Button>}
      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${charge.paid ? "bg-[#dff3d3] text-[#1d5128]" : "bg-muted text-muted-foreground"}`}>{charge.paid ? "Lunas" : "Belum"}</span>
      <Button size="icon-xs" variant={charge.paid ? "ghost" : "default"} aria-label="Tandai lunas" disabled={pending} onClick={() => run(() => togglePaid(charge.id, !charge.paid), charge.paid ? "Dibuka" : "Ditandai lunas")}><Check className="h-3.5 w-3.5" /></Button>
      <Button size="icon-xs" variant="ghost" aria-label="Hapus" disabled={pending} onClick={() => run(() => deleteCharge(charge.id), "Dihapus")} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
    </div>
  );
}

function LainnyaTab({ people, charges, name, pending, run }: {
  people: DebtPerson[]; charges: DebtCharge[]; name: Map<string, string>; pending: boolean;
  run: (fn: () => Promise<{ ok: boolean; error?: string }>, okMsg: string) => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const rows = charges.filter((c) => c.category === "lainnya");
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
        <p className="mb-3 text-sm font-medium">Tambah item lainnya</p>
        {people.length === 0 ? (
          <p className="text-sm text-muted-foreground">Tambahkan orang dulu.</p>
        ) : (
          <form ref={formRef} action={(fd) => run(() => addLainnya(fd).then((r) => { if (r.ok) formRef.current?.reset(); return r; }), "Item ditambahkan")} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="date" value={wibDateStr()} />
            <div className="space-y-1"><Label>Orang</Label><select name="person_id" className={`${selCls} w-40`} defaultValue="">{<option value="" disabled>— pilih —</option>}{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
            <div className="space-y-1"><Label>Keterangan</Label><Input name="description" placeholder="mis. beli ATK" className="w-44" /></div>
            <div className="space-y-1"><Label>Qty</Label><Input name="qty" type="number" min={1} defaultValue={1} className="w-16" /></div>
            <div className="space-y-1"><Label>Harga</Label><Input name="unit_price" type="number" min={0} placeholder="nominal" className="w-28" /></div>
            <Button type="submit" size="sm" disabled={pending}><Plus className="mr-1 h-3.5 w-3.5" /> Tambah</Button>
          </form>
        )}
      </div>
      <div className="rounded-2xl border border-border bg-card shadow-card">
        <div className="border-b border-border bg-muted/40 px-4 py-2.5 text-sm font-semibold">Item Lainnya</div>
        <div className="divide-y divide-border/60 px-4">
          {rows.map((c) => <ChargeRow key={c.id} charge={c} name={name} pending={pending} run={run} detail={`${c.description ?? "—"}${c.qty > 1 ? ` (${c.qty}×${rupiah(c.unit_price)})` : ""}`} />)}
          {rows.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">Belum ada item lainnya.</p>}
        </div>
      </div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-border bg-card/50 px-4 py-10 text-center text-sm text-muted-foreground">{children}</div>;
}

function OutputModal({ title, text, onClose }: { title: string; text: string; onClose: () => void }) {
  function copy() { navigator.clipboard.writeText(text).then(() => toast.success("Disalin")); }
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-foreground/40 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-border bg-card p-4 shadow-pop sm:rounded-2xl sm:p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base tracking-tight">{title}</h3>
          <Button size="icon-xs" variant="ghost" onClick={onClose} aria-label="Tutup"><X className="h-4 w-4" /></Button>
        </div>
        <textarea readOnly value={text} rows={14} className="w-full rounded-lg border border-input bg-muted/30 p-3 font-mono text-xs outline-none" />
        <Button size="sm" className="mt-3 w-full" onClick={copy}><Copy className="mr-1.5 h-4 w-4" /> Copy teks</Button>
      </div>
    </div>
  );
}
