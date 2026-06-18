-- Rekapitulasi Hutang.

create table public.debt_people (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  monthly_pa numeric not null default 0,   -- biaya PA bulanan, di-assign saat tambah
  active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.debt_charges (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.debt_people(id) on delete cascade,
  category text not null check (category in ('monday_lab', 'pa', 'lainnya')),
  occurred_on date not null,                -- monday_lab: tgl acara; pa: tgl 1 bulan; lainnya: tgl
  qty numeric not null default 1,
  unit_price numeric not null default 0,
  amount numeric not null default 0,        -- qty * unit_price (diisi app)
  description text,
  paid boolean not null default false,
  paid_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index on public.debt_charges (category, occurred_on);
create index on public.debt_charges (person_id);

-- Boleh kelola hutang: owner atau finance (Irene).
create or replace function public.can_manage_debt()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('owner', 'finance') and aktif = true
  );
$$;

alter table public.debt_people enable row level security;
alter table public.debt_charges enable row level security;

create policy "debt_people_all" on public.debt_people for all
  using (public.can_manage_debt()) with check (public.can_manage_debt());
create policy "debt_charges_all" on public.debt_charges for all
  using (public.can_manage_debt()) with check (public.can_manage_debt());
