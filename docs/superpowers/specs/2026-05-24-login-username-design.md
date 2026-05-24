# Login dengan Username — Design

**Tanggal:** 2026-05-24
**Status:** Disetujui (menunggu user review)
**Scope:** Tambah kemampuan login pakai username (selain email) — saat ini hanya akun Alfred yang punya username.

## Latar Belakang

Form login sekarang minta email + password (`supabase.auth.signInWithPassword({ email, password })`). Alfred minta bisa login pakai username pendek `"Alfred"` + password `"Alfred88"` biar cepat. App sudah live di Vercel dan multi-user (owner/editor/hrd), jadi solusi harus:

- Tidak memaksa user lain ikut punya username.
- Tetap pakai Supabase Auth (tidak bikin sistem auth paralel).
- Tidak membocorkan keberadaan username/email valid lewat error message.

## Keputusan

Tambah kolom `username` (unique, nullable) di `public.profiles`. Form login menerima "email atau username". Server action membedakan keduanya berdasarkan keberadaan karakter `@`:

- Ada `@` → langsung `signInWithPassword({ email: input, password })` seperti sekarang.
- Tidak ada `@` → resolve username → email lewat admin client (bypass RLS), lalu signIn pakai email tersebut.

User lain tetap login pakai email seperti biasa. Username opsional, bisa ditambahkan per user di kemudian hari lewat tabel `profiles`.

## Perubahan

### 1. Migrasi `supabase/migrations/0004_username.sql`

```sql
alter table public.profiles
  add column username text unique;

create index profiles_username_lower_idx on public.profiles (lower(username));

-- Set username untuk Alfred (email aktual diisi saat eksekusi)
update public.profiles
  set username = 'Alfred'
  where email = '<email-Alfred>';
```

Catatan:
- `username` nullable — user lain boleh tidak punya username.
- `unique` constraint mencegah dua user punya username yang sama (NULL diperbolehkan berkali-kali di Postgres).
- Index pada `lower(username)` agar lookup case-insensitive cepat.

### 2. Server action `src/app/login/actions.ts`

```ts
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
```

Catatan keamanan:
- Pesan error sama persis untuk semua kegagalan (username tidak ada / password salah / user nonaktif) → tidak ada user enumeration.
- `createAdminClient()` hanya dipakai untuk SELECT `email` berdasar `username` + `aktif=true`. Tidak menulis apa pun.
- `ilike` membuat lookup case-insensitive.

### 3. Form `src/app/login/page.tsx`

- Label: `"Email atau Username"`.
- Input: `name="identifier"`, `type="text"`, `autoComplete="username"` (browser autofill tetap jalan).
- Hapus `type="email"` agar browser tidak menolak input tanpa `@`.

### 4. Password Alfred

Set lewat Supabase dashboard (Auth → Users → edit user Alfred → Reset password = `Alfred88`). Tidak ada perubahan kode untuk ini.

## Non-Goals

- Menambah username untuk user lain (bisa dilakukan manual di SQL Editor: `update profiles set username = '...' where email = '...'`).
- Mengubah skema RLS (tidak perlu — lookup pakai admin client yang sudah ada).
- Sign-up via username (sign-up tetap tidak ada di app ini — user dibuat oleh owner via halaman kelola user).
- Password recovery via username (di luar scope; tetap email-based via Supabase).

## Edge Cases

- **User ketik email yang tidak terdaftar:** Supabase return error → kita map ke `GENERIC_ERROR`.
- **User ketik username yang ada tapi user-nya `aktif=false`:** Filter `aktif=true` di query → tidak ditemukan → `GENERIC_ERROR`.
- **User ketik string dengan `@` tapi bukan email valid:** Supabase reject → `GENERIC_ERROR`.
- **Case sensitivity:** `ALFRED`, `alfred`, `Alfred` semua match karena `ilike`.
- **Username & email collision:** Constraint `unique` di Postgres mencegah dua user punya username sama. Tidak ada constraint cross-kolom karena email punya `@`, username tidak boleh punya `@` (akan kita tegakkan dengan check constraint? — **tidak** untuk sekarang; manual disiplin cukup, dan kalau lolos pun query `ilike` tetap match dengan benar).

## Test Plan

Manual di staging/local:
1. Login `Alfred` + `Alfred88` → sukses, masuk dashboard.
2. Login `alfred` (lowercase) + `Alfred88` → sukses (case-insensitive).
3. Login `<email-Alfred>` + `Alfred88` → sukses (email path masih jalan).
4. Login user lain (Bayu/HRD) pakai email + password mereka → sukses.
5. Login `Alfred` + password salah → error generik.
6. Login `Bayu` (user lain belum punya username) + password apa pun → error generik.
7. Login `Alfred ` (dengan spasi trailing) + password benar → sukses (karena `trim()`).

## File yang Disentuh

- `supabase/migrations/0004_username.sql` (baru)
- `src/app/login/actions.ts`
- `src/app/login/page.tsx`

## Risiko

- **Admin client di server action:** sudah dipakai di tempat lain (lihat `src/lib/supabase/admin.ts`). Yang dilakukan di sini hanya SELECT terbatas, tidak ada penulisan.
- **Password lemah:** `Alfred88` mudah ditebak. User sadar dan tetap minta itu. Tidak ada lockout/rate limiting di app — bergantung pada rate limit Supabase Auth (sudah aktif default).
