create type video_type as enum ('monolog', 'podcast', 'shorts', 'clipping');
create type video_status as enum ('draft_brief', 'cut_to_cut', 'review_cut', 'editing', 'review_draft', 'final', 'tayang');

create table public.videos (
  id uuid primary key default gen_random_uuid(),
  judul text not null,
  tipe video_type not null,
  status video_status not null,
  editor_id uuid references public.profiles(id) on delete set null,
  parent_video_id uuid references public.videos(id) on delete set null,
  link_source text,
  target_tayang date,
  sudah_tayang boolean not null default false,
  published_at timestamptz,
  final_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.drafts (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos(id) on delete cascade,
  nomor_draft int not null,
  link_draft text not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  isi text not null,
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  pesan text not null,
  link text,
  sudah_dibaca boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.status_events (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos(id) on delete cascade,
  status_lama video_status,
  status_baru video_status not null,
  changed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index on public.videos (editor_id);
create index on public.videos (status);
create index on public.drafts (video_id);
create index on public.comments (video_id);
create index on public.notifications (user_id, sudah_dibaca);
create index on public.status_events (video_id);

-- Helper: apakah user peserta video ini (owner atau editor yang ditugaskan)
create or replace function public.is_video_participant(vid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select public.is_owner() or exists (
    select 1 from public.videos v where v.id = vid and v.editor_id = auth.uid()
  );
$$;

alter table public.videos enable row level security;
alter table public.drafts enable row level security;
alter table public.comments enable row level security;
alter table public.notifications enable row level security;
alter table public.status_events enable row level security;

-- videos: owner semua; editor hanya miliknya
create policy "videos_select" on public.videos for select
  using (public.is_owner() or editor_id = auth.uid());
create policy "videos_insert" on public.videos for insert
  with check (public.is_owner());
create policy "videos_update" on public.videos for update
  using (public.is_owner() or editor_id = auth.uid())
  with check (public.is_owner() or editor_id = auth.uid());

-- drafts: peserta video
create policy "drafts_select" on public.drafts for select
  using (public.is_video_participant(video_id));
create policy "drafts_insert" on public.drafts for insert
  with check (public.is_video_participant(video_id));

-- comments: peserta video
create policy "comments_select" on public.comments for select
  using (public.is_video_participant(video_id));
create policy "comments_insert" on public.comments for insert
  with check (public.is_video_participant(video_id) and user_id = auth.uid());

-- notifications: milik sendiri
create policy "notif_select" on public.notifications for select
  using (user_id = auth.uid());
create policy "notif_update" on public.notifications for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- status_events: peserta video
create policy "events_select" on public.status_events for select
  using (public.is_video_participant(video_id));
create policy "events_insert" on public.status_events for insert
  with check (public.is_video_participant(video_id));
