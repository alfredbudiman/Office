-- Role baru: Social Media & Ads Manager.
-- File terpisah dari pemakaiannya: Postgres tidak boleh memakai nilai enum baru
-- di transaksi yang sama dengan ALTER TYPE ... ADD VALUE.
alter type public.user_role add value if not exists 'social_media';
