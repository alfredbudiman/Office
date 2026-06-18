-- Scheduler posting konten (pencatatan jadwal, bukan auto-publish).

create type public.post_platform as enum ('youtube', 'youtube_shorts', 'tiktok', 'instagram');
create type public.post_status as enum ('scheduled', 'posted');

create table public.post_schedule (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  -- asal konten: video Final, item Bank Konten (sheet), atau ketik manual
  source_type text not null default 'manual' check (source_type in ('video', 'bank_konten', 'manual')),
  video_id uuid references public.videos(id) on delete set null,
  drive_url text,
  platform public.post_platform not null,
  scheduled_at timestamptz not null,
  status public.post_status not null default 'scheduled',
  posted_at timestamptz,
  note text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index on public.post_schedule (scheduled_at);
create index on public.post_schedule (status);

-- Boleh kelola jadwal: owner atau social media & ads manager.
create or replace function public.can_manage_schedule()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('owner', 'social_media') and aktif = true
  );
$$;

alter table public.post_schedule enable row level security;

create policy "sched_select" on public.post_schedule for select
  using (public.can_manage_schedule());
create policy "sched_insert" on public.post_schedule for insert
  with check (public.can_manage_schedule());
create policy "sched_update" on public.post_schedule for update
  using (public.can_manage_schedule()) with check (public.can_manage_schedule());
create policy "sched_delete" on public.post_schedule for delete
  using (public.can_manage_schedule());

-- Social media manager boleh BACA daftar video (read-only) untuk picker di form jadwal.
drop policy if exists "videos_select" on public.videos;
create policy "videos_select" on public.videos for select
  using (public.is_owner() or editor_id = auth.uid() or public.can_manage_schedule());
