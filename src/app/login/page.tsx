"use client";

import { useActionState } from "react";
import { motion } from "framer-motion";
import { Film, Loader2 } from "lucide-react";
import { login } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, null);
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      {/* Latar: glow brand lembut + grid halus */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-background" />
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.4]"
        style={{
          backgroundImage:
            "linear-gradient(to right, var(--border) 1px, transparent 1px), linear-gradient(to bottom, var(--border) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          maskImage: "radial-gradient(ellipse 80% 60% at 50% 40%, black, transparent)",
          WebkitMaskImage: "radial-gradient(ellipse 80% 60% at 50% 40%, black, transparent)",
        }}
      />
      <div className="pointer-events-none absolute left-1/2 top-[28%] -z-10 h-72 w-72 -translate-x-1/2 rounded-full bg-brand/20 blur-[110px]" />

      <motion.div
        initial={{ opacity: 0, y: 14, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-sm"
      >
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand text-brand-foreground shadow-soft">
            <Film className="h-6 w-6" strokeWidth={2.25} />
          </span>
          <h1 className="text-xl font-semibold tracking-tight">Masuk ke Office</h1>
          <p className="mt-1 text-sm text-muted-foreground">Dashboard komunikasi tim</p>
        </div>

        <div className="rounded-2xl border border-border bg-card/80 p-6 shadow-card backdrop-blur-sm">
          <form action={formAction} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" autoComplete="email" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" autoComplete="current-password" required />
            </div>
            {state?.error && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {state.error}
              </motion.p>
            )}
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Memproses…
                </span>
              ) : (
                "Masuk"
              )}
            </Button>
          </form>
        </div>
        <p className="mt-6 text-center text-xs text-muted-foreground/70">
          Akses internal — hubungi admin bila butuh akun.
        </p>
      </motion.div>
    </div>
  );
}
