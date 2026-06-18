import type { Role } from "@/lib/roles";

export type NewUserInput = { nama: string; email: string; password: string; role: Role };
export type ValidationResult = { ok: boolean; errors: Record<string, string> };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLES: Role[] = ["owner", "editor", "hrd", "social_media"];

export function validateNewUser(input: NewUserInput): ValidationResult {
  const errors: Record<string, string> = {};
  if (!input.nama || !input.nama.trim()) errors.nama = "Nama wajib diisi";
  if (!EMAIL_RE.test(input.email)) errors.email = "Email tidak valid";
  if (!input.password || input.password.length < 8) errors.password = "Password minimal 8 karakter";
  if (!ROLES.includes(input.role)) errors.role = "Role tidak valid";
  return { ok: Object.keys(errors).length === 0, errors };
}
