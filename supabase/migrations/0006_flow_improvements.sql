-- videos: kolom tipe_custom + constraint wajib kalau tipe='lainnya'
alter table public.videos add column if not exists tipe_custom text;
alter table public.videos drop constraint if exists videos_tipe_custom_required;
alter table public.videos add constraint videos_tipe_custom_required
  check (tipe <> 'lainnya' or (tipe_custom is not null and char_length(tipe_custom) between 1 and 50));

-- status_events: kolom note (catatan owner saat lompat status)
alter table public.status_events add column if not exists note text;

-- attendance: kolom ringkasan kerja saat clock out
alter table public.attendance add column if not exists progress_summary text;

-- tabel settings (KV global, owner-only write)
create table if not exists public.settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

alter table public.settings enable row level security;

drop policy if exists "settings_select" on public.settings;
create policy "settings_select" on public.settings for select using (true);

drop policy if exists "settings_write" on public.settings;
create policy "settings_write" on public.settings for all
  using (public.is_owner()) with check (public.is_owner());

-- seed key (value kosong dulu, owner isi via UI)
insert into public.settings (key, value)
  values ('drive_folder_url', '')
  on conflict (key) do nothing;
