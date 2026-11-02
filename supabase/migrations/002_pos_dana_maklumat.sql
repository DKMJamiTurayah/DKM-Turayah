-- =====================================================================
--  DKM Masjid Jami Turayah — Tambahan: POS DANA + MAKLUMAT JUM'AT
--  Jalankan SETELAH 001_dkm_init.sql (SQL Editor -> New query -> paste -> Run). Cukup sekali.
--  Aman untuk database yang sudah berisi data: transaksi lama otomatis masuk pos "Infak DKM".
-- =====================================================================

-- ---------- POS DANA (Infak DKM, Ambulans, Pembangunan, PHBI, ...) ----------
create table if not exists public.pos_dana (
  id serial primary key,
  nama text not null unique,
  urutan int not null default 0,
  utama boolean not null default false,       -- pos default: keropak, iuran & transaksi tanpa pos masuk ke sini
  aktif boolean not null default true,
  constraint pos_utama_harus_aktif check (not utama or aktif)
);
create unique index if not exists pos_dana_satu_utama on public.pos_dana (utama) where utama;

insert into public.pos_dana (nama, urutan, utama) values
  ('Infak DKM', 1, true), ('Ambulans', 2, false), ('Pembangunan', 3, false), ('PHBI', 4, false)
on conflict (nama) do nothing;

alter table public.kas add column if not exists pos_id int references public.pos_dana(id);
update public.kas set pos_id = (select id from public.pos_dana where utama) where pos_id is null;
alter table public.kas alter column pos_id set not null;
create index if not exists kas_pos_idx on public.kas (pos_id, tanggal);

create or replace function public.saldo_pos(p_pos int) returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce(sum(case when jenis = 'masuk' then jumlah else -jumlah end), 0) from kas where pos_id = p_pos;
$$;

-- setiap transaksi kas: isi pos default bila kosong + cek saldo pos cukup untuk pengeluaran
create or replace function public._kas_pos() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_nama text; v_aktif boolean;
begin
  if new.pos_id is null then select id into new.pos_id from pos_dana where utama; end if;
  select nama, aktif into v_nama, v_aktif from pos_dana where id = new.pos_id;
  if v_nama is null then raise exception 'Pos dana tidak ditemukan'; end if;
  if not v_aktif then raise exception 'Pos dana % sudah nonaktif', v_nama; end if;
  if new.jenis = 'keluar' then
    perform pg_advisory_xact_lock(4411, new.pos_id);
    if saldo_pos(new.pos_id) < new.jumlah then
      raise exception 'Saldo pos % tidak cukup (saldo %, butuh %)', v_nama, _rp(saldo_pos(new.pos_id)), _rp(new.jumlah);
    end if;
  end if;
  return new;
end $$;

drop trigger if exists kas_pos_trg on public.kas;
create trigger kas_pos_trg before insert on public.kas for each row execute function public._kas_pos();

-- transaksi kas lain-lain: sekarang wajib pilih pos (versi lama tanpa pos dihapus)
drop function if exists public.kas_manual(date, text, text, numeric, text);
create or replace function public.kas_manual(p_tanggal date, p_jenis text, p_pos int, p_kategori text,
                                             p_jumlah numeric, p_keterangan text)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  if not has_role(array['bendahara']) then raise exception 'Hanya Bendahara yang bisa mencatat transaksi kas'; end if;
  if p_jenis not in ('masuk','keluar') then raise exception 'Jenis harus masuk/keluar'; end if;
  if coalesce(p_jumlah,0) <= 0 then raise exception 'Jumlah harus lebih dari 0'; end if;
  if coalesce(trim(p_kategori),'') = '' then raise exception 'Kategori wajib diisi'; end if;
  if p_pos is null then raise exception 'Pilih pos dana'; end if;
  insert into kas (tanggal, jenis, pos_id, kategori, jumlah, keterangan, ref_tabel, created_by)
  values (coalesce(p_tanggal, today_wib()), p_jenis, p_pos, trim(p_kategori), p_jumlah, p_keterangan, 'manual', auth.uid())
  returning id into v_id;
  perform _log('kas', v_id, 'transaksi ' || p_jenis,
               (select nama from pos_dana where id = p_pos) || ' · ' || trim(p_kategori) || ' ' || _rp(p_jumlah));
  return v_id;
end $$;

-- pindah dana antar pos (misal Infak DKM -> PHBI). Total kas tidak berubah.
create or replace function public.kas_pindah_pos(p_tanggal date, p_dari int, p_ke int, p_jumlah numeric, p_keterangan text)
returns void language plpgsql security definer set search_path = public as $$
declare v_dari text; v_ke text; v_id bigint;
begin
  if not has_role(array['bendahara']) then raise exception 'Hanya Bendahara yang bisa memindah dana'; end if;
  if p_dari is null or p_ke is null or p_dari = p_ke then raise exception 'Pilih pos asal dan tujuan yang berbeda'; end if;
  if coalesce(p_jumlah,0) <= 0 then raise exception 'Jumlah harus lebih dari 0'; end if;
  select nama into v_dari from pos_dana where id = p_dari;
  select nama into v_ke from pos_dana where id = p_ke;
  insert into kas (tanggal, jenis, pos_id, kategori, jumlah, keterangan, ref_tabel, created_by)
  values (coalesce(p_tanggal, today_wib()), 'keluar', p_dari, 'Pindah Pos', p_jumlah,
          'Ke ' || v_ke || coalesce(' — ' || nullif(trim(p_keterangan),''), ''), 'pindah_pos', auth.uid())
  returning id into v_id;
  insert into kas (tanggal, jenis, pos_id, kategori, jumlah, keterangan, ref_tabel, ref_id, created_by)
  values (coalesce(p_tanggal, today_wib()), 'masuk', p_ke, 'Pindah Pos', p_jumlah,
          'Dari ' || v_dari || coalesce(' — ' || nullif(trim(p_keterangan),''), ''), 'pindah_pos', v_id, auth.uid());
  perform _log('kas', v_id, 'pindah pos', v_dari || ' -> ' || v_ke || ' ' || _rp(p_jumlah));
end $$;

-- pencairan bidang: bendahara pilih diambil dari pos mana (kosong = pos utama)
drop function if exists public.bendahara_cairkan(bigint, text, text);
create or replace function public.bendahara_cairkan(p_id bigint, p_metode text, p_catatan text, p_pos int default null)
returns void language plpgsql security definer set search_path = public as $$
declare p pengajuan; v_kas bigint; v_bidang text;
begin
  if not has_role(array['bendahara']) then raise exception 'Hanya Bendahara yang bisa mencairkan dana'; end if;
  select * into p from pengajuan where id = p_id for update;
  if p.id is null then raise exception 'Pengajuan tidak ditemukan'; end if;
  if p.status <> 'disetujui' then raise exception 'Hanya pengajuan yang sudah di-approve Ketum yang bisa dicairkan'; end if;
  select nama into v_bidang from bidang where id = p.bidang_id;
  insert into kas (tanggal, jenis, pos_id, kategori, jumlah, keterangan, ref_tabel, ref_id, created_by)
  values (today_wib(), 'keluar', p_pos, 'Pencairan Bidang', p.total_disetujui,
          p.nomor || ' — ' || v_bidang || ': ' || p.judul, 'pengajuan', p.id, auth.uid())
  returning id into v_kas;
  update pengajuan set status = 'dicairkan', cair_by = auth.uid(), cair_at = now(),
         cair_metode = p_metode, cair_catatan = p_catatan, kas_id = v_kas where id = p_id;
  perform _log('pengajuan', p_id, 'dicairkan Bendahara', coalesce(p_metode,'') || ' ' || coalesce(p_catatan,''));
end $$;

-- rekap per pos untuk 1 Jumat: saldo Jumat lalu, masuk & keluar seminggu ini, total
create or replace function public.laporan_pos(p_tgl date)
returns table (pos_id int, nama text, saldo_lalu numeric, masuk numeric, keluar numeric, total numeric)
language sql stable security definer set search_path = public as $$
  select p.id, p.nama,
    coalesce(sum(case when k.tanggal <= p_tgl - 7 then case when k.jenis = 'masuk' then k.jumlah else -k.jumlah end end), 0),
    coalesce(sum(case when k.tanggal > p_tgl - 7 and k.tanggal <= p_tgl and k.jenis = 'masuk' then k.jumlah end), 0),
    coalesce(sum(case when k.tanggal > p_tgl - 7 and k.tanggal <= p_tgl and k.jenis = 'keluar' then k.jumlah end), 0),
    coalesce(sum(case when k.tanggal <= p_tgl then case when k.jenis = 'masuk' then k.jumlah else -k.jumlah end end), 0)
  from pos_dana p left join kas k on k.pos_id = p.id
  where is_member() and (p.aktif or exists (select 1 from kas x where x.pos_id = p.id and x.tanggal <= p_tgl))
  group by p.id, p.nama, p.urutan
  order by p.urutan, p.id;
$$;

-- ---------- MAKLUMAT JUM'AT ----------
create table if not exists public.maklumat (
  id bigserial primary key,
  tanggal date not null unique,
  waktu text,
  khatib text,
  muadzin text,
  petugas_maklumat text,
  nama_masjid text,
  alamat text,
  kegiatan jsonb not null default '[]',   -- [{ "judul": "Ba'da Ashar, ...", "items": ["TPA Anak"] }]
  rekening text,
  token_listrik text,
  token_an text,
  dibuat_by uuid references public.profiles(id),
  dibuat_at timestamptz not null default now(),
  diubah_by uuid references public.profiles(id),
  diubah_at timestamptz
);

-- yang boleh membuat/mengubah maklumat: Admin, Ketum, dan pengurus yang dicentang Admin/Ketum
alter table public.profiles add column if not exists boleh_maklumat boolean not null default false;

create or replace function public.bisa_maklumat() returns boolean
language sql stable security definer set search_path = public as $$
  select has_role(array['admin','ketum'])
      or exists (select 1 from profiles where id = auth.uid() and aktif and role <> 'pending' and boleh_maklumat);
$$;

create or replace function public.set_akses_maklumat(p_id uuid, p_boleh boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not has_role(array['admin','ketum']) then raise exception 'Hanya Admin / Ketua Umum yang bisa mengatur akses maklumat'; end if;
  update profiles set boleh_maklumat = coalesce(p_boleh, false) where id = p_id;
  if not found then raise exception 'Pengurus tidak ditemukan'; end if;
  perform _log('user', null, case when p_boleh then 'beri akses maklumat' else 'cabut akses maklumat' end,
               (select nama from profiles where id = p_id));
end $$;

create or replace function public.simpan_maklumat(p jsonb) returns bigint
language plpgsql security definer set search_path = public as $$
declare v_tgl date := (p->>'tanggal')::date; v_id bigint;
begin
  if not bisa_maklumat() then raise exception 'Anda belum diberi akses membuat maklumat (hubungi Admin / Ketum)'; end if;
  if v_tgl is null then raise exception 'Tanggal wajib diisi'; end if;
  if extract(isodow from v_tgl) <> 5 then raise exception 'Tanggal maklumat harus hari Jumat'; end if;
  if jsonb_typeof(coalesce(p->'kegiatan','[]'::jsonb)) <> 'array' then raise exception 'Format kegiatan salah'; end if;
  insert into maklumat as m (tanggal, waktu, khatib, muadzin, petugas_maklumat, nama_masjid, alamat,
                             kegiatan, rekening, token_listrik, token_an, dibuat_by)
  values (v_tgl, p->>'waktu', p->>'khatib', p->>'muadzin', p->>'petugas_maklumat', p->>'nama_masjid', p->>'alamat',
          coalesce(p->'kegiatan','[]'::jsonb), p->>'rekening', p->>'token_listrik', p->>'token_an', auth.uid())
  on conflict (tanggal) do update set
    waktu = excluded.waktu, khatib = excluded.khatib, muadzin = excluded.muadzin,
    petugas_maklumat = excluded.petugas_maklumat, nama_masjid = excluded.nama_masjid, alamat = excluded.alamat,
    kegiatan = excluded.kegiatan, rekening = excluded.rekening, token_listrik = excluded.token_listrik,
    token_an = excluded.token_an, diubah_by = auth.uid(), diubah_at = now()
  returning id into v_id;
  perform _log('maklumat', v_id, 'disimpan', to_char(v_tgl, 'DD-MM-YYYY'));
  return v_id;
end $$;

create or replace function public.hapus_maklumat(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
declare v_tgl date;
begin
  if not has_role(array['admin','ketum']) then raise exception 'Hanya Admin / Ketua Umum yang bisa menghapus maklumat'; end if;
  delete from maklumat where id = p_id returning tanggal into v_tgl;
  if v_tgl is null then raise exception 'Maklumat tidak ditemukan'; end if;
  perform _log('maklumat', p_id, 'dihapus', to_char(v_tgl, 'DD-MM-YYYY'));
end $$;

-- ---------- KEAMANAN ----------
alter table public.pos_dana enable row level security;
alter table public.maklumat enable row level security;

drop policy if exists baca_pos on public.pos_dana;
drop policy if exists tulis_pos on public.pos_dana;
drop policy if exists ubah_pos on public.pos_dana;
drop policy if exists baca_maklumat on public.maklumat;
create policy baca_pos  on public.pos_dana for select to authenticated using (true);
create policy tulis_pos on public.pos_dana for insert to authenticated
  with check (public.has_role(array['admin','ketum','bendahara']) and not utama);
create policy ubah_pos  on public.pos_dana for update to authenticated
  using (public.has_role(array['admin','ketum','bendahara']));
create policy baca_maklumat on public.maklumat for select to authenticated using (public.is_member());
-- maklumat hanya ditulis lewat simpan_maklumat / hapus_maklumat

revoke all on function public._kas_pos() from public, anon, authenticated;
