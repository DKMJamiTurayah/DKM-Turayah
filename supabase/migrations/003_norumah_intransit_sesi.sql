-- =====================================================================
--  DKM Masjid Jami Turayah — Tambahan 003:
--   (a) Nomor rumah wajib saat daftar
--   (b) Intransit: kembalian dana pencairan -> Bendahara
--   (c) Rekaman sesi / siapa yang sedang membuka aplikasi
--  Jalankan SETELAH 001 dan 002 (SQL Editor -> New query -> paste -> Run). Cukup sekali.
-- =====================================================================

-- ---------- (a) NOMOR RUMAH ----------
alter table public.profiles add column if not exists no_rumah text;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_role text := 'pending';
begin
  perform pg_advisory_xact_lock(778899);
  if not exists (select 1 from profiles where role = 'admin') then v_role := 'admin'; end if;
  insert into profiles (id, username, nama, no_hp, no_rumah, role)
  values (new.id,
          lower(coalesce(new.raw_user_meta_data->>'username', split_part(new.email,'@',1))),
          coalesce(nullif(new.raw_user_meta_data->>'nama',''), split_part(new.email,'@',1)),
          new.raw_user_meta_data->>'no_hp',
          nullif(trim(coalesce(new.raw_user_meta_data->>'no_rumah','')), ''),
          v_role);
  return new;
end $$;

-- ubah profil sendiri: sekarang termasuk nomor rumah (fungsi lama diganti)
drop function if exists public.ubah_profil_saya(text, text);
create or replace function public.ubah_profil_saya(p_nama text, p_no_hp text, p_no_rumah text default null) returns void
language sql security definer set search_path = public as $$
  update profiles set nama = coalesce(nullif(trim(p_nama),''), nama), no_hp = p_no_hp,
         no_rumah = coalesce(nullif(trim(p_no_rumah),''), no_rumah)
   where id = auth.uid();
$$;

-- ---------- (b) INTRANSIT KEMBALIAN ----------
-- alur: Ketua Bidang catat kembalian (menunggu) -> klik "Sudah saya serahkan" (diserahkan)
--       -> Bendahara klik Terima (diterima, masuk kas pos asal pencairan)
create table if not exists public.intransit (
  id bigserial primary key,
  pengajuan_id bigint not null unique references public.pengajuan(id),
  pos_id int not null references public.pos_dana(id),
  jumlah numeric(14,0) not null check (jumlah > 0),
  catatan text,
  status text not null default 'menunggu' check (status in ('menunggu','diserahkan','diterima')),
  dicatat_by uuid references public.profiles(id),
  dicatat_at timestamptz not null default now(),
  serah_by uuid references public.profiles(id),
  serah_at timestamptz,
  terima_by uuid references public.profiles(id),
  terima_at timestamptz,
  terima_catatan text,
  kas_id bigint references public.kas(id)
);
create index if not exists intransit_status_idx on public.intransit (status);

alter table public.intransit enable row level security;
drop policy if exists baca_intransit on public.intransit;
create policy baca_intransit on public.intransit for select to authenticated using (public.is_member());
-- intransit hanya ditulis lewat fungsi di bawah

-- Ketua Bidang yang bersangkutan mencatat uang kembalian dari dana yang sudah diterima
create or replace function public.catat_kembalian(p_pengajuan bigint, p_jumlah numeric, p_catatan text)
returns bigint language plpgsql security definer set search_path = public as $$
declare p pengajuan; me profiles; v_pos int; v_id bigint;
begin
  select * into me from profiles where id = auth.uid() and aktif;
  select * into p from pengajuan where id = p_pengajuan for update;
  if p.id is null then raise exception 'Pengajuan tidak ditemukan'; end if;
  if me.id is null or not (me.id = p.diajukan_by or (me.role = 'ketua_bidang' and me.bidang_id = p.bidang_id)) then
    raise exception 'Hanya Ketua Bidang yang bersangkutan yang bisa mencatat kembalian';
  end if;
  if p.status <> 'diterima' then raise exception 'Kembalian hanya bisa dicatat setelah dana dikonfirmasi diterima'; end if;
  if coalesce(p_jumlah,0) <= 0 then raise exception 'Jumlah kembalian harus lebih dari 0'; end if;
  if p_jumlah > p.total_disetujui then raise exception 'Kembalian tidak boleh melebihi dana yang dicairkan (%)', _rp(p.total_disetujui); end if;
  if exists (select 1 from intransit where pengajuan_id = p_pengajuan) then
    raise exception 'Kembalian untuk pengajuan ini sudah pernah dicatat';
  end if;
  select pos_id into v_pos from kas where id = p.kas_id;
  insert into intransit (pengajuan_id, pos_id, jumlah, catatan, dicatat_by)
  values (p_pengajuan, v_pos, p_jumlah, nullif(trim(coalesce(p_catatan,'')),''), auth.uid())
  returning id into v_id;
  perform _log('intransit', v_id, 'kembalian dicatat', p.nomor || ' ' || _rp(p_jumlah));
  return v_id;
end $$;

-- pemegang uang klik: "uang sudah saya serahkan ke Bendahara"
create or replace function public.serahkan_intransit(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
declare t intransit; p pengajuan; me profiles;
begin
  select * into me from profiles where id = auth.uid() and aktif;
  select * into t from intransit where id = p_id for update;
  if t.id is null then raise exception 'Data intransit tidak ditemukan'; end if;
  select * into p from pengajuan where id = t.pengajuan_id;
  if me.id is null or not (me.id = t.dicatat_by or me.id = p.diajukan_by or (me.role = 'ketua_bidang' and me.bidang_id = p.bidang_id)) then
    raise exception 'Hanya pemegang uang kembalian yang bisa menandai sudah diserahkan';
  end if;
  if t.status <> 'menunggu' then raise exception 'Status sudah berubah, muat ulang halaman'; end if;
  update intransit set status = 'diserahkan', serah_by = auth.uid(), serah_at = now() where id = p_id;
  perform _log('intransit', p_id, 'diserahkan ke Bendahara', _rp(t.jumlah));
end $$;

-- Bendahara klik Terima setelah uang benar-benar di tangan -> masuk kas pos asal
-- (boleh langsung dari "menunggu" supaya tidak macet kalau pemegang lupa klik serahkan)
create or replace function public.terima_intransit(p_id bigint, p_catatan text) returns void
language plpgsql security definer set search_path = public as $$
declare t intransit; p pengajuan; v_kas bigint; v_bidang text;
begin
  if not has_role(array['bendahara']) then raise exception 'Hanya Bendahara yang bisa menerima uang kembalian'; end if;
  select * into t from intransit where id = p_id for update;
  if t.id is null then raise exception 'Data intransit tidak ditemukan'; end if;
  if t.status = 'diterima' then raise exception 'Sudah diterima sebelumnya'; end if;
  select * into p from pengajuan where id = t.pengajuan_id;
  select nama into v_bidang from bidang where id = p.bidang_id;
  insert into kas (tanggal, jenis, pos_id, kategori, jumlah, keterangan, ref_tabel, ref_id, created_by)
  values (today_wib(), 'masuk', t.pos_id, 'Pengembalian Sisa Dana', t.jumlah,
          'Kembalian ' || p.nomor || ' — ' || v_bidang || ': ' || p.judul, 'intransit', t.id, auth.uid())
  returning id into v_kas;
  update intransit set status = 'diterima', terima_by = auth.uid(), terima_at = now(),
         terima_catatan = nullif(trim(coalesce(p_catatan,'')),''), kas_id = v_kas where id = p_id;
  perform _log('intransit', p_id, 'diterima Bendahara', _rp(t.jumlah));
end $$;

-- ---------- (c) SESI APLIKASI (siapa yang membuka / sedang online) ----------
create table if not exists public.sesi_aplikasi (
  id bigserial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  mulai timestamptz not null default now(),
  terakhir_aktif timestamptz not null default now(),
  halaman text,
  perangkat text
);
create index if not exists sesi_user_idx on public.sesi_aplikasi (user_id, mulai desc);
create index if not exists sesi_aktif_idx on public.sesi_aplikasi (terakhir_aktif desc);

alter table public.sesi_aplikasi enable row level security;
drop policy if exists baca_sesi on public.sesi_aplikasi;
create policy baca_sesi on public.sesi_aplikasi for select to authenticated using (public.has_role(array['admin','ketum']));
-- ditulis hanya lewat mulai_sesi / ping_sesi

create or replace function public.mulai_sesi(p_perangkat text) returns bigint
language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  if auth.uid() is null then raise exception 'Belum login'; end if;
  insert into sesi_aplikasi (user_id, perangkat) values (auth.uid(), left(p_perangkat, 200)) returning id into v_id;
  return v_id;
end $$;

create or replace function public.ping_sesi(p_id bigint, p_halaman text) returns void
language sql security definer set search_path = public as $$
  update sesi_aplikasi set terakhir_aktif = now(), halaman = left(p_halaman, 40)
   where id = p_id and user_id = auth.uid();
$$;

grant execute on function public.catat_kembalian(bigint, numeric, text) to authenticated;
grant execute on function public.serahkan_intransit(bigint) to authenticated;
grant execute on function public.terima_intransit(bigint, text) to authenticated;
grant execute on function public.mulai_sesi(text) to authenticated;
grant execute on function public.ping_sesi(bigint, text) to authenticated;
