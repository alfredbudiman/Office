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
language sql security definer stable set search_path = public
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
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nama, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nama', new.email),
    new.email,
    coalesce((new.raw_user_meta_data->>'role')::public.user_role, 'editor')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
