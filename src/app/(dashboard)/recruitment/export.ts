"use client";

import { stageLabel, type Candidate } from "@/lib/recruitment";

function download(name: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

// Backup penuh (camelCase) — kompatibel dengan format dashboard lama untuk import-merge.
export function exportJson(cands: Candidate[]) {
  const payload = { type: "sproutlab_recruitment", exported: today(), cands };
  download(`sproutlab-recruitment-${today()}.json`, JSON.stringify(payload, null, 2), "application/json");
}

const CSV_COLS: (keyof Candidate)[] = [
  "code", "name", "whatsapp", "email", "domisili", "birth", "marital", "source", "jalur",
  "stage", "outcome", "education", "jurusan", "universitas", "salesExp", "experience", "interest",
  "interviewAt", "interviewDone", "scoreHR", "recHR", "noteHR", "noteAlfred", "nextFollowUp",
  "lastContact", "joinDate", "agentCode", "agentStatus", "docLink", "contractStatus",
  "contractLink", "dateIn", "lastUpdated",
];

export function exportCsv(cands: Candidate[]) {
  const head = CSV_COLS.join(",");
  const body = cands
    .map((c) =>
      CSV_COLS.map((k) => {
        const raw = k === "stage" ? stageLabel(c.stage) : c[k];
        return `"${String(raw ?? "").replace(/"/g, '""')}"`;
      }).join(","),
    )
    .join("\n");
  download(`sproutlab-recruitment-${today()}.csv`, "﻿" + head + "\n" + body, "text/csv");
}

export function exportAgentsJson(cands: Candidate[]) {
  const agents = cands
    .filter((c) => c.outcome === "agent_aktif")
    .map((c) => ({
      agentCode: c.agentCode,
      candidateCode: c.code,
      name: c.name,
      whatsapp: c.whatsapp,
      email: c.email,
      domisili: c.domisili,
      source: c.source,
      jalur: c.jalur,
      joinDate: c.joinDate,
      education: c.education,
      jurusan: c.jurusan,
      universitas: c.universitas,
      salesExp: c.salesExp,
      experience: c.experience,
      cvNote: c.cvNote,
      docLink: c.docLink,
      contractStatus: c.contractStatus,
      contractLink: c.contractLink,
    }));
  if (!agents.length) {
    alert("Belum ada agen aktif untuk diekspor.");
    return;
  }
  download(
    `sproutlab-agen-${today()}.json`,
    JSON.stringify({ type: "sproutlab_agents", exported: today(), agents }, null, 2),
    "application/json",
  );
}
