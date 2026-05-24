-- Tambah username opsional ke profiles (untuk login pakai username)
alter table public.profiles
  add column if not exists username text;

-- Unique case-insensitive (mencegah Alfred & alfred bentrok)
create unique index if not exists profiles_username_lower_uniq
  on public.profiles (lower(username));

-- Set username Alfred untuk akun owner (alfred.budiman@gmail.com)
update public.profiles
  set username = 'Alfred'
  where email = 'alfred.budiman@gmail.com'
    and username is null;
