import { describe, it, expect } from "vitest";
import {
  initialStatus, actionsFor, applyAction, ACTIONS,
  type VideoStatus, type VideoAction,
} from "@/lib/video-workflow";

describe("initialStatus", () => {
  it("clipping mulai dari editing (skip cut-to-cut)", () => {
    expect(initialStatus("clipping")).toBe("editing");
  });
  it("non-clipping mulai dari draft_brief", () => {
    expect(initialStatus("monolog")).toBe("draft_brief");
    expect(initialStatus("podcast")).toBe("draft_brief");
    expect(initialStatus("shorts")).toBe("draft_brief");
  });
});

describe("actionsFor", () => {
  it("editor di cut_to_cut bisa submit_cut", () => {
    expect(actionsFor("cut_to_cut", "editor")).toEqual(["submit_cut"]);
  });
  it("owner di review_cut bisa approve atau minta revisi cut", () => {
    expect(actionsFor("review_cut", "owner").sort()).toEqual(["approve_cut", "request_cut_revision"]);
  });
  it("owner di review_draft bisa approve_final atau request_revision", () => {
    expect(actionsFor("review_draft", "owner").sort()).toEqual(["approve_final", "request_revision"]);
  });
  it("editor di review_cut tidak punya aksi (giliran owner)", () => {
    expect(actionsFor("review_cut", "editor")).toEqual([]);
  });
  it("hrd tidak punya aksi apa pun", () => {
    expect(actionsFor("review_draft", "hrd")).toEqual([]);
  });
  it("tayang tidak punya aksi lanjutan", () => {
    expect(actionsFor("tayang", "owner")).toEqual([]);
  });
});

describe("applyAction", () => {
  it("submit_cut: cut_to_cut -> review_cut", () => {
    expect(applyAction("cut_to_cut", "submit_cut")).toEqual({ ok: true, to: "review_cut" });
  });
  it("approve_cut: review_cut -> editing", () => {
    expect(applyAction("review_cut", "approve_cut")).toEqual({ ok: true, to: "editing" });
  });
  it("loop revisi: request_revision review_draft -> editing, lalu submit_draft -> review_draft", () => {
    expect(applyAction("review_draft", "request_revision")).toEqual({ ok: true, to: "editing" });
    expect(applyAction("editing", "submit_draft")).toEqual({ ok: true, to: "review_draft" });
  });
  it("approve_final: review_draft -> final, mark_tayang: final -> tayang", () => {
    expect(applyAction("review_draft", "approve_final")).toEqual({ ok: true, to: "final" });
    expect(applyAction("final", "mark_tayang")).toEqual({ ok: true, to: "tayang" });
  });
  it("aksi dari status salah ditolak", () => {
    const r = applyAction("final", "submit_cut");
    expect(r.ok).toBe(false);
  });
});

describe("ACTIONS metadata", () => {
  it("submit_cut & submit_draft wajib link", () => {
    expect(ACTIONS.submit_cut.requiresLink).toBe(true);
    expect(ACTIONS.submit_draft.requiresLink).toBe(true);
  });
  it("submit_draft membuat draft", () => {
    expect(ACTIONS.submit_draft.createsDraft).toBe(true);
  });
});
