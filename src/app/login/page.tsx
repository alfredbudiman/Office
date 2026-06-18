"use client";

import { useActionState } from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { login } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Image from "next/image";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, null);
  return (
    <div className="bg-paper relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      {/* Blob organik — hijau Sprout & gold tipis di atas putih */}
      <motion.div
        aria-hidden
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.2 }}
        className="pointer-events-none absolute -top-24 -left-20 h-[420px] w-[420px] rounded-full bg-brand/12 blur-[120px] -z-10"
      />
      <motion.div
        aria-hidden
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.2, delay: 0.2 }}
        className="pointer-events-none absolute -bottom-32 -right-16 h-[360px] w-[360px] rounded-full bg-[#ed1c24]/12 blur-[110px] -z-10"
      />

      <motion.div
        initial={{ opacity: 0, y: 14, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-sm"
      >
        <div className="mb-7 flex flex-col items-center text-center">
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.12, type: "spring", stiffness: 220, damping: 20 }}
          >
            <Image
              src="/sprout-logo.png"
              alt="SPROUT — Be Fruitful and Multiply"
              width={644}
              height={575}
              priority
              className="h-28 w-auto"
            />
          </motion.div>
          <p className="mt-4 text-sm text-muted-foreground">
            Tempat tim tumbuh dan menerbitkan karya.
          </p>
        </div>

        <div className="rounded-3xl border border-border bg-card p-7 shadow-pop">
          <h2 className="mb-5 font-display text-xl tracking-tight">
            Selamat datang kembali
          </h2>
          <form action={formAction} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="identifier">Email atau Username</Label>
              <Input id="identifier" name="identifier" type="text" autoComplete="username" required />
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
