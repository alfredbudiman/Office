create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  tanggal date not null default current_date,
  clock_in timestamptz,
  clock_out timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, tanggal)
);

create index on public.attendance (tanggal);
create index on public.attendance (user_id, tanggal);

-- owner & hrd boleh lihat semua absensi
create or replace function public.can_view_all_attendance()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('owner', 'hrd') and aktif = true
  );
$$;

alter table public.attendance enable row level security;

create policy "att_select" on public.attendance for select
  using (user_id = auth.uid() or public.can_view_all_attendance());
create policy "att_insert" on public.attendance for insert
  with check (user_id = auth.uid());
create policy "att_update" on public.attendance for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
