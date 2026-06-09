import { describe, it, expect } from "vitest";
import { parseBankKonten, summarize, type SheetRow } from "@/lib/bank-konten";

// Helper: bikin baris dari array {teks, link?}.
const row = (cells: Array<string | { v: string; link?: string }>): SheetRow => ({
  values: cells.map((c) =>
    typeof c === "string" ? { formattedValue: c } : { formattedValue: c.v, hyperlink: c.link },
  ),
});

const HEADER: SheetRow[] = [
  row(["KONTEN LIST 2026"]),
  row(["NO", "JENIS KONTEN", "KONTEN LIST", "PROGRES", "", "", "", "LINK", "STATUS POSTING"]),
  row(["", "", "", "On going", "Editing", "Revisi", "Fix/ Done"]),
];

describe("parseBankKonten", () => {
  it("melewati judul & baris header", () => {
    expect(parseBankKonten(HEADER)).toEqual([]);
  });

  it("carry-forward JENIS KONTEN ke baris berikutnya yang kosong", () => {
    const groups = parseBankKonten([
      ...HEADER,
      row(["1", "MONOLOG", "Monolog Long 1", "", "", "", "✅", { v: "Click Here", link: "https://drive.google.com/a" }]),
      row(["2", "", "Monolog Long 3", "", "", "", "✅", { v: "Click Here", link: "https://drive.google.com/b" }]),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].jenis).toBe("MONOLOG");
    expect(groups[0].items.map((i) => i.konten)).toEqual(["Monolog Long 1", "Monolog Long 3"]);
    expect(groups[0].items[1].jenis).toBe("MONOLOG");
  });

  it("memetakan sub-kolom PROGRES ke status", () => {
    const groups = parseBankKonten([
      ...HEADER,
      row(["1", "MONOLOG", "On going item", "✅"]),
      row(["2", "", "Editing item", "", "✅"]),
      row(["3", "", "Revisi item", "", "", "✅"]),
      row(["4", "", "Done item", "", "", "", "✅"]),
      row(["5", "", "Belum ada status", ""]),
    ]);
    const byKonten = Object.fromEntries(groups[0].items.map((i) => [i.konten, i.status]));
    expect(byKonten).toEqual({
      "On going item": "ongoing",
      "Editing item": "editing",
      "Revisi item": "revisi",
      "Done item": "done",
      "Belum ada status": null,
    });
  });

  it("mengambil hyperlink Drive, bukan teks 'Click Here'", () => {
    const groups = parseBankKonten([
      ...HEADER,
      row(["1", "PODCAST", "Podcast Ambisius", "", "", "", "✅", { v: "Clik Here", link: "https://drive.google.com/x" }]),
    ]);
    expect(groups[0].items[0].link).toBe("https://drive.google.com/x");
  });

  it("link null bila kolom LINK kosong / tanpa hyperlink", () => {
    const groups = parseBankKonten([
      ...HEADER,
      row(["1", "MONOLOG", "Sunday Punch", "", "", "✅"]),
    ]);
    expect(groups[0].items[0].link).toBeNull();
  });

  it("mendeteksi STATUS POSTING dari salah satu sub-kolom", () => {
    const groups = parseBankKonten([
      ...HEADER,
      row(["5", "MONOLOG", "Raising Twins", "", "", "", "✅", { v: "Click Here", link: "https://d/r" }, "✅"]),
      row(["6", "", "Sunday Punch", "", "", "✅"]),
    ]);
    expect(groups[0].items[0].posted).toBe(true);
    expect(groups[0].items[1].posted).toBe(false);
  });

  it("menangani baris data tanpa nomor (no = null)", () => {
    const groups = parseBankKonten([
      ...HEADER,
      row(["", "MONOLOG", "Vlog Golf", "✅"]),
    ]);
    expect(groups[0].items[0].no).toBeNull();
    expect(groups[0].items[0].konten).toBe("Vlog Golf");
  });

  it("memisahkan beberapa kategori sesuai urutan", () => {
    const groups = parseBankKonten([
      ...HEADER,
      row(["1", "MONOLOG", "M1", "✅"]),
      row(["1", "PODCAST", "P1", "✅"]),
      row(["1", "SHORT CONTENT", "S1", "✅"]),
    ]);
    expect(groups.map((g) => g.jenis)).toEqual(["MONOLOG", "PODCAST", "SHORT CONTENT"]);
  });
});

describe("summarize", () => {
  it("menghitung total, done, posted, dan item berlink", () => {
    const groups = parseBankKonten([
      ...HEADER,
      row(["1", "MONOLOG", "Done+link+posted", "", "", "", "✅", { v: "Click Here", link: "https://d/1" }, "✅"]),
      row(["2", "", "Done+link", "", "", "", "✅", { v: "Click Here", link: "https://d/2" }]),
      row(["3", "", "Editing", "", "✅"]),
    ]);
    const s = summarize(groups);
    expect(s.total).toBe(3);
    expect(s.done).toBe(2);
    expect(s.posted).toBe(1);
    expect(s.withLink).toHaveLength(2);
    expect(s.doneItems).toHaveLength(2);
  });
});
