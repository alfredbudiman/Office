"use client";

import { useEffect, useState } from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui-kit";
import type { Candidate } from "@/lib/recruitment";
import { RecruitmentApp } from "./recruitment-app";

const PASSWORD = "Sabina26";
const SS_KEY = "recruitment_unlocked";

export function RecruitmentGate(props: {
  candidates: Candidate[];
  followUpDays: number;
  staleDays: number;
}) {
  // null = belum tahu (hindari flicker SSR), false = terkunci, true = terbuka
  const [unlocked, setUnlocked] = useState<boolean | null>(null);
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    setUnlocked(sessionStorage.getItem(SS_KEY) === "1");
  }, []);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pw === PASSWORD) {
      sessionStorage.setItem(SS_KEY, "1");
      setUnlocked(true);
      setErr("");
    } else {
      setErr("Password salah.");
      setPw("");
    }
  }

  if (unlocked === null) return null;

  if (!unlocked) {
    return (
      <div>
        <PageHeader title="Recruitment" description="Area khusus tim rekrutmen." />
        <div className="mx-auto mt-10 max-w-sm rounded-2xl border border-border/70 bg-card p-6 shadow-card">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-muted text-brand">
              <Lock className="h-5 w-5" />
            </span>
            <div>
              <p className="font-medium">Menu terkunci</p>
              <p className="text-xs text-muted-foreground">Masukkan password untuk membuka.</p>
            </div>
          </div>
          <form onSubmit={submit} className="space-y-3">
            <Input
              type="password"
              autoFocus
              placeholder="Password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
            />
            {err && <p className="text-sm text-destructive">{err}</p>}
            <Button type="submit" className="w-full">
              Buka
            </Button>
          </form>
        </div>
      </div>
    );
  }

  return <RecruitmentApp {...props} />;
}
