import { describe, it, expect } from "vitest";
import { linkify } from "@/lib/linkify";

describe("linkify", () => {
  it("plain text tanpa URL", () => {
    expect(linkify("halo dunia")).toEqual([{ type: "text", value: "halo dunia" }]);
  });

  it("URL tunggal di tengah", () => {
    expect(linkify("cek https://example.com ya")).toEqual([
      { type: "text", value: "cek " },
      { type: "link", value: "https://example.com" },
      { type: "text", value: " ya" },
    ]);
  });

  it("multiple URLs", () => {
    expect(linkify("a https://x.com b https://y.com c")).toEqual([
      { type: "text", value: "a " },
      { type: "link", value: "https://x.com" },
      { type: "text", value: " b " },
      { type: "link", value: "https://y.com" },
      { type: "text", value: " c" },
    ]);
  });

  it("URL di akhir kalimat dengan titik tidak masuk URL", () => {
    expect(linkify("buka https://example.com.")).toEqual([
      { type: "text", value: "buka " },
      { type: "link", value: "https://example.com" },
      { type: "text", value: "." },
    ]);
  });

  it("www. tanpa scheme", () => {
    expect(linkify("lihat www.google.com")).toEqual([
      { type: "text", value: "lihat " },
      { type: "link", value: "www.google.com" },
    ]);
  });

  it("wa.me link", () => {
    expect(linkify("ping wa.me/628112634321 sekarang")).toEqual([
      { type: "text", value: "ping " },
      { type: "link", value: "wa.me/628112634321" },
      { type: "text", value: " sekarang" },
    ]);
  });

  it("string kosong", () => {
    expect(linkify("")).toEqual([]);
  });

  it("URL invalid tidak jadi link", () => {
    expect(linkify("https://")).toEqual([{ type: "text", value: "https://" }]);
  });

  it("preserve newline", () => {
    expect(linkify("line1\nhttps://x.com\nline3")).toEqual([
      { type: "text", value: "line1\n" },
      { type: "link", value: "https://x.com" },
      { type: "text", value: "\nline3" },
    ]);
  });
});
