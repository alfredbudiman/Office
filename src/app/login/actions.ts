"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const GENERIC_ERROR = "Email/username atau password salah";

export async function login(_prev: unknown, formData: FormData) {
  const identifier = String(formData.get("identifier") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!identifier || !password) return { error: GENERIC_ERROR };

  let email = identifier;
  if (!identifier.includes("@")) {
    const admin = createAdminClient();
    const { data } = await admin
      .from("profiles")
      .select("email")
      .ilike("username", identifier)
      .eq("aktif", true)
      .maybeSingle();
    if (!data?.email) return { error: GENERIC_ERROR };
    email = data.email;
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: GENERIC_ERROR };
  redirect("/dashboard");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
