-- =====================================================================
--  DKM Masjid Jami Turayah — TULISAN BERJALAN (info berjalan)
--  Jalankan sekali di Supabase: SQL Editor -> New query -> paste -> Run.
--  Tampil di atas aplikasi pengurus dan halaman jamaah (/jamaah).
--  Diatur oleh Admin / Ketua Umum lewat menu Kelola -> Info Berjalan.
-- =====================================================================

create table if not exists public.info_berjalan_setting (
  id             integer primary key default 1 check (id = 1),
  aktif          boolean not null default true,
  salam          text default 'السَّلَامُ عَلَيْكُمْ',
  auto_saldo     boolean not null default true,
  auto_jumat     boolean not null default true,
  diubah_by      uuid references public.profiles(id),
  diubah_at      timestamptz
);
insert into public.info_berjalan_setting (id) values (1) on conflict (id) do nothing;

create table if not exists public.info_berjalan (
  id          bigserial primary key,
  teks        text not null check (length(trim(teks)) between 3 and 200),
  aktif       boolean not null default true,
  urutan      integer not null default 0,
  dibuat_by   uuid references public.profiles(id),
  created_at  timestamptz not null default now()
);

alter table public.info_berjalan_setting enable row level security;
alter table public.info_berjalan enable row level security;

drop policy if exists "ib_set_baca" on public.info_berjalan_setting;
create policy "ib_set_baca" on public.info_berjalan_setting for select to authenticated using (is_member());
drop policy if exists "ib_set_ubah" on public.info_berjalan_setting;
create policy "ib_set_ubah" on public.info_berjalan_setting for update to authenticated
  using (has_role(array['admin','ketum'])) with check (has_role(array['admin','ketum']));

drop policy if exists "ib_baca" on public.info_berjalan;
create policy "ib_baca" on public.info_berjalan for select to authenticated using (is_member());
drop policy if exists "ib_tulis" on public.info_berjalan;
create policy "ib_tulis" on public.info_berjalan for insert to authenticated with check (has_role(array['admin','ketum']));
drop policy if exists "ib_ubah" on public.info_berjalan;
create policy "ib_ubah" on public.info_berjalan for update to authenticated
  using (has_role(array['admin','ketum'])) with check (has_role(array['admin','ketum']));
drop policy if exists "ib_hapus" on public.info_berjalan;
create policy "ib_hapus" on public.info_berjalan for delete to authenticated using (has_role(array['admin','ketum']));

-- Dibaca oleh aplikasi pengurus DAN halaman jamaah (tanpa login).
-- Hanya mengembalikan teks yang memang untuk ditampilkan ke publik.
create or replace function public.info_berjalan_publik()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare s info_berjalan_setting; m maklumat;
begin
  select * into s from info_berjalan_setting where id = 1;
  if s.id is null or not s.aktif then return jsonb_build_object('aktif', false); end if;

  if s.auto_jumat then
    select * into m from maklumat where tanggal >= today_wib() order by tanggal limit 1;
  end if;

  return jsonb_build_object(
    'aktif', true,
    'salam', nullif(trim(coalesce(s.salam, '')), ''),
    'pesan', coalesce((select jsonb_agg(teks order by urutan, id) from info_berjalan where aktif), '[]'::jsonb),
    'saldo', case when s.auto_saldo then
               (select coalesce(sum(case when jenis = 'masuk' then jumlah else -jumlah end), 0) from kas) end,
    'jumat', case when m.id is not null then
               jsonb_build_object('tanggal', m.tanggal, 'khatib', m.khatib, 'muadzin', m.muadzin) end
  );
end $$;

revoke all on function public.info_berjalan_publik() from public;
grant execute on function public.info_berjalan_publik() to anon, authenticated;
