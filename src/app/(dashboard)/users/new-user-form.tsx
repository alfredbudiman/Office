"use client";

import { useActionState, useEffect, useState } from "react";
import { createUser } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function NewUserForm() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(createUser, null);

  useEffect(() => {
    if (state?.ok) setOpen(false);
  }, [state]);

  if (!open) return <Button onClick={() => setOpen(true)}>+ User baru</Button>;

  return (
    <form action={action} className="grid w-full grid-cols-1 gap-3 rounded-md border p-4 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-end">
      <div className="space-y-1">
        <Label htmlFor="nama">Nama</Label>
        <Input id="nama" name="nama" className="w-full" />
        {state?.errors?.nama && <p className="text-xs text-red-500">{state.errors.nama}</p>}
      </div>
      <div className="space-y-1">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" className="w-full" />
        {state?.errors?.email && <p className="text-xs text-red-500">{state.errors.email}</p>}
      </div>
      <div className="space-y-1">
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="text" className="w-full" />
        {state?.errors?.password && <p className="text-xs text-red-500">{state.errors.password}</p>}
      </div>
      <div className="space-y-1">
        <Label htmlFor="role">Role</Label>
        <select id="role" name="role" className="h-9 w-full rounded-md border px-2 text-sm">
          <option value="editor">editor (konten)</option>
          <option value="hrd">recruitment</option>
          <option value="social_media">social media &amp; ads manager</option>
          <option value="finance">finance (rekap hutang)</option>
          <option value="owner">owner (semua akses)</option>
        </select>
        {state?.errors?.role && <p className="text-xs text-red-500">{state.errors.role}</p>}
      </div>
      <div className="flex gap-2 sm:col-span-2 lg:col-span-1">
        <Button type="submit" disabled={pending} className="flex-1 sm:flex-none">{pending ? "Menyimpan..." : "Simpan"}</Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)} className="flex-1 sm:flex-none">Batal</Button>
      </div>
    </form>
  );
}
