"use client";

import { useActionState } from "react";
import { motion } from "framer-motion";
import { login } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, null);
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Card className="w-full max-w-sm p-6">
          <h1 className="mb-1 text-xl font-semibold">Masuk</h1>
          <p className="mb-4 text-sm text-muted-foreground">Dashboard Tim</p>
          <form action={formAction} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" required />
            </div>
            {state?.error && <p className="text-sm text-red-500">{state.error}</p>}
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Memproses..." : "Masuk"}
            </Button>
          </form>
        </Card>
      </motion.div>
    </div>
  );
}
