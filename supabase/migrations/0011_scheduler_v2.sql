-- Scheduler v2: penanda "sudah diposting" + persiapan materi (thumbnail/desc/tags).

-- Konten yang sudah diposting di luar penjadwalan → disembunyikan dari dropdown + Jadwalkan.
create table public.posted_content (
  content_key text primary key,                 -- 'v:<video_id>' atau 't:<judul lower>'
  source_type text not null check (source_type in ('video', 'bank_konten', 'manual')),
  title text not null,
  video_id uuid references public.videos(id) on delete set null,
  marked_by uuid references public.profiles(id),
  marked_at timestamptz not null default now()
);

-- Materi siap-pakai per konten (disiapkan sebelum tayang, tinggal copy saat posting).
create table public.content_prep (
  content_key text primary key,
  thumbnail_url text,
  description text,
  tags text,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

alter table public.posted_content enable row level security;
alter table public.content_prep enable row level security;

create policy "posted_select" on public.posted_content for select using (public.can_manage_schedule());
create policy "posted_insert" on public.posted_content for insert with check (public.can_manage_schedule());
create policy "posted_delete" on public.posted_content for delete using (public.can_manage_schedule());

create policy "prep_select" on public.content_prep for select using (public.can_manage_schedule());
create policy "prep_insert" on public.content_prep for insert with check (public.can_manage_schedule());
create policy "prep_update" on public.content_prep for update using (public.can_manage_schedule()) with check (public.can_manage_schedule());

-- Bucket publik untuk thumbnail (upload lewat service role / bypass RLS; baca publik).
insert into storage.buckets (id, name, public)
values ('thumbnails', 'thumbnails', true)
on conflict (id) do nothing;
