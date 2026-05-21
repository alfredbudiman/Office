# Fase 1 — Fondasi (Auth, Role, Menu, Kelola User) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aplikasi Next.js yang bisa di-deploy ke Vercel di mana owner bisa login, melihat menu sidebar sesuai role, dan mengelola akun user (buat / nonaktifkan / set role).

**Architecture:** Next.js App Router (server-first) dengan Supabase sebagai Auth + Postgres. Role disimpan di tabel `profiles` (1:1 dengan `auth.users`). Akses dijaga di tiga lapis: middleware (redirect belum-login), helper server (`requireRole`), dan Row Level Security di database (penjaga sebenarnya). Logika murni (resolusi menu per role, validasi form) dipisah ke modul kecil yang di-test dengan Vitest (TDD).

**Tech Stack:** Next.js 15 (App Router) + TypeScript, @supabase/ssr, Tailwind CSS, shadcn/ui, Framer Motion, Vitest (unit test), Vercel (deploy).

---

## File Structure (Fase 1)

| File | Tanggung jawab |
|------|----------------|
| `package.json`, config files | Scaffolding & dependencies |
| `supabase/migrations/0001_profiles.sql` | Tabel `profiles`, enum role, trigger, RLS |
| `src/lib/roles.ts` | Tipe role + definisi menu per role (logika murni) |
| `src/lib/roles.test.ts` | Test resolusi menu per role |
| `src/lib/validation.ts` | Validasi form (email, password, nama) — logika murni |
| `src/lib/validation.test.ts` | Test validasi |
| `src/lib/supabase/server.ts` | Supabase client untuk Server Component / Action (SSR) |
| `src/lib/supabase/client.ts` | Supabase client untuk Client Component |
| `src/lib/supabase/admin.ts` | Supabase admin client (service role) — hanya server |
| `src/lib/auth.ts` | `getCurrentProfile()`, `requireRole()` |
| `src/middleware.ts` | Refresh sesi + proteksi route |
| `src/app/login/page.tsx` + `actions.ts` | Halaman & action login/logout |
| `src/app/(dashboard)/layout.tsx` | Shell dashboard + sidebar |
| `src/components/sidebar.tsx` | Render menu sesuai role (pakai `roles.ts`) |
| `src/app/(dashboard)/dashboard/page.tsx` | Halaman dashboard placeholder |
| `src/app/(dashboard)/users/page.tsx` + `actions.ts` | Kelola user (list/buat/nonaktif/role) |

---

## Task 0: Scaffolding project

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `vitest.config.ts`, `.env.local.example`, `.gitignore`

- [ ] **Step 1: Scaffold Next.js**

Run di folder project (`D:\Project Claude\video editing`):
```bash
npx create-next-app@latest . --typescript --tailwind --app --src-dir --import-alias "@/*" --no-eslint --use-npm
```
Jika ditanya overwrite karena folder `docs/` sudah ada, pilih "Yes" untuk lanjut (file `docs/` tidak akan dihapus).

- [ ] **Step 2: Install dependencies**

Run:
```bash
npm install @supabase/supabase-js @supabase/ssr framer-motion
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom
```

- [ ] **Step 3: Init shadcn/ui**

Run:
```bash
npx shadcn@latest init -d
npx shadcn@latest add button input label card table badge sonner dropdown-menu
```

- [ ] **Step 4: Add Vitest config**

Create `vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
```

Add to `package.json` scripts:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 5: Add env example**

Create `.env.local.example`:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```
Pastikan `.env.local` ada di `.gitignore` (default sudah, verifikasi).

- [ ] **Step 6: Verify build tooling**

Run: `npm run dev`
Expected: server jalan di http://localhost:3000 tanpa error. Hentikan setelah verifikasi.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: scaffold next.js + supabase + shadcn + vitest"
```

---

## Task 1: Supabase project & skema profiles

**Files:**
- Create: `supabase/migrations/0001_profiles.sql`

- [ ] **Step 1: Buat project Supabase (manual, dilakukan owner)**

Di https://supabase.com → New Project (BARU, terpisah dari project lain). Catat: Project URL, `anon` key, `service_role` key. Isi ke `.env.local` (copy dari `.env.local.example`). Catatan: ini langkah manual yang dilakukan owner; minta owner konfirmasi sudah terisi sebelum lanjut.

- [ ] **Step 2: Tulis migration SQL**

Create `supabase/migrations/0001_profiles.sql`:
```sql
-- Role enum
create type user_role as enum ('owner', 'editor', 'hrd');

-- Profile 1:1 dengan auth.users
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nama text not null,
  email text not null,
  role user_role not null default 'editor',
  aktif boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Helper: cek apakah user yang login adalah owner
create or replace function public.is_owner()
returns boolean
language sql security definer stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'owner' and aktif = true
  );
$$;

-- RLS: user lihat profil sendiri; owner lihat & ubah semua
create policy "profiles_select_self" on public.profiles
  for select using (id = auth.uid() or public.is_owner());

create policy "profiles_update_owner" on public.profiles
  for update using (public.is_owner()) with check (public.is_owner());

create policy "profiles_insert_owner" on public.profiles
  for insert with check (public.is_owner());

-- Auto-buat profil saat user baru dibuat (metadata diisi saat createUser)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, nama, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nama', new.email),
    new.email,
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'editor')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

- [ ] **Step 3: Jalankan migration**

Di Supabase Dashboard → SQL Editor → tempel isi `0001_profiles.sql` → Run.
Expected: "Success. No rows returned".

- [ ] **Step 4: Buat akun owner pertama (manual)**

Di Supabase Dashboard → Authentication → Users → Add user → isi email owner (alfred.budiman@gmail.com) + password. Lalu di SQL Editor:
```sql
update public.profiles set role = 'owner', nama = 'Alfred' where email = 'alfred.budiman@gmail.com';
```
Expected: 1 row updated. Verifikasi: `select id, email, role from public.profiles;` menampilkan role `owner`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0001_profiles.sql
git commit -m "feat: supabase profiles schema + RLS + owner bootstrap"
```

---

## Task 2: Role config & resolusi menu (TDD, logika murni)

**Files:**
- Create: `src/lib/roles.ts`
- Test: `src/lib/roles.test.ts`

- [ ] **Step 1: Tulis test yang gagal**

Create `src/lib/roles.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { menuForRole, type Role } from "@/lib/roles";

describe("menuForRole", () => {
  it("owner mendapat semua menu utama", () => {
    const hrefs = menuForRole("owner").map((m) => m.href);
    expect(hrefs).toEqual([
      "/dashboard",
      "/video",
      "/stok",
      "/rekap",
      "/users",
      "/absensi",
    ]);
  });

  it("editor hanya dashboard, video saya, absensi", () => {
    const hrefs = menuForRole("editor").map((m) => m.href);
    expect(hrefs).toEqual(["/dashboard", "/video", "/absensi"]);
  });

  it("hrd hanya dashboard dan absensi", () => {
    const hrefs = menuForRole("hrd").map((m) => m.href);
    expect(hrefs).toEqual(["/dashboard", "/absensi"]);
  });

  it("role tak dikenal mendapat menu kosong (fail safe)", () => {
    expect(menuForRole("xxx" as Role)).toEqual([]);
  });
});
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `npm test -- roles`
Expected: FAIL — "Cannot find module '@/lib/roles'".

- [ ] **Step 3: Implementasi minimal**

Create `src/lib/roles.ts`:
```ts
export type Role = "owner" | "editor" | "hrd";

export type MenuItem = { label: string; href: string };

const MENUS: Record<Role, MenuItem[]> = {
  owner: [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Video", href: "/video" },
    { label: "Stok Konten", href: "/stok" },
    { label: "Rekap Kinerja", href: "/rekap" },
    { label: "Kelola User", href: "/users" },
    { label: "Absensi", href: "/absensi" },
  ],
  editor: [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Video Saya", href: "/video" },
    { label: "Absensi", href: "/absensi" },
  ],
  hrd: [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Absensi", href: "/absensi" },
  ],
};

export function menuForRole(role: Role): MenuItem[] {
  return MENUS[role] ?? [];
}
```

- [ ] **Step 4: Jalankan test, pastikan lulus**

Run: `npm test -- roles`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/roles.ts src/lib/roles.test.ts
git commit -m "feat: role menu resolution with tests"
```

---

## Task 3: Validasi form (TDD, logika murni)

**Files:**
- Create: `src/lib/validation.ts`
- Test: `src/lib/validation.test.ts`

- [ ] **Step 1: Tulis test yang gagal**

Create `src/lib/validation.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { validateNewUser } from "@/lib/validation";

describe("validateNewUser", () => {
  it("menerima input valid", () => {
    const r = validateNewUser({ nama: "Budi", email: "budi@mail.com", password: "rahasia123", role: "editor" });
    expect(r.ok).toBe(true);
  });

  it("menolak nama kosong", () => {
    const r = validateNewUser({ nama: " ", email: "budi@mail.com", password: "rahasia123", role: "editor" });
    expect(r.ok).toBe(false);
    expect(r.errors.nama).toBeDefined();
  });

  it("menolak email tidak valid", () => {
    const r = validateNewUser({ nama: "Budi", email: "bukan-email", password: "rahasia123", role: "editor" });
    expect(r.ok).toBe(false);
    expect(r.errors.email).toBeDefined();
  });

  it("menolak password < 8 karakter", () => {
    const r = validateNewUser({ nama: "Budi", email: "budi@mail.com", password: "123", role: "editor" });
    expect(r.ok).toBe(false);
    expect(r.errors.password).toBeDefined();
  });

  it("menolak role tak dikenal", () => {
    const r = validateNewUser({ nama: "Budi", email: "budi@mail.com", password: "rahasia123", role: "raja" as never });
    expect(r.ok).toBe(false);
    expect(r.errors.role).toBeDefined();
  });
});
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `npm test -- validation`
Expected: FAIL — "Cannot find module '@/lib/validation'".

- [ ] **Step 3: Implementasi minimal**

Create `src/lib/validation.ts`:
```ts
import type { Role } from "@/lib/roles";

export type NewUserInput = { nama: string; email: string; password: string; role: Role };
export type ValidationResult = { ok: boolean; errors: Record<string, string> };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLES: Role[] = ["owner", "editor", "hrd"];

export function validateNewUser(input: NewUserInput): ValidationResult {
  const errors: Record<string, string> = {};
  if (!input.nama || !input.nama.trim()) errors.nama = "Nama wajib diisi";
  if (!EMAIL_RE.test(input.email)) errors.email = "Email tidak valid";
  if (!input.password || input.password.length < 8) errors.password = "Password minimal 8 karakter";
  if (!ROLES.includes(input.role)) errors.role = "Role tidak valid";
  return { ok: Object.keys(errors).length === 0, errors };
}
```

- [ ] **Step 4: Jalankan test, pastikan lulus**

Run: `npm test -- validation`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/validation.ts src/lib/validation.test.ts
git commit -m "feat: new-user form validation with tests"
```

---

## Task 4: Supabase clients (SSR, browser, admin)

**Files:**
- Create: `src/lib/supabase/server.ts`, `src/lib/supabase/client.ts`, `src/lib/supabase/admin.ts`

- [ ] **Step 1: Server client**

Create `src/lib/supabase/server.ts`:
```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // dipanggil dari Server Component — diabaikan, middleware yang refresh sesi
          }
        },
      },
    }
  );
}
```

- [ ] **Step 2: Browser client**

Create `src/lib/supabase/client.ts`:
```ts
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

- [ ] **Step 3: Admin client (service role — hanya server)**

Create `src/lib/supabase/admin.ts`:
```ts
import { createClient } from "@supabase/supabase-js";

// HANYA dipakai di server actions. Bypass RLS — jangan pernah import di client.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/supabase/
git commit -m "feat: supabase server, browser, and admin clients"
```

---

## Task 5: Auth helpers

**Files:**
- Create: `src/lib/auth.ts`

- [ ] **Step 1: Implementasi helper**

Create `src/lib/auth.ts`:
```ts
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/roles";

export type Profile = { id: string; nama: string; email: string; role: Role; aktif: boolean };

export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("id, nama, email, role, aktif")
    .eq("id", user.id)
    .single();
  if (!data || !data.aktif) return null;
  return data as Profile;
}

export async function requireProfile(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  return profile;
}

export async function requireRole(...roles: Role[]): Promise<Profile> {
  const profile = await requireProfile();
  if (!roles.includes(profile.role)) redirect("/dashboard");
  return profile;
}
```

- [ ] **Step 2: Verifikasi kompilasi**

Run: `npx tsc --noEmit`
Expected: tidak ada error pada `src/lib/auth.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/auth.ts
git commit -m "feat: auth helpers (getCurrentProfile, requireRole)"
```

---

## Task 6: Middleware proteksi route

**Files:**
- Create: `src/middleware.ts`

- [ ] **Step 1: Implementasi middleware**

Create `src/middleware.ts`:
```ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login"];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path.startsWith(p));

  if (!user && !isPublic) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (user && path === "/login") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
```

- [ ] **Step 2: Verifikasi**

Run: `npm run dev`, buka http://localhost:3000/dashboard tanpa login.
Expected: otomatis redirect ke `/login`. Hentikan dev server setelah cek.

- [ ] **Step 3: Commit**

```bash
git add src/middleware.ts
git commit -m "feat: auth middleware route protection"
```

---

## Task 7: Halaman login

**Files:**
- Create: `src/app/login/page.tsx`, `src/app/login/actions.ts`

- [ ] **Step 1: Login action**

Create `src/app/login/actions.ts`:
```ts
"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function login(_prev: unknown, formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "Email atau password salah" };
  redirect("/dashboard");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
```

- [ ] **Step 2: Login page**

Create `src/app/login/page.tsx`:
```tsx
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
```

- [ ] **Step 3: Verifikasi login**

Run: `npm run dev`, buka `/login`, masuk pakai akun owner dari Task 1 Step 4.
Expected: berhasil redirect ke `/dashboard` (halaman dibuat di Task 8). Sementara `/dashboard` belum ada → akan 404; itu wajar, lanjut Task 8.

- [ ] **Step 4: Commit**

```bash
git add src/app/login/
git commit -m "feat: login page and auth actions"
```

---

## Task 8: Dashboard layout + sidebar (menu per role)

**Files:**
- Create: `src/app/(dashboard)/layout.tsx`, `src/components/sidebar.tsx`, `src/app/(dashboard)/dashboard/page.tsx`

- [ ] **Step 1: Sidebar component**

Create `src/components/sidebar.tsx`:
```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import type { MenuItem } from "@/lib/roles";

export function Sidebar({ items, nama }: { items: MenuItem[]; nama: string }) {
  const pathname = usePathname();
  return (
    <aside className="flex w-60 flex-col border-r bg-background p-4">
      <div className="mb-6 px-2">
        <p className="text-sm text-muted-foreground">Halo,</p>
        <p className="font-semibold">{nama}</p>
      </div>
      <nav className="flex flex-col gap-1">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link key={item.href} href={item.href} className="relative rounded-md px-3 py-2 text-sm">
              {active && (
                <motion.span
                  layoutId="sidebar-active"
                  className="absolute inset-0 rounded-md bg-muted"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <span className={`relative ${active ? "font-medium" : "text-muted-foreground"}`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
```

- [ ] **Step 2: Dashboard layout**

Create `src/app/(dashboard)/layout.tsx`:
```tsx
import { requireProfile } from "@/lib/auth";
import { menuForRole } from "@/lib/roles";
import { Sidebar } from "@/components/sidebar";
import { logout } from "@/app/login/actions";
import { Button } from "@/components/ui/button";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();
  const items = menuForRole(profile.role);
  return (
    <div className="flex min-h-screen">
      <Sidebar items={items} nama={profile.nama} />
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b px-6 py-3">
          <span className="text-sm capitalize text-muted-foreground">{profile.role}</span>
          <form action={logout}>
            <Button variant="ghost" size="sm" type="submit">Keluar</Button>
          </form>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Dashboard placeholder page**

Create `src/app/(dashboard)/dashboard/page.tsx`:
```tsx
export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="mt-2 text-muted-foreground">Ringkasan akan diisi pada fase berikutnya.</p>
    </div>
  );
}
```

- [ ] **Step 4: Verifikasi end-to-end**

Run: `npm run dev`, login sebagai owner.
Expected: redirect ke `/dashboard`, sidebar menampilkan 6 menu owner (Dashboard, Video, Stok Konten, Rekap Kinerja, Kelola User, Absensi), tombol Keluar berfungsi (kembali ke `/login`).

- [ ] **Step 5: Commit**

```bash
git add "src/app/(dashboard)" src/components/sidebar.tsx
git commit -m "feat: dashboard layout with role-based sidebar"
```

---

## Task 9: Kelola User — list

**Files:**
- Create: `src/app/(dashboard)/users/page.tsx`

- [ ] **Step 1: Halaman daftar user**

Create `src/app/(dashboard)/users/page.tsx`:
```tsx
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { NewUserForm } from "./new-user-form";
import { UserRowActions } from "./user-row-actions";

export default async function UsersPage() {
  await requireRole("owner");
  const supabase = await createClient();
  const { data: users } = await supabase
    .from("profiles")
    .select("id, nama, email, role, aktif")
    .order("created_at", { ascending: true });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Kelola User</h1>
        <NewUserForm />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nama</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(users ?? []).map((u) => (
            <TableRow key={u.id}>
              <TableCell>{u.nama}</TableCell>
              <TableCell>{u.email}</TableCell>
              <TableCell className="capitalize">{u.role}</TableCell>
              <TableCell>
                <Badge variant={u.aktif ? "default" : "secondary"}>
                  {u.aktif ? "Aktif" : "Nonaktif"}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <UserRowActions id={u.id} role={u.role} aktif={u.aktif} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
```
(Komponen `NewUserForm` & `UserRowActions` dibuat di Task 10 & 11. Halaman belum bisa render penuh sampai keduanya ada — itu sebabnya ketiganya satu rangkaian.)

- [ ] **Step 2: Commit**

```bash
git add "src/app/(dashboard)/users/page.tsx"
git commit -m "feat: users list page (owner only)"
```

---

## Task 10: Kelola User — buat user baru

**Files:**
- Create: `src/app/(dashboard)/users/actions.ts`, `src/app/(dashboard)/users/new-user-form.tsx`

- [ ] **Step 1: Server action createUser**

Create `src/app/(dashboard)/users/actions.ts`:
```ts
"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateNewUser } from "@/lib/validation";
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
```

- [ ] **Step 2: Form komponen**

Create `src/app/(dashboard)/users/new-user-form.tsx`:
```tsx
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
    <form action={action} className="flex flex-wrap items-end gap-2 rounded-md border p-4">
      <div className="space-y-1">
        <Label htmlFor="nama">Nama</Label>
        <Input id="nama" name="nama" />
        {state?.errors?.nama && <p className="text-xs text-red-500">{state.errors.nama}</p>}
      </div>
      <div className="space-y-1">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" />
        {state?.errors?.email && <p className="text-xs text-red-500">{state.errors.email}</p>}
      </div>
      <div className="space-y-1">
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="text" />
        {state?.errors?.password && <p className="text-xs text-red-500">{state.errors.password}</p>}
      </div>
      <div className="space-y-1">
        <Label htmlFor="role">Role</Label>
        <select id="role" name="role" className="h-9 rounded-md border px-2 text-sm">
          <option value="editor">editor</option>
          <option value="hrd">hrd</option>
          <option value="owner">owner</option>
        </select>
        {state?.errors?.role && <p className="text-xs text-red-500">{state.errors.role}</p>}
      </div>
      <Button type="submit" disabled={pending}>{pending ? "Menyimpan..." : "Simpan"}</Button>
      <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Batal</Button>
    </form>
  );
}
```

- [ ] **Step 3: Verifikasi**

Run: `npm run dev`, login owner → `/users` → "+ User baru" → isi editor baru → Simpan.
Expected: user baru muncul di tabel dengan role editor & status Aktif. Login dengan akun editor baru di browser lain → sidebar hanya 3 menu (Dashboard, Video Saya, Absensi).

- [ ] **Step 4: Commit**

```bash
git add "src/app/(dashboard)/users/actions.ts" "src/app/(dashboard)/users/new-user-form.tsx"
git commit -m "feat: create new user (owner, service role)"
```

---

## Task 11: Kelola User — ubah role & nonaktifkan

**Files:**
- Modify: `src/app/(dashboard)/users/actions.ts` (tambah fungsi)
- Create: `src/app/(dashboard)/users/user-row-actions.tsx`

- [ ] **Step 1: Tambah action setRole & setAktif**

Tambahkan ke `src/app/(dashboard)/users/actions.ts`:
```ts
import { createClient } from "@/lib/supabase/server";

export async function setUserRole(id: string, role: Role) {
  await requireRole("owner");
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ role }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/users");
  return { ok: true };
}

export async function setUserAktif(id: string, aktif: boolean) {
  await requireRole("owner");
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ aktif }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/users");
  return { ok: true };
}
```

- [ ] **Step 2: Row actions komponen**

Create `src/app/(dashboard)/users/user-row-actions.tsx`:
```tsx
"use client";

import { useTransition } from "react";
import { setUserRole, setUserAktif } from "./actions";
import { Button } from "@/components/ui/button";
import type { Role } from "@/lib/roles";

export function UserRowActions({ id, role, aktif }: { id: string; role: Role; aktif: boolean }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex justify-end gap-2">
      <select
        defaultValue={role}
        disabled={pending}
        className="h-8 rounded-md border px-2 text-sm"
        onChange={(e) => start(() => { setUserRole(id, e.target.value as Role); })}
      >
        <option value="editor">editor</option>
        <option value="hrd">hrd</option>
        <option value="owner">owner</option>
      </select>
      <Button
        size="sm"
        variant={aktif ? "secondary" : "default"}
        disabled={pending}
        onClick={() => start(() => { setUserAktif(id, !aktif); })}
      >
        {aktif ? "Nonaktifkan" : "Aktifkan"}
      </Button>
    </div>
  );
}
```

- [ ] **Step 3: Verifikasi**

Run: `npm run dev`, di `/users` ubah role editor → hrd (tabel ter-update), klik Nonaktifkan (status jadi Nonaktif). Login user nonaktif → ditolak (redirect ke `/login`, karena `getCurrentProfile` mengembalikan null saat `aktif=false`).

- [ ] **Step 4: Commit**

```bash
git add "src/app/(dashboard)/users/"
git commit -m "feat: change user role and activate/deactivate"
```

---

## Task 12: Deploy ke Vercel

**Files:**
- Create: `README.md` (catatan setup singkat)

- [ ] **Step 1: Push ke remote git baru**

Buat repo baru (GitHub) lalu:
```bash
git remote add origin <URL_REPO_BARU>
git push -u origin main
```

- [ ] **Step 2: Buat project Vercel BARU**

Di Vercel → Add New Project → import repo ini (project BARU, jangan ubah project lain). Framework otomatis terdeteksi Next.js.

- [ ] **Step 3: Set environment variables di Vercel**

Tambah di Settings → Environment Variables (Production + Preview):
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

- [ ] **Step 4: Deploy & verifikasi**

Trigger deploy. Buka URL produksi, login sebagai owner.
Expected: login sukses, sidebar tampil, `/users` bisa buat user. (Supabase Auth → URL Configuration: tambahkan domain Vercel ke Redirect/Site URL bila diperlukan.)

- [ ] **Step 5: Commit README**

Create `README.md` dengan ringkasan: cara setup `.env.local`, jalankan `npm run dev`, jalankan `npm test`, dan urutan fase build.
```bash
git add README.md
git commit -m "docs: setup readme"
git push
```

---

## Self-Review (sudah dijalankan penulis)

**Spec coverage (Fase 1):**
- Auth/login → Task 5,7. Role + RLS → Task 1,2,5,6. Menu per role → Task 2,8. Kelola user (buat/nonaktif/role) → Task 9,10,11. Deploy Vercel project baru → Task 12. ✅
- Fitur fase lain (video, stok, rekap, absensi) sengaja DI LUAR plan ini — masing-masing dapat plan sendiri. Menu-nya sudah ada tapi halaman `/video`, `/stok`, `/rekap`, `/absensi` akan dibuat di fase berikutnya (saat ini akan 404 jika diklik — diterima untuk Fase 1).

**Placeholder scan:** Tidak ada TBD/TODO menggantung; semua step berisi kode konkret. Placeholder yang disengaja hanya halaman dashboard (diisi fase berikut) — eksplisit.

**Type consistency:** `Role`, `MenuItem`, `Profile`, `validateNewUser`, `menuForRole`, `createClient`, `createAdminClient`, `requireRole`/`requireProfile` konsisten dipakai lintas task.

**Catatan dependensi antar-task:** Task 9–11 (halaman users + komponen) saling melengkapi; halaman `/users` baru render penuh setelah Task 11 selesai.

## Di luar cakupan plan ini (akan jadi plan terpisah)
- Fase 2: Modul Video Editor (kanban, detail, draft, komentar, notif Realtime).
- Fase 3: Stok Konten + Rekap Kinerja.
- Fase 4: Absensi (clock in/out + rekap).
