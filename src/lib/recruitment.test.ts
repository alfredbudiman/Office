import { describe, it, expect } from "vitest";
import {
  stageIndex,
  stageLabel,
  addDays,
  daysBetween,
  normWa,
  isOverdue,
  isStale,
  daysInStage,
  funnelData,
  sourceBreakdown,
  bestSource,
  type Candidate,
  type Stage,
  type Outcome,
} from "@/lib/recruitment";

const cand = (over: Partial<Candidate> = {}): Candidate => ({
  id: "1", code: "CND-0001", name: "Test", whatsapp: "628123", email: "", domisili: "",
  birth: "", marital: "", education: "", jurusan: "", universitas: "", salesExp: "",
  experience: "", cvNote: "", source: "Glints", jalur: "", stage: "screening" as Stage,
  outcome: "active" as Outcome, maxReached: 1, archived: false, dateIn: "2026-06-09",
  stageSince: "2026-06-09", lastUpdated: "2026-06-09", interest: "", followNote: "",
  lastContact: "", nextFollowUp: "", interviewAt: "", interviewDone: false, scoreHR: "",
  noteHR: "", recHR: "", noteAlfred: "", docs: {}, docLink: "", joinDate: "",
  contractStatus: "", contractLink: "", agentCode: "", agentStatus: "", history: [],
  ...over,
});

describe("stageIndex / stageLabel", () => {
  it("petakan key ke index & label", () => {
    expect(stageIndex("sourcing")).toBe(0);
    expect(stageIndex("agent")).toBe(6);
    expect(stageIndex("ngaco")).toBe(-1);
    expect(stageLabel("interview_hr")).toBe("Interview HR");
    expect(stageLabel("xxx")).toBe("xxx");
  });
});

describe("addDays / daysBetween", () => {
  it("tambah hari", () => {
    expect(addDays("2026-06-09", 3)).toBe("2026-06-12");
    expect(addDays("2026-06-30", 1)).toBe("2026-07-01");
  });
  it("selisih hari", () => {
    expect(daysBetween("2026-06-09", "2026-06-12")).toBe(3);
    expect(daysBetween("2026-06-12", "2026-06-09")).toBe(-3);
  });
});

describe("normWa", () => {
  it("normalisasi nomor WA ke 62", () => {
    expect(normWa("08123456789")).toBe("628123456789");
    expect(normWa("+62 812-3456")).toBe("62812 3456".replace(/\D/g, ""));
    expect(normWa("6281")).toBe("6281");
  });
});

describe("daysInStage", () => {
  it("hitung lama di tahap dari stageSince", () => {
    expect(daysInStage(cand({ stageSince: "2026-06-09" }), "2026-06-16")).toBe(7);
  });
});

describe("isOverdue", () => {
  it("true bila follow-up jatuh tempo & masih aktif", () => {
    expect(isOverdue(cand({ nextFollowUp: "2026-06-10" }), "2026-06-16")).toBe(true);
  });
  it("false bila belum jatuh tempo", () => {
    expect(isOverdue(cand({ nextFollowUp: "2026-06-20" }), "2026-06-16")).toBe(false);
  });
  it("false untuk agent / non-active", () => {
    expect(isOverdue(cand({ nextFollowUp: "2026-06-10", stage: "agent" }), "2026-06-16")).toBe(false);
    expect(isOverdue(cand({ nextFollowUp: "2026-06-10", outcome: "talent_pool" }), "2026-06-16")).toBe(false);
  });
});

describe("isStale", () => {
  it("true bila diam di tahap >= ambang", () => {
    expect(isStale(cand({ stageSince: "2026-06-09" }), 7, "2026-06-16")).toBe(true);
    expect(isStale(cand({ stageSince: "2026-06-14" }), 7, "2026-06-16")).toBe(false);
  });
});

describe("funnelData", () => {
  it("hitung reached & conversion pakai maxReached", () => {
    const cands = [
      cand({ maxReached: 0 }),
      cand({ maxReached: 1 }),
      cand({ maxReached: 3 }),
    ];
    const f = funnelData(cands);
    expect(f[0].count).toBe(3); // semua >= 0
    expect(f[1].count).toBe(2); // >= 1
    expect(f[2].count).toBe(1); // >= 2
    expect(f[0].conv).toBe(100);
    expect(f[1].conv).toBe(Math.round((2 / 3) * 100));
  });
});

describe("sourceBreakdown / bestSource", () => {
  it("kelompokkan per source + hitung agent", () => {
    const cands = [
      cand({ source: "Glints" }),
      cand({ source: "Glints", outcome: "agent_aktif" }),
      cand({ source: "LinkedIn" }),
    ];
    const by = sourceBreakdown(cands);
    expect(by.Glints).toEqual({ t: 2, a: 1 });
    expect(by.LinkedIn).toEqual({ t: 1, a: 0 });
    expect(bestSource(cands)).toBe("Glints");
  });
});
