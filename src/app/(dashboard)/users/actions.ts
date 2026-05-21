"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateNewUser } from "@/lib/validation";
import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/roles";

export async function createUser(_prev: unknown, formData: FormData) {
  await requireRole("owner");
  const input = {
    nama: String(formData.get("nama") ?? ""),
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
    role: String(formData.get("role") ?? "editor") as Role,
  };
  const v = validateNewUser(input);
  if (!v.ok) return { ok: false, errors: v.errors };

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: { nama: input.nama, role: input.role },
  });
  if (error) return { ok: false, errors: { email: error.message } };

  revalidatePath("/users");
  return { ok: true, errors: {} };
}

export async function setUserRole(id: string, role: Role) {
  const actor = await requireRole("owner");
  // Cegah owner mengunci diri sendiri keluar (turunkan role akun sendiri).
  if (id === actor.id && role !== "owner") {
    return { ok: false, error: "Tidak bisa menurunkan role akun sendiri." };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ role }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/users");
  return { ok: true };
}

export async function setUserAktif(id: string, aktif: boolean) {
  const actor = await requireRole("owner");
  // Cegah owner menonaktifkan akun sendiri (akan terkunci permanen).
  if (id === actor.id && !aktif) {
    return { ok: false, error: "Tidak bisa menonaktifkan akun sendiri." };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ aktif }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/users");
  return { ok: true };
}
