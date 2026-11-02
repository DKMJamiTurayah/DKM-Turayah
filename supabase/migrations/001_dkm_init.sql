-- =====================================================================
--  DKM Masjid Jami Turayah — Sistem Keuangan & Pengajuan Anggaran
--  Jalankan sekali di Supabase: SQL Editor -> New query -> paste -> Run
-- =====================================================================

-- ---------- MASTER BIDANG ----------
create table if not exists public.bidang (
  id serial primary key,
  nama text not null unique,
  aktif boolean not null default true
);

insert into public.bidang (nama) values
  ('Idarah (Administrasi & Kesekretariatan)'),
  ('Imarah (Ibadah & Dakwah)'),
  ('Riayah (Sarana & Pemeliharaan)'),
  ('PHBI (Peringatan Hari Besar Islam)'),
  ('Pendidikan & TPQ'),
  ('Sosial & Kemasyarakatan'),
  ('Remaja Masjid')
on conflict (nama) do nothing;

-- ---------- PROFIL PENGURUS ----------
-- role: pending (baru daftar) | admin | ketum | bendahara | sekretaris | ketua_bidang | petugas
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  nama text not null,
  jabatan text,
  no_hp text,
  role text not null default 'pending'
    check (role in ('pending','admin','ketum','bendahara','sekretaris','ketua_bidang','petugas')),
  bidang_id int references public.bidang(id),
  aktif boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- HELPER ----------
create or replace function public.today_wib() returns date
language sql stable as $$ select (now() at time zone 'Asia/Jakarta')::date $$;

create or replace function public.has_role(r text[]) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and aktif and role = any(r));
$$;

create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and aktif and role <> 'pending');
$$;

-- user pertama yang daftar otomatis jadi admin, berikutnya "pending" sampai diset admin/ketum
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_role text := 'pending';
begin
  perform pg_advisory_xact_lock(778899);
  if not exists (select 1 from profiles where role = 'admin') then v_role := 'admin'; end if;
  insert into profiles (id, username, nama, no_hp, role)
  values (new.id,
          lower(coalesce(new.raw_user_meta_data->>'username', split_part(new.email,'@',1))),
          coalesce(nullif(new.raw_user_meta_data->>'nama',''), split_part(new.email,'@',1)),
          new.raw_user_meta_data->>'no_hp',
          v_role);
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public._rp(n numeric) returns text
language sql immutable as $$ select 'Rp ' || replace(to_char(coalesce(n,0),'FM999,999,999,990'),',','.') $$;

-- ---------- LOG AKTIVITAS (jejak audit) ----------
create table if not exists public.log_aktivitas (
  id bigserial primary key,
  waktu timestamptz not null default now(),
  oleh uuid references public.profiles(id),
  modul text not null,
  ref_id bigint,
  aksi text not null,
  catatan text
);

create or replace function public._log(p_modul text, p_ref bigint, p_aksi text, p_catatan text)
returns void language sql security definer set search_path = public as $$
  insert into log_aktivitas (oleh, modul, ref_id, aksi, catatan) values (auth.uid(), p_modul, p_ref, p_aksi, p_catatan);
$$;

-- ---------- BUKU KAS (hanya diisi lewat fungsi, tidak bisa diedit langsung) ----------
create table if not exists public.kas (
  id bigserial primary key,
  tanggal date not null default public.today_wib(),
  jenis text not null check (jenis in ('masuk','keluar')),
  kategori text not null,
  jumlah numeric(14,0) not null check (jumlah > 0),
  keterangan text,
  ref_tabel text,
  ref_id bigint,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists kas_tanggal_idx on public.kas (tanggal);

create or replace function public.saldo_kas() returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce(sum(case when jenis = 'masuk' then jumlah else -jumlah end), 0) from kas;
$$;

create or replace function public._kas(p_tanggal date, p_jenis text, p_kategori text, p_jumlah numeric,
                                       p_ket text, p_ref_tabel text, p_ref_id bigint)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  if p_jenis = 'keluar' and saldo_kas() < p_jumlah then
    raise exception 'Saldo kas tidak cukup (saldo %, butuh %)',
      _rp(saldo_kas()), _rp(p_jumlah);
  end if;
  insert into kas (tanggal, jenis, kategori, jumlah, keterangan, ref_tabel, ref_id, created_by)
  values (coalesce(p_tanggal, today_wib()), p_jenis, p_kategori, p_jumlah, p_ket, p_ref_tabel, p_ref_id, auth.uid())
  returning id into v_id;
  return v_id;
end $$;

-- transaksi kas lain-lain (infaq umum, sedekah, bayar listrik, dll) — khusus bendahara
create or replace function public.kas_manual(p_tanggal date, p_jenis text, p_kategori text,
                                             p_jumlah numeric, p_keterangan text)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  if not has_role(array['bendahara']) then raise exception 'Hanya Bendahara yang bisa mencatat transaksi kas'; end if;
  if p_jenis not in ('masuk','keluar') then raise exception 'Jenis harus masuk/keluar'; end if;
  if coalesce(p_jumlah,0) <= 0 then raise exception 'Jumlah harus lebih dari 0'; end if;
  if coalesce(trim(p_kategori),'') = '' then raise exception 'Kategori wajib diisi'; end if;
  v_id := _kas(p_tanggal, p_jenis, trim(p_kategori), p_jumlah, p_keterangan, 'manual', null);
  perform _log('kas', v_id, 'transaksi ' || p_jenis, p_kategori || ' ' || _rp(p_jumlah));
  return v_id;
end $$;

-- ---------- PENGAJUAN ANGGARAN BIDANG ----------
-- alur: diajukan -> (ketum) disetujui / ditolak -> (bendahara) dicairkan -> (ketua bidang) diterima
create table if not exists public.pengajuan (
  id bigserial primary key,
  nomor text unique,
  bidang_id int not null references public.bidang(id),
  judul text not null,
  keterangan text,
  kebutuhan_tgl date,
  total_diajukan numeric(14,0) not null default 0,
  total_disetujui numeric(14,0),
  status text not null default 'diajukan'
    check (status in ('diajukan','disetujui','ditolak','dicairkan','diterima','dibatalkan')),
  diajukan_by uuid references public.profiles(id),
  diajukan_at timestamptz not null default now(),
  ketum_by uuid references public.profiles(id),
  ketum_at timestamptz,
  ketum_catatan text,
  cair_by uuid references public.profiles(id),
  cair_at timestamptz,
  cair_metode text,
  cair_catatan text,
  kas_id bigint references public.kas(id),
  terima_by uuid references public.profiles(id),
  terima_at timestamptz,
  terima_catatan text
);
create index if not exists pengajuan_status_idx on public.pengajuan (status);

create table if not exists public.pengajuan_item (
  id bigserial primary key,
  pengajuan_id bigint not null references public.pengajuan(id) on delete cascade,
  uraian text not null,
  qty numeric not null default 1 check (qty > 0),
  satuan text,
  harga numeric(14,0) not null default 0 check (harga >= 0),
  subtotal numeric(14,0) generated always as (qty * harga) stored
);

create or replace function public.ajukan_pengajuan(p_judul text, p_keterangan text,
                                                   p_kebutuhan date, p_items jsonb)
returns bigint language plpgsql security definer set search_path = public as $$
declare me profiles; v_id bigint; v_total numeric; it jsonb;
begin
  select * into me from profiles where id = auth.uid() and aktif;
  if me.id is null or me.role <> 'ketua_bidang' then raise exception 'Hanya Ketua Bidang yang bisa mengajukan anggaran'; end if;
  if me.bidang_id is null then raise exception 'Akun Anda belum diset bidangnya, hubungi admin'; end if;
  if coalesce(trim(p_judul),'') = '' then raise exception 'Judul pengajuan wajib diisi'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Isi minimal 1 rincian kebutuhan'; end if;

  insert into pengajuan (bidang_id, judul, keterangan, kebutuhan_tgl, diajukan_by)
  values (me.bidang_id, trim(p_judul), p_keterangan, p_kebutuhan, me.id) returning id into v_id;

  for it in select * from jsonb_array_elements(p_items) loop
    if coalesce(trim(it->>'uraian'),'') = '' then raise exception 'Ada rincian yang uraiannya kosong'; end if;
    insert into pengajuan_item (pengajuan_id, uraian, qty, satuan, harga)
    values (v_id, trim(it->>'uraian'), coalesce(nullif(it->>'qty','')::numeric, 1),
            nullif(trim(coalesce(it->>'satuan','')),''), coalesce(nullif(it->>'harga','')::numeric, 0));
  end loop;

  select coalesce(sum(subtotal),0) into v_total from pengajuan_item where pengajuan_id = v_id;
  if v_total <= 0 then raise exception 'Total pengajuan harus lebih dari 0'; end if;

  update pengajuan set total_diajukan = v_total,
         nomor = 'PB/' || to_char(now() at time zone 'Asia/Jakarta','YYYY') || '/' || lpad(v_id::text, 4, '0')
   where id = v_id;
  perform _log('pengajuan', v_id, 'diajukan', trim(p_judul));
  return v_id;
end $$;

create or replace function public.batal_pengajuan(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
declare p pengajuan;
begin
  select * into p from pengajuan where id = p_id for update;
  if p.id is null then raise exception 'Pengajuan tidak ditemukan'; end if;
  if p.diajukan_by <> auth.uid() then raise exception 'Hanya pembuat pengajuan yang bisa membatalkan'; end if;
  if p.status <> 'diajukan' then raise exception 'Pengajuan sudah diproses Ketua Umum, tidak bisa dibatalkan'; end if;
  update pengajuan set status = 'dibatalkan' where id = p_id;
  perform _log('pengajuan', p_id, 'dibatalkan', null);
end $$;

create or replace function public.ketum_putuskan(p_id bigint, p_setuju boolean,
                                                 p_nominal numeric, p_catatan text)
returns void language plpgsql security definer set search_path = public as $$
declare p pengajuan; v_nom numeric;
begin
  if not has_role(array['ketum']) then raise exception 'Hanya Ketua Umum yang bisa memberi approval'; end if;
  select * into p from pengajuan where id = p_id for update;
  if p.id is null then raise exception 'Pengajuan tidak ditemukan'; end if;
  if p.status <> 'diajukan' then raise exception 'Pengajuan ini sudah diproses (status: %)', p.status; end if;

  if p_setuju then
    v_nom := coalesce(p_nominal, p.total_diajukan);
    if v_nom <= 0 then raise exception 'Nominal disetujui harus lebih dari 0'; end if;
    if v_nom > p.total_diajukan then raise exception 'Nominal disetujui tidak boleh melebihi yang diajukan'; end if;
    update pengajuan set status = 'disetujui', total_disetujui = v_nom, ketum_by = auth.uid(),
           ketum_at = now(), ketum_catatan = p_catatan where id = p_id;
    perform _log('pengajuan', p_id, 'disetujui Ketum', trim(coalesce(p_catatan,'') || ' (' || _rp(v_nom) || ')'));
  else
    if coalesce(trim(p_catatan),'') = '' then raise exception 'Alasan penolakan wajib diisi'; end if;
    update pengajuan set status = 'ditolak', ketum_by = auth.uid(), ketum_at = now(),
           ketum_catatan = p_catatan where id = p_id;
    perform _log('pengajuan', p_id, 'ditolak Ketum', p_catatan);
  end if;
end $$;

create or replace function public.bendahara_cairkan(p_id bigint, p_metode text, p_catatan text)
returns void language plpgsql security definer set search_path = public as $$
declare p pengajuan; v_kas bigint; v_bidang text;
begin
  if not has_role(array['bendahara']) then raise exception 'Hanya Bendahara yang bisa mencairkan dana'; end if;
  select * into p from pengajuan where id = p_id for update;
  if p.id is null then raise exception 'Pengajuan tidak ditemukan'; end if;
  if p.status <> 'disetujui' then raise exception 'Hanya pengajuan yang sudah di-approve Ketum yang bisa dicairkan'; end if;
  select nama into v_bidang from bidang where id = p.bidang_id;
  v_kas := _kas(today_wib(), 'keluar', 'Pencairan Bidang', p.total_disetujui,
                p.nomor || ' — ' || v_bidang || ': ' || p.judul, 'pengajuan', p.id);
  update pengajuan set status = 'dicairkan', cair_by = auth.uid(), cair_at = now(),
         cair_metode = p_metode, cair_catatan = p_catatan, kas_id = v_kas where id = p_id;
  perform _log('pengajuan', p_id, 'dicairkan Bendahara', coalesce(p_metode,'') || ' ' || coalesce(p_catatan,''));
end $$;

create or replace function public.konfirmasi_terima(p_id bigint, p_catatan text)
returns void language plpgsql security definer set search_path = public as $$
declare p pengajuan; me profiles;
begin
  select * into me from profiles where id = auth.uid() and aktif;
  select * into p from pengajuan where id = p_id for update;
  if p.id is null then raise exception 'Pengajuan tidak ditemukan'; end if;
  if me.id is null or not (me.id = p.diajukan_by or (me.role = 'ketua_bidang' and me.bidang_id = p.bidang_id)) then
    raise exception 'Hanya Ketua Bidang yang bersangkutan yang bisa konfirmasi terima';
  end if;
  if p.status <> 'dicairkan' then raise exception 'Dana belum dicairkan Bendahara'; end if;
  update pengajuan set status = 'diterima', terima_by = auth.uid(), terima_at = now(),
         terima_catatan = p_catatan where id = p_id;
  perform _log('pengajuan', p_id, 'diterima Ketua Bidang', p_catatan);
end $$;

-- ---------- KEROPAK JUMAT ----------
-- alur: petugas setor (+saksi) -> bendahara terima (masuk kas) / tolak (hitung ulang)
create table if not exists public.keropak_jumat (
  id bigserial primary key,
  tanggal date not null,
  jumlah numeric(14,0) not null check (jumlah > 0),
  saksi1 text,
  saksi2 text,
  catatan text,
  status text not null default 'menunggu' check (status in ('menunggu','diterima','ditolak')),
  disetor_by uuid references public.profiles(id),
  disetor_at timestamptz not null default now(),
  verif_by uuid references public.profiles(id),
  verif_at timestamptz,
  verif_catatan text,
  kas_id bigint references public.kas(id)
);
create unique index if not exists keropak_satu_per_tanggal
  on public.keropak_jumat (tanggal) where status <> 'ditolak';

create or replace function public.setor_keropak(p_tanggal date, p_jumlah numeric, p_saksi1 text,
                                                p_saksi2 text, p_catatan text)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  if not is_member() then raise exception 'Akun belum aktif'; end if;
  if coalesce(p_jumlah,0) <= 0 then raise exception 'Jumlah harus lebih dari 0'; end if;
  if coalesce(trim(p_saksi1),'') = '' then raise exception 'Minimal 1 saksi penghitungan wajib diisi'; end if;
  if exists (select 1 from keropak_jumat where tanggal = p_tanggal and status <> 'ditolak') then
    raise exception 'Keropak tanggal % sudah disetor', to_char(p_tanggal,'DD-MM-YYYY');
  end if;
  insert into keropak_jumat (tanggal, jumlah, saksi1, saksi2, catatan, disetor_by)
  values (p_tanggal, p_jumlah, trim(p_saksi1), nullif(trim(coalesce(p_saksi2,'')),''), p_catatan, auth.uid())
  returning id into v_id;
  perform _log('keropak', v_id, 'disetor', _rp(p_jumlah));
  return v_id;
end $$;

create or replace function public.verifikasi_keropak(p_id bigint, p_terima boolean, p_catatan text)
returns void language plpgsql security definer set search_path = public as $$
declare k keropak_jumat; v_kas bigint;
begin
  if not has_role(array['bendahara']) then raise exception 'Hanya Bendahara yang bisa menerima setoran'; end if;
  select * into k from keropak_jumat where id = p_id for update;
  if k.id is null then raise exception 'Data tidak ditemukan'; end if;
  if k.status <> 'menunggu' then raise exception 'Setoran ini sudah diproses'; end if;
  if p_terima then
    v_kas := _kas(k.tanggal, 'masuk', 'Keropak Jumat', k.jumlah,
                  'Keropak Jumat ' || to_char(k.tanggal,'DD-MM-YYYY'), 'keropak_jumat', k.id);
    update keropak_jumat set status = 'diterima', verif_by = auth.uid(), verif_at = now(),
           verif_catatan = p_catatan, kas_id = v_kas where id = p_id;
    perform _log('keropak', p_id, 'diterima Bendahara', p_catatan);
  else
    if coalesce(trim(p_catatan),'') = '' then raise exception 'Alasan penolakan wajib diisi'; end if;
    update keropak_jumat set status = 'ditolak', verif_by = auth.uid(), verif_at = now(),
           verif_catatan = p_catatan where id = p_id;
    perform _log('keropak', p_id, 'ditolak Bendahara', p_catatan);
  end if;
end $$;

-- ---------- WARGA & IURAN (KEROPAK) BULANAN ----------
create table if not exists public.warga (
  id bigserial primary key,
  nama text not null,
  alamat text,
  no_hp text,
  iuran_bulanan numeric(14,0) not null default 0,
  aktif boolean not null default true,
  created_at timestamptz not null default now()
);

-- status: belum_setor (dipegang petugas) -> diterima (sudah di tangan bendahara & masuk kas)
create table if not exists public.iuran (
  id bigserial primary key,
  warga_id bigint not null references public.warga(id),
  periode text not null check (periode ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  jumlah numeric(14,0) not null check (jumlah > 0),
  tgl_bayar date not null default public.today_wib(),
  metode text,
  status text not null default 'belum_setor' check (status in ('belum_setor','diterima')),
  dicatat_by uuid references public.profiles(id),
  dicatat_at timestamptz not null default now(),
  diterima_by uuid references public.profiles(id),
  diterima_at timestamptz,
  kas_id bigint references public.kas(id),
  unique (warga_id, periode)
);

create or replace function public.catat_iuran(p_warga bigint, p_periode text[], p_jumlah numeric, p_metode text)
returns int language plpgsql security definer set search_path = public as $$
declare w warga; per text; v_n int := 0; v_bend boolean; v_kas bigint; v_ids bigint[] := '{}'; v_id bigint;
begin
  if not has_role(array['petugas','bendahara','ketum','admin','sekretaris']) then
    raise exception 'Anda tidak berhak mencatat iuran';
  end if;
  select * into w from warga where id = p_warga;
  if w.id is null then raise exception 'Warga tidak ditemukan'; end if;
  if coalesce(p_jumlah,0) <= 0 then raise exception 'Jumlah per bulan harus lebih dari 0'; end if;
  if coalesce(array_length(p_periode,1),0) = 0 then raise exception 'Pilih minimal 1 bulan'; end if;
  v_bend := has_role(array['bendahara']);
  foreach per in array p_periode loop
    if exists (select 1 from iuran where warga_id = p_warga and periode = per) then
      raise exception 'Iuran % bulan % sudah tercatat', w.nama, per;
    end if;
    insert into iuran (warga_id, periode, jumlah, metode, dicatat_by,
                       status, diterima_by, diterima_at)
    values (p_warga, per, p_jumlah, p_metode, auth.uid(),
            case when v_bend then 'diterima' else 'belum_setor' end,
            case when v_bend then auth.uid() end, case when v_bend then now() end)
    returning id into v_id;
    v_ids := v_ids || v_id; v_n := v_n + 1;
  end loop;
  if v_bend then
    v_kas := _kas(today_wib(), 'masuk', 'Iuran Warga', p_jumlah * v_n,
                  'Iuran ' || w.nama || ' (' || array_to_string(p_periode, ', ') || ')', 'iuran', null);
    update iuran set kas_id = v_kas where id = any(v_ids);
  end if;
  perform _log('iuran', p_warga, 'dicatat', w.nama || ': ' || array_to_string(p_periode, ', '));
  return v_n;
end $$;

create or replace function public.batal_iuran(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
declare i iuran;
begin
  select * into i from iuran where id = p_id for update;
  if i.id is null then raise exception 'Data tidak ditemukan'; end if;
  if i.status <> 'belum_setor' then raise exception 'Iuran sudah diterima Bendahara, tidak bisa dihapus'; end if;
  if i.dicatat_by <> auth.uid() and not has_role(array['bendahara']) then
    raise exception 'Hanya pencatat atau Bendahara yang bisa menghapus';
  end if;
  delete from iuran where id = p_id;
  perform _log('iuran', i.warga_id, 'dihapus', i.periode);
end $$;

create or replace function public.terima_setoran_iuran(p_ids bigint[]) returns numeric
language plpgsql security definer set search_path = public as $$
declare v_total numeric; v_n int; v_kas bigint;
begin
  if not has_role(array['bendahara']) then raise exception 'Hanya Bendahara yang bisa menerima setoran'; end if;
  if coalesce(array_length(p_ids,1),0) = 0 then raise exception 'Pilih data yang mau diterima'; end if;
  perform 1 from iuran where id = any(p_ids) for update;
  if exists (select 1 from iuran where id = any(p_ids) and status <> 'belum_setor') then
    raise exception 'Ada data yang sudah diterima sebelumnya, muat ulang halaman';
  end if;
  select coalesce(sum(jumlah),0), count(*) into v_total, v_n from iuran where id = any(p_ids);
  if v_n = 0 then raise exception 'Data tidak ditemukan'; end if;
  v_kas := _kas(today_wib(), 'masuk', 'Iuran Warga', v_total,
                'Setoran iuran warga (' || v_n || ' pembayaran)', 'iuran', null);
  update iuran set status = 'diterima', diterima_by = auth.uid(), diterima_at = now(), kas_id = v_kas
   where id = any(p_ids);
  perform _log('iuran', null, 'setoran diterima Bendahara', v_n || ' pembayaran, ' || _rp(v_total));
  return v_total;
end $$;

-- ---------- KELOLA USER ----------
create or replace function public.set_user(p_id uuid, p_role text, p_bidang int, p_jabatan text, p_aktif boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not has_role(array['admin','ketum']) then raise exception 'Hanya Admin / Ketua Umum yang bisa mengatur pengurus'; end if;
  if p_role = 'ketua_bidang' and p_bidang is null then raise exception 'Ketua Bidang wajib dipilih bidangnya'; end if;
  if (select role from profiles where id = p_id) = 'admin'
     and (p_role <> 'admin' or not p_aktif)
     and (select count(*) from profiles where role = 'admin' and aktif) <= 1 then
    raise exception 'Minimal harus ada 1 admin aktif';
  end if;
  update profiles set role = p_role,
         bidang_id = case when p_role = 'ketua_bidang' then p_bidang else null end,
         jabatan = p_jabatan, aktif = p_aktif
   where id = p_id;
  perform _log('user', null, 'ubah pengurus', (select nama from profiles where id = p_id) || ' -> ' || p_role);
end $$;

create or replace function public.ubah_profil_saya(p_nama text, p_no_hp text) returns void
language sql security definer set search_path = public as $$
  update profiles set nama = coalesce(nullif(trim(p_nama),''), nama), no_hp = p_no_hp where id = auth.uid();
$$;

-- ---------- KEAMANAN (RLS) ----------
alter table public.bidang         enable row level security;
alter table public.profiles       enable row level security;
alter table public.log_aktivitas  enable row level security;
alter table public.kas            enable row level security;
alter table public.pengajuan      enable row level security;
alter table public.pengajuan_item enable row level security;
alter table public.keropak_jumat  enable row level security;
alter table public.warga          enable row level security;
alter table public.iuran          enable row level security;

-- semua pengurus aktif boleh MELIHAT (transparansi)
create policy baca_bidang   on public.bidang         for select to authenticated using (true);
create policy baca_profil   on public.profiles       for select to authenticated using (id = auth.uid() or public.is_member());
create policy baca_log      on public.log_aktivitas  for select to authenticated using (public.is_member());
create policy baca_kas      on public.kas            for select to authenticated using (public.is_member());
create policy baca_aju      on public.pengajuan      for select to authenticated using (public.is_member());
create policy baca_aju_item on public.pengajuan_item for select to authenticated using (public.is_member());
create policy baca_keropak  on public.keropak_jumat  for select to authenticated using (public.is_member());
create policy baca_warga    on public.warga          for select to authenticated using (public.is_member());
create policy baca_iuran    on public.iuran          for select to authenticated using (public.is_member());

-- master data boleh diubah langsung oleh yang berwenang
create policy tulis_bidang on public.bidang for insert to authenticated with check (public.has_role(array['admin','ketum']));
create policy ubah_bidang  on public.bidang for update to authenticated using (public.has_role(array['admin','ketum']));
create policy tulis_warga  on public.warga  for insert to authenticated
  with check (public.has_role(array['admin','ketum','bendahara','sekretaris','petugas']));
create policy ubah_warga   on public.warga  for update to authenticated
  using (public.has_role(array['admin','ketum','bendahara','sekretaris','petugas']));
-- transaksi (kas, pengajuan, keropak, iuran) TIDAK bisa ditulis langsung: hanya lewat fungsi di atas

-- fungsi internal tidak boleh dipanggil dari aplikasi
revoke all on function public._kas(date,text,text,numeric,text,text,bigint) from public, anon, authenticated;
revoke all on function public._log(text,bigint,text,text) from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
