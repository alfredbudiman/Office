-- Role baru: finance (Irene) — hanya akses Rekapitulasi Hutang.
-- File terpisah dari pemakaiannya (Postgres tak boleh pakai nilai enum baru di transaksi yang sama).
alter type public.user_role add value if not exists 'finance';
