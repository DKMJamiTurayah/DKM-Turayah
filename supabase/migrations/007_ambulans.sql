-- =====================================================================
--  DKM Masjid Jami Turayah — AMBULANS: alur pemakaian + approval Ketum
--  Jalankan sekali di Supabase: SQL Editor -> New query -> paste -> Run.
--  Jalankan SETELAH 001–006.
--
--  Alur tiap pemakaian (trip), 6 tahap, tiap tahap: ajukan -> approve Ketum
--    1 pemakai      Nama pemakai ambulans
--    2 tujuan       Tujuan pemakaian, nama RS, daerah/kota
--    3 km_awal      KM awal (saat berangkat)
--    4 km_akhir     KM akhir (saat kembali)
--    5 uang_jalan   Pengajuan uang jalan
--    6 uang_toll    Pengajuan uang toll
--  Summary KM / uang jalan / uang toll dihitung otomatis dari tahap yang disetujui.
--  Trip otomatis "selesai" kalau ke-6 tahap sudah disetujui.
--  Saat Ketum menyetujui uang jalan / uang toll, otomatis tercatat sebagai
--  pengeluaran di Buku Kas pos "Ambulans".
-- =====================================================================

create table if not exists public.ambulans_trip (
  id bigserial primary key,
  status text not null default 'berjalan' check (status in ('berjalan','selesai','dibatalkan')),
  dibuat_by uuid references public.profiles(id),
  dibuat_at timestamptz not null default now(),
  selesai_at timestamptz
);

create table if not exists public.ambulans_tahap (
  id bigserial primary key,
  trip_id bigint not null references public.ambulans_trip(id) on delete cascade,
  jenis text not null check (jenis in ('pemakai','tujuan','km_awal','km_akhir','uang_jalan','uang_toll')),
  teks text,                      -- pemakai: nama; tujuan: tujuan pemakaian
  rs text,                        -- tujuan: nama RS
  kota text,                      -- tujuan: daerah / kota
  angka numeric(14,0),            -- km_awal, km_akhir, uang_jalan, uang_toll
  status text not null default 'diajukan' check (status in ('diajukan','disetujui','ditolak')),
  diajukan_by uuid references public.profiles(id),
  diajukan_at timestamptz not null default now(),
  putus_by uuid references public.profiles(id),
  putus_at timestamptz,
  catatan text,                   -- catatan Ketum (mis. alasan ditolak)
  kas_id bigint references public.kas(id),
  unique (trip_id, jenis)
);
create index if not exists ambulans_tahap_status_idx on public.ambulans_tahap (status);

alter table public.ambulans_trip  enable row level security;
alter table public.ambulans_tahap enable row level security;
drop policy if exists baca_amb_trip  on public.ambulans_trip;
drop policy if exists baca_amb_tahap on public.ambulans_tahap;
create policy baca_amb_trip  on public.ambulans_trip  for select to authenticated using (public.is_member());
create policy baca_amb_tahap on public.ambulans_tahap for select to authenticated using (public.is_member());
-- tulis hanya lewat fungsi di bawah

-- Ajukan satu tahap. p_trip null + jenis 'pemakai' = mulai pemakaian baru.
-- Tahap yang ditolak boleh diajukan ulang (nilai diganti).
create or replace function public.ambulans_ajukan(p_trip bigint, p_jenis text, p_teks text, p_rs text, p_kota text, p_angka numeric)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_trip bigint := p_trip; t ambulans_trip; x ambulans_tahap; v_awal numeric;
        v_urut text[] := array['pemakai','tujuan','km_awal','km_akhir'];
        v_prev text; v_ok boolean;
begin
  if not is_member() then raise exception 'Hanya pengurus yang bisa mengajukan'; end if;
  if p_jenis not in ('pemakai','tujuan','km_awal','km_akhir','uang_jalan','uang_toll') then raise exception 'Tahap tidak dikenal'; end if;

  if v_trip is null then
    if p_jenis <> 'pemakai' then raise exception 'Mulai dari nama pemakai ambulans'; end if;
    insert into ambulans_trip (dibuat_by) values (auth.uid()) returning id into v_trip;
  end if;

  select * into t from ambulans_trip where id = v_trip for update;
  if t.id is null then raise exception 'Data pemakaian tidak ditemukan'; end if;
  if t.status <> 'berjalan' then raise exception 'Pemakaian ini sudah % ', t.status; end if;

  -- isian wajib
  if p_jenis = 'pemakai' and coalesce(trim(p_teks),'') = '' then raise exception 'Nama pemakai wajib diisi'; end if;
  if p_jenis = 'tujuan' and (coalesce(trim(p_teks),'') = '' or coalesce(trim(p_rs),'') = '' or coalesce(trim(p_kota),'') = '') then
    raise exception 'Tujuan, nama RS, dan daerah/kota wajib diisi'; end if;
  if p_jenis in ('km_awal','km_akhir','uang_jalan','uang_toll') and coalesce(p_angka,0) <= 0 then
    raise exception 'Angka harus lebih dari 0'; end if;

  -- urutan: 1-4 berurutan; uang jalan & toll boleh setelah KM awal disetujui
  if p_jenis in ('tujuan','km_awal','km_akhir') then
    v_prev := v_urut[array_position(v_urut, p_jenis) - 1];
    select exists (select 1 from ambulans_tahap where trip_id = v_trip and jenis = v_prev and status = 'disetujui') into v_ok;
    if not v_ok then raise exception 'Tahap sebelumnya belum disetujui Ketum'; end if;
  elsif p_jenis in ('uang_jalan','uang_toll') then
    select exists (select 1 from ambulans_tahap where trip_id = v_trip and jenis = 'km_awal' and status = 'disetujui') into v_ok;
    if not v_ok then raise exception 'KM awal harus disetujui Ketum dulu'; end if;
  end if;

  if p_jenis = 'km_akhir' then
    select angka into v_awal from ambulans_tahap where trip_id = v_trip and jenis = 'km_awal';
    if p_angka <= v_awal then raise exception 'KM akhir harus lebih besar dari KM awal (%)', v_awal; end if;
  end if;

  select * into x from ambulans_tahap where trip_id = v_trip and jenis = p_jenis for update;
  if x.id is null then
    insert into ambulans_tahap (trip_id, jenis, teks, rs, kota, angka, diajukan_by)
    values (v_trip, p_jenis, nullif(trim(coalesce(p_teks,'')),''), nullif(trim(coalesce(p_rs,'')),''), nullif(trim(coalesce(p_kota,'')),''), p_angka, auth.uid());
  elsif x.status = 'ditolak' then
    update ambulans_tahap set teks = nullif(trim(coalesce(p_teks,'')),''), rs = nullif(trim(coalesce(p_rs,'')),''),
           kota = nullif(trim(coalesce(p_kota,'')),''), angka = p_angka, status = 'diajukan',
           diajukan_by = auth.uid(), diajukan_at = now(), putus_by = null, putus_at = null, catatan = null
     where id = x.id;
  else
    raise exception 'Tahap ini sudah % ', x.status;
  end if;

  perform _log('ambulans', v_trip, 'ajukan ' || p_jenis, coalesce(p_teks, p_angka::text));
  return v_trip;
end $$;

-- Ketum menyetujui / menolak satu tahap
create or replace function public.ambulans_putuskan(p_tahap bigint, p_setuju boolean, p_catatan text)
returns void language plpgsql security definer set search_path = public as $$
declare x ambulans_tahap; v_pos int; v_kas bigint; v_sisa int;
begin
  -- Mau Admin juga boleh approve? ganti jadi array['ketum','admin']
  if not has_role(array['ketum']) then raise exception 'Hanya Ketua Umum yang bisa approve'; end if;
  select * into x from ambulans_tahap where id = p_tahap for update;
  if x.id is null then raise exception 'Tahap tidak ditemukan'; end if;
  if x.status <> 'diajukan' then raise exception 'Sudah diputuskan, muat ulang halaman'; end if;
  if not p_setuju and coalesce(trim(p_catatan),'') = '' then raise exception 'Tulis alasan penolakan'; end if;

  if p_setuju and x.jenis in ('uang_jalan','uang_toll') then
    select id into v_pos from pos_dana where nama = 'Ambulans' and aktif;
    if v_pos is null then raise exception 'Pos dana "Ambulans" tidak ditemukan / nonaktif'; end if;
    insert into kas (tanggal, jenis, pos_id, kategori, jumlah, keterangan, ref_tabel, ref_id, created_by)
    values (today_wib(), 'keluar', v_pos,
            case x.jenis when 'uang_jalan' then 'Ambulans - Uang Jalan' else 'Ambulans - Uang Toll' end,
            x.angka, 'Pemakaian ambulans #' || x.trip_id, 'ambulans_tahap', x.id, auth.uid())
    returning id into v_kas;
  end if;

  update ambulans_tahap set status = case when p_setuju then 'disetujui' else 'ditolak' end,
         putus_by = auth.uid(), putus_at = now(), catatan = nullif(trim(coalesce(p_catatan,'')),''), kas_id = v_kas
   where id = p_tahap;

  -- selesai otomatis kalau 6 tahap sudah disetujui
  select count(*) into v_sisa from ambulans_tahap where trip_id = x.trip_id and status = 'disetujui';
  if v_sisa = 6 then update ambulans_trip set status = 'selesai', selesai_at = now() where id = x.trip_id; end if;

  perform _log('ambulans', x.trip_id, (case when p_setuju then 'setuju ' else 'tolak ' end) || x.jenis, p_catatan);
end $$;

-- Batalkan pemakaian (pembuat atau Ketum/Admin). Pengeluaran kas yang sudah tercatat tetap ada
-- (koreksi lewat Bendahara), jadi pembatalan ditolak kalau sudah ada uang yang keluar.
create or replace function public.ambulans_batal(p_trip bigint) returns void
language plpgsql security definer set search_path = public as $$
declare t ambulans_trip;
begin
  select * into t from ambulans_trip where id = p_trip for update;
  if t.id is null then raise exception 'Data tidak ditemukan'; end if;
  if not (t.dibuat_by = auth.uid() or has_role(array['ketum','admin'])) then raise exception 'Tidak berhak membatalkan'; end if;
  if t.status <> 'berjalan' then raise exception 'Pemakaian sudah %', t.status; end if;
  if exists (select 1 from ambulans_tahap where trip_id = p_trip and kas_id is not null) then
    raise exception 'Sudah ada uang jalan/toll yang tercatat di kas, tidak bisa dibatalkan';
  end if;
  update ambulans_trip set status = 'dibatalkan' where id = p_trip;
  perform _log('ambulans', p_trip, 'dibatalkan', null);
end $$;

grant execute on function public.ambulans_ajukan(bigint, text, text, text, text, numeric) to authenticated;
grant execute on function public.ambulans_putuskan(bigint, boolean, text) to authenticated;
grant execute on function public.ambulans_batal(bigint) to authenticated;
