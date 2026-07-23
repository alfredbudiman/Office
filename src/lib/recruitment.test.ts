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
  mondayOf,
  officeDate,
  journeyFunnel,
  journeySummary,
  weeklyTrend,
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
  contractStatus: "", contractLink: "", msFirstOffice: "", msAAJI: "", msFirstClosing: "",
  agentCode: "", agentStatus: "", history: [],
  ...over,
});

describe("stageIndex / stageLabel", () => {
  it("petakan key ke index & label", () => {
    expect(stageIndex("sourcing")).toBe(0);
    expect(stageIndex("agent")).toBe(7);
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

describe("mondayOf", () => {
  it("mengembalikan Senin dari minggu tanggal (UTC-safe)", () => {
    expect(mondayOf("2026-07-23")).toBe("2026-07-20"); // Kamis → Senin 20 Jul
    expect(mondayOf("2026-07-20")).toBe("2026-07-20"); // Senin tetap
    expect(mondayOf("2026-07-19")).toBe("2026-07-13"); // Minggu → Senin sebelumnya
  });
  it("string kosong → kosong", () => {
    expect(mondayOf("")).toBe("");
  });
});

describe("officeDate", () => {
  it("prioritas msFirstOffice > joinDate > stageSince/interviewAt", () => {
    expect(officeDate(cand({ msFirstOffice: "2026-07-01", joinDate: "2026-07-05" }))).toBe("2026-07-01");
    expect(officeDate(cand({ joinDate: "2026-07-05" }))).toBe("2026-07-05");
    expect(
      officeDate(cand({ stage: "onboarding", maxReached: 6, stageSince: "2026-07-10", interviewAt: "" })),
    ).toBe("2026-07-10");
  });
  it("belum sampai onboarding & tak ada tanggal → kosong", () => {
    expect(officeDate(cand({ stage: "screening", maxReached: 1, joinDate: "" }))).toBe("");
  });
});

describe("journeyFunnel", () => {
  it("6 tahap screening→agent dengan pctTop & pctPrev", () => {
    const cs = [
      cand({ maxReached: 1 }), // screening
      cand({ maxReached: 3 }), // interview_hr2
      cand({ maxReached: 7 }), // agent
    ];
    const f = journeyFunnel(cs);
    expect(f.map((r) => r.stage)).toEqual([
      "screening", "interview_hr", "interview_hr2", "interview_alfred", "onboarding", "agent",
    ]);
    expect(f[0].count).toBe(3); // semua maxReached>=1
    expect(f[0].pctTop).toBe(100);
    expect(f[0].pctPrev).toBe(100);
    expect(f[5].count).toBe(1); // hanya yang maxReached>=7
  });
});

describe("journeySummary", () => {
  it("menghitung total/diundang/office/agent + rate", () => {
    const cs = [
      cand({ maxReached: 1, outcome: "active" }),
      cand({ maxReached: 5, outcome: "active" }), // >= interview_alfred(5) & onboarding? idx onboarding=6 → tidak
      cand({ maxReached: 7, outcome: "agent_aktif" }),
    ];
    const s = journeySummary(cs);
    expect(s.total).toBe(3);
    expect(s.aktif).toBe(2);
    expect(s.agent).toBe(1);
    expect(s.convAll).toBe(33); // round(1/3*100)
  });
});

describe("weeklyTrend", () => {
  it("mengelompokkan masuk/interview/office per minggu (maks 8)", () => {
    const t = weeklyTrend([
      cand({ dateIn: "2026-07-20", interviewAt: "2026-07-22T13:00", stage: "interview_hr", maxReached: 3 }),
      cand({ dateIn: "2026-07-21" }),
    ]);
    const wk = t.find((w) => w.key === "2026-07-20");
    expect(wk).toBeTruthy();
    expect(wk!.masuk).toBe(2);
    expect(wk!.interview).toBe(1);
    expect(t.length).toBeLessThanOrEqual(8);
  });
});
