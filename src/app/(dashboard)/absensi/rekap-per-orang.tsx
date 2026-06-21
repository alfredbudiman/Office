"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { formatDuration } from "@/lib/rekap";
import { workedMs, type RekapOrang, type AttendanceDay } from "@/lib/attendance";

function jam(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}
function tgl(d: string): string {
  return new Date(d).toLocaleDateString("id-ID");
}

function DetailHarian({ days }: { days: AttendanceDay[] }) {
  if (days.length === 0) {
    return <p className="px-4 py-3 text-xs text-muted-foreground">Tidak ada catatan bulan ini.</p>;
  }
  return (
    <table className="w-full text-xs">
      <thead className="text-left text-muted-foreground">
        <tr>
          <th className="px-4 py-2 font-medium">Tanggal</th>
          <th className="px-4 py-2 font-medium">Masuk</th>
          <th className="px-4 py-2 font-medium">Pulang</th>
          <th className="px-4 py-2 font-medium">Durasi</th>
        </tr>
      </thead>
      <tbody>
        {days.map((d) => (
          <tr key={d.id} className="border-t border-border/60">
            <td className="tnum px-4 py-2">{tgl(d.tanggal)}</td>
            <td className="tnum px-4 py-2">{jam(d.clock_in)}</td>
            <td className="tnum px-4 py-2">{jam(d.clock_out)}</td>
            <td className="tnum px-4 py-2">{formatDuration(workedMs(d.clock_in, d.clock_out))}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function RekapPerOrang({ data }: { data: RekapOrang[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const toggle = (id: string) => setOpenId((cur) => (cur === id ? null : id));

  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card/50 px-4 py-8 text-center text-sm text-muted-foreground">
        Belum ada karyawan aktif.
      </div>
    );
  }

  return (
    <>
      {/* Mobile: kartu per orang */}
      <div className="space-y-2 sm:hidden">
        {data.map((o) => {
          const open = openId === o.id;
          return (
            <div key={o.id} className="rounded-xl border border-border bg-card shadow-card">
              <button
                type="button"
                onClick={() => toggle(o.id)}
                aria-expanded={open}
                className="flex w-full items-center justify-between gap-2 p-3 text-left"
              >
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  {o.nama}
                </span>
                <span className="tnum text-sm">{o.hariHadir} hari · {formatDuration(o.totalMs)}</span>
              </button>
              {open && <div className="border-t border-border"><DetailHarian days={o.days} /></div>}
            </div>
          );
        })}
      </div>

      {/* Desktop: tabel */}
      <div className="hidden overflow-x-auto rounded-xl border border-border bg-card shadow-card sm:block">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5">Nama</th>
              <th className="px-4 py-2.5">Hari hadir</th>
              <th className="px-4 py-2.5">Total jam</th>
            </tr>
          </thead>
          <tbody>
            {data.map((o) => {
              const open = openId === o.id;
              return (
                <FragmentRow key={o.id} o={o} open={open} onToggle={() => toggle(o.id)} />
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function FragmentRow({ o, open, onToggle }: { o: RekapOrang; open: boolean; onToggle: () => void }) {
  return (
    <>
      <tr
        className="cursor-pointer border-t border-border hover:bg-accent/40"
        onClick={onToggle}
        tabIndex={0}
        role="button"
        aria-expanded={open}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            if (e.key === " ") e.preventDefault();
            onToggle();
          }
        }}
      >
        <td className="px-4 py-2.5">
          <span className="flex items-center gap-1.5">
            {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            {o.nama}
          </span>
        </td>
        <td className="tnum px-4 py-2.5">{o.hariHadir}</td>
        <td className="tnum px-4 py-2.5">{formatDuration(o.totalMs)}</td>
      </tr>
      {open && (
        <tr className="border-t border-border bg-muted/20">
          <td colSpan={3} className="p-0">
            <DetailHarian days={o.days} />
          </td>
        </tr>
      )}
    </>
  );
}
