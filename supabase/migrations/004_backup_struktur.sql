-- =====================================================================
--  DKM Masjid Jami Turayah — BACKUP STRUKTUR DATABASE (diambil dari Supabase, 18 Nov 2026)
--  Isi: semua tabel, aturan akses (RLS), fungsi, dan trigger yang sedang jalan.
--  Ini CATATAN CADANGAN. Jangan dijalankan di database yang sudah berjalan.
-- =====================================================================

create sequence if not exists public.bidang_id_seq;

create sequence if not exists public.intransit_id_seq;

create sequence if not exists public.inventaris_id_seq;

create sequence if not exists public.iuran_id_seq;

create sequence if not exists public.kas_id_seq;

create sequence if not exists public.keropak_jumat_id_seq;

create sequence if not exists public.log_aktivitas_id_seq;

create sequence if not exists public.maklumat_id_seq;

create sequence if not exists public.pengajuan_id_seq;

create sequence if not exists public.pengajuan_item_id_seq;

create sequence if not exists public.pinjam_id_seq;

create sequence if not exists public.pos_dana_id_seq;

create sequence if not exists public.qurban_bagi_id_seq;

create sequence if not exists public.qurban_bayar_id_seq;

create sequence if not exists public.qurban_peserta_id_seq;

create sequence if not exists public.sesi_aplikasi_id_seq;

create sequence if not exists public.takjil_id_seq;

create sequence if not exists public.tarawih_id_seq;

create sequence if not exists public.warga_id_seq;

create sequence if not exists public.zakat_salur_id_seq;

create sequence if not exists public.zakat_terima_id_seq;

create table if not exists public.bidang (
  id integer default nextval('bidang_id_seq'::regclass) not null,
  nama text not null,
  aktif boolean default true not null,
  constraint bidang_nama_key UNIQUE (nama),
  constraint bidang_pkey PRIMARY KEY (id)
);
alter table public.bidang enable row level security;

create table if not exists public.intransit (
  id bigint default nextval('intransit_id_seq'::regclass) not null,
  pengajuan_id bigint not null,
  pos_id integer not null,
  jumlah numeric(14,0) not null,
  catatan text,
  status text default 'menunggu'::text not null,
  dicatat_by uuid,
  dicatat_at timestamp with time zone default now() not null,
  serah_by uuid,
  serah_at timestamp with time zone,
  terima_by uuid,
  terima_at timestamp with time zone,
  terima_catatan text,
  kas_id bigint,
  constraint intransit_pengajuan_id_key UNIQUE (pengajuan_id),
  constraint intransit_pkey PRIMARY KEY (id),
  constraint intransit_dicatat_by_fkey FOREIGN KEY (dicatat_by) REFERENCES profiles(id),
  constraint intransit_kas_id_fkey FOREIGN KEY (kas_id) REFERENCES kas(id),
  constraint intransit_pengajuan_id_fkey FOREIGN KEY (pengajuan_id) REFERENCES pengajuan(id),
  constraint intransit_pos_id_fkey FOREIGN KEY (pos_id) REFERENCES pos_dana(id),
  constraint intransit_serah_by_fkey FOREIGN KEY (serah_by) REFERENCES profiles(id),
  constraint intransit_terima_by_fkey FOREIGN KEY (terima_by) REFERENCES profiles(id),
  constraint intransit_jumlah_check CHECK ((jumlah > (0)::numeric)),
  constraint intransit_status_check CHECK ((status = ANY (ARRAY['menunggu'::text, 'diserahkan'::text, 'diterima'::text])))
);
alter table public.intransit enable row level security;

create table if not exists public.inventaris (
  id bigint default nextval('inventaris_id_seq'::regclass) not null,
  nama text not null,
  kategori text default 'Lainnya'::text not null,
  jumlah integer default 1 not null,
  satuan text default 'unit'::text not null,
  kondisi text default 'baik'::text not null,
  lokasi text,
  bisa_dipinjam boolean default false not null,
  tgl_perolehan date,
  sumber text,
  nilai numeric(14,0),
  catatan text,
  aktif boolean default true not null,
  dibuat_by uuid default auth.uid(),
  dibuat_at timestamp with time zone default now() not null,
  diubah_by uuid,
  diubah_at timestamp with time zone,
  constraint inventaris_pkey PRIMARY KEY (id),
  constraint inventaris_dibuat_by_fkey FOREIGN KEY (dibuat_by) REFERENCES profiles(id),
  constraint inventaris_diubah_by_fkey FOREIGN KEY (diubah_by) REFERENCES profiles(id),
  constraint inventaris_jumlah_check CHECK ((jumlah >= 0)),
  constraint inventaris_kondisi_check CHECK ((kondisi = ANY (ARRAY['baik'::text, 'rusak_ringan'::text, 'rusak_berat'::text]))),
  constraint inventaris_nama_check CHECK ((length(TRIM(BOTH FROM nama)) > 0))
);
alter table public.inventaris enable row level security;

create table if not exists public.iuran (
  id bigint default nextval('iuran_id_seq'::regclass) not null,
  warga_id bigint not null,
  periode text not null,
  jumlah numeric(14,0) not null,
  tgl_bayar date default today_wib() not null,
  metode text,
  status text default 'belum_setor'::text not null,
  dicatat_by uuid,
  dicatat_at timestamp with time zone default now() not null,
  diterima_by uuid,
  diterima_at timestamp with time zone,
  kas_id bigint,
  constraint iuran_warga_id_periode_key UNIQUE (warga_id, periode),
  constraint iuran_pkey PRIMARY KEY (id),
  constraint iuran_dicatat_by_fkey FOREIGN KEY (dicatat_by) REFERENCES profiles(id),
  constraint iuran_diterima_by_fkey FOREIGN KEY (diterima_by) REFERENCES profiles(id),
  constraint iuran_kas_id_fkey FOREIGN KEY (kas_id) REFERENCES kas(id),
  constraint iuran_warga_id_fkey FOREIGN KEY (warga_id) REFERENCES warga(id),
  constraint iuran_jumlah_check CHECK ((jumlah > (0)::numeric)),
  constraint iuran_periode_check CHECK ((periode ~ '^\d{4}-(0[1-9]|1[0-2])$'::text)),
  constraint iuran_status_check CHECK ((status = ANY (ARRAY['belum_setor'::text, 'diterima'::text])))
);
alter table public.iuran enable row level security;

create table if not exists public.kas (
  id bigint default nextval('kas_id_seq'::regclass) not null,
  tanggal date default today_wib() not null,
  jenis text not null,
  kategori text not null,
  jumlah numeric(14,0) not null,
  keterangan text,
  ref_tabel text,
  ref_id bigint,
  created_by uuid,
  created_at timestamp with time zone default now() not null,
  pos_id integer not null,
  constraint kas_pkey PRIMARY KEY (id),
  constraint kas_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id),
  constraint kas_pos_id_fkey FOREIGN KEY (pos_id) REFERENCES pos_dana(id),
  constraint kas_jenis_check CHECK ((jenis = ANY (ARRAY['masuk'::text, 'keluar'::text]))),
  constraint kas_jumlah_check CHECK ((jumlah > (0)::numeric))
);
alter table public.kas enable row level security;

create table if not exists public.keropak_jumat (
  id bigint default nextval('keropak_jumat_id_seq'::regclass) not null,
  tanggal date not null,
  jumlah numeric(14,0) not null,
  saksi1 text,
  saksi2 text,
  catatan text,
  status text default 'menunggu'::text not null,
  disetor_by uuid,
  disetor_at timestamp with time zone default now() not null,
  verif_by uuid,
  verif_at timestamp with time zone,
  verif_catatan text,
  kas_id bigint,
  constraint keropak_jumat_pkey PRIMARY KEY (id),
  constraint keropak_jumat_disetor_by_fkey FOREIGN KEY (disetor_by) REFERENCES profiles(id),
  constraint keropak_jumat_kas_id_fkey FOREIGN KEY (kas_id) REFERENCES kas(id),
  constraint keropak_jumat_verif_by_fkey FOREIGN KEY (verif_by) REFERENCES profiles(id),
  constraint keropak_jumat_jumlah_check CHECK ((jumlah > (0)::numeric)),
  constraint keropak_jumat_status_check CHECK ((status = ANY (ARRAY['menunggu'::text, 'diterima'::text, 'ditolak'::text])))
);
alter table public.keropak_jumat enable row level security;

create table if not exists public.log_aktivitas (
  id bigint default nextval('log_aktivitas_id_seq'::regclass) not null,
  waktu timestamp with time zone default now() not null,
  oleh uuid,
  modul text not null,
  ref_id bigint,
  aksi text not null,
  catatan text,
  constraint log_aktivitas_pkey PRIMARY KEY (id),
  constraint log_aktivitas_oleh_fkey FOREIGN KEY (oleh) REFERENCES profiles(id)
);
alter table public.log_aktivitas enable row level security;

create table if not exists public.maklumat (
  id bigint default nextval('maklumat_id_seq'::regclass) not null,
  tanggal date not null,
  waktu text,
  khatib text,
  muadzin text,
  petugas_maklumat text,
  nama_masjid text,
  alamat text,
  kegiatan jsonb default '[]'::jsonb not null,
  rekening text,
  token_listrik text,
  token_an text,
  dibuat_by uuid,
  dibuat_at timestamp with time zone default now() not null,
  diubah_by uuid,
  diubah_at timestamp with time zone,
  constraint maklumat_tanggal_key UNIQUE (tanggal),
  constraint maklumat_pkey PRIMARY KEY (id),
  constraint maklumat_dibuat_by_fkey FOREIGN KEY (dibuat_by) REFERENCES profiles(id),
  constraint maklumat_diubah_by_fkey FOREIGN KEY (diubah_by) REFERENCES profiles(id)
);
alter table public.maklumat enable row level security;

create table if not exists public.pengajuan (
  id bigint default nextval('pengajuan_id_seq'::regclass) not null,
  nomor text,
  bidang_id integer not null,
  judul text not null,
  keterangan text,
  kebutuhan_tgl date,
  total_diajukan numeric(14,0) default 0 not null,
  total_disetujui numeric(14,0),
  status text default 'diajukan'::text not null,
  diajukan_by uuid,
  diajukan_at timestamp with time zone default now() not null,
  ketum_by uuid,
  ketum_at timestamp with time zone,
  ketum_catatan text,
  cair_by uuid,
  cair_at timestamp with time zone,
  cair_metode text,
  cair_catatan text,
  kas_id bigint,
  terima_by uuid,
  terima_at timestamp with time zone,
  terima_catatan text,
  constraint pengajuan_nomor_key UNIQUE (nomor),
  constraint pengajuan_pkey PRIMARY KEY (id),
  constraint pengajuan_bidang_id_fkey FOREIGN KEY (bidang_id) REFERENCES bidang(id),
  constraint pengajuan_cair_by_fkey FOREIGN KEY (cair_by) REFERENCES profiles(id),
  constraint pengajuan_diajukan_by_fkey FOREIGN KEY (diajukan_by) REFERENCES profiles(id),
  constraint pengajuan_kas_id_fkey FOREIGN KEY (kas_id) REFERENCES kas(id),
  constraint pengajuan_ketum_by_fkey FOREIGN KEY (ketum_by) REFERENCES profiles(id),
  constraint pengajuan_terima_by_fkey FOREIGN KEY (terima_by) REFERENCES profiles(id),
  constraint pengajuan_status_check CHECK ((status = ANY (ARRAY['diajukan'::text, 'disetujui'::text, 'ditolak'::text, 'dicairkan'::text, 'diterima'::text, 'dibatalkan'::text])))
);
alter table public.pengajuan enable row level security;

create table if not exists public.pengajuan_item (
  id bigint default nextval('pengajuan_item_id_seq'::regclass) not null,
  pengajuan_id bigint not null,
  uraian text not null,
  qty numeric default 1 not null,
  satuan text,
  harga numeric(14,0) default 0 not null,
  subtotal numeric(14,0) default (qty * harga),
  constraint pengajuan_item_pkey PRIMARY KEY (id),
  constraint pengajuan_item_pengajuan_id_fkey FOREIGN KEY (pengajuan_id) REFERENCES pengajuan(id) ON DELETE CASCADE,
  constraint pengajuan_item_harga_check CHECK ((harga >= (0)::numeric)),
  constraint pengajuan_item_qty_check CHECK ((qty > (0)::numeric))
);
alter table public.pengajuan_item enable row level security;

create table if not exists public.pinjam (
  id bigint default nextval('pinjam_id_seq'::regclass) not null,
  peminjam text not null,
  no_hp text,
  no_rumah text,
  keperluan text,
  tgl_pinjam date default today_wib() not null,
  tgl_kembali date not null,
  status text default 'dipinjam'::text not null,
  dicatat_by uuid,
  dicatat_at timestamp with time zone default now() not null,
  kembali_by uuid,
  kembali_at timestamp with time zone,
  kembali_catatan text,
  constraint pinjam_pkey PRIMARY KEY (id),
  constraint pinjam_dicatat_by_fkey FOREIGN KEY (dicatat_by) REFERENCES profiles(id),
  constraint pinjam_kembali_by_fkey FOREIGN KEY (kembali_by) REFERENCES profiles(id),
  constraint pinjam_peminjam_check CHECK ((length(TRIM(BOTH FROM peminjam)) > 0)),
  constraint pinjam_status_check CHECK ((status = ANY (ARRAY['dipinjam'::text, 'kembali'::text])))
);
alter table public.pinjam enable row level security;

create table if not exists public.pinjam_item (
  pinjam_id bigint not null,
  inventaris_id bigint not null,
  qty integer not null,
  constraint pinjam_item_pkey PRIMARY KEY (pinjam_id, inventaris_id),
  constraint pinjam_item_inventaris_id_fkey FOREIGN KEY (inventaris_id) REFERENCES inventaris(id),
  constraint pinjam_item_pinjam_id_fkey FOREIGN KEY (pinjam_id) REFERENCES pinjam(id) ON DELETE CASCADE,
  constraint pinjam_item_qty_check CHECK ((qty > 0))
);
alter table public.pinjam_item enable row level security;

create table if not exists public.pos_dana (
  id integer default nextval('pos_dana_id_seq'::regclass) not null,
  nama text not null,
  urutan integer default 0 not null,
  utama boolean default false not null,
  aktif boolean default true not null,
  constraint pos_dana_nama_key UNIQUE (nama),
  constraint pos_dana_pkey PRIMARY KEY (id),
  constraint pos_utama_harus_aktif CHECK (((NOT utama) OR aktif))
);
alter table public.pos_dana enable row level security;

create table if not exists public.profiles (
  id uuid not null,
  username text,
  nama text not null,
  jabatan text,
  no_hp text,
  role text default 'pending'::text not null,
  bidang_id integer,
  aktif boolean default true not null,
  created_at timestamp with time zone default now() not null,
  boleh_maklumat boolean default false not null,
  no_rumah text,
  constraint profiles_username_key UNIQUE (username),
  constraint profiles_pkey PRIMARY KEY (id),
  constraint profiles_bidang_id_fkey FOREIGN KEY (bidang_id) REFERENCES bidang(id),
  constraint profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE,
  constraint profiles_role_check CHECK ((role = ANY (ARRAY['pending'::text, 'admin'::text, 'ketum'::text, 'bendahara'::text, 'sekretaris'::text, 'ketua_bidang'::text, 'petugas'::text])))
);
alter table public.profiles enable row level security;

create table if not exists public.qurban_bagi (
  id bigint default nextval('qurban_bagi_id_seq'::regclass) not null,
  tahun integer not null,
  nama text not null,
  kategori text default 'warga'::text not null,
  kantong integer default 1 not null,
  diambil boolean default false not null,
  diambil_at timestamp with time zone,
  catatan text,
  dicatat_by uuid default auth.uid(),
  dicatat_at timestamp with time zone default now() not null,
  constraint qurban_bagi_pkey PRIMARY KEY (id),
  constraint qurban_bagi_dicatat_by_fkey FOREIGN KEY (dicatat_by) REFERENCES profiles(id),
  constraint qurban_bagi_kantong_check CHECK (((kantong >= 1) AND (kantong <= 50))),
  constraint qurban_bagi_kategori_check CHECK ((kategori = ANY (ARRAY['shohibul'::text, 'warga'::text, 'dhuafa'::text, 'panitia'::text, 'lainnya'::text]))),
  constraint qurban_bagi_nama_check CHECK ((length(TRIM(BOTH FROM nama)) > 0))
);
alter table public.qurban_bagi enable row level security;

create table if not exists public.qurban_bayar (
  id bigint default nextval('qurban_bayar_id_seq'::regclass) not null,
  peserta_id bigint not null,
  tanggal date default today_wib() not null,
  jumlah numeric(14,0) not null,
  metode text default 'tunai'::text not null,
  dicatat_by uuid default auth.uid() not null,
  dicatat_at timestamp with time zone default now() not null,
  constraint qurban_bayar_pkey PRIMARY KEY (id),
  constraint qurban_bayar_dicatat_by_fkey FOREIGN KEY (dicatat_by) REFERENCES profiles(id),
  constraint qurban_bayar_peserta_id_fkey FOREIGN KEY (peserta_id) REFERENCES qurban_peserta(id) ON DELETE RESTRICT,
  constraint qurban_bayar_jumlah_check CHECK ((jumlah > (0)::numeric)),
  constraint qurban_bayar_metode_check CHECK ((metode = ANY (ARRAY['tunai'::text, 'transfer'::text])))
);
alter table public.qurban_bayar enable row level security;

create table if not exists public.qurban_peserta (
  id bigint default nextval('qurban_peserta_id_seq'::regclass) not null,
  tahun integer not null,
  jenis text not null,
  kelompok integer,
  nama text not null,
  atas_nama text,
  no_rumah text,
  no_hp text,
  target numeric(14,0) not null,
  catatan text,
  dicatat_by uuid default auth.uid() not null,
  dicatat_at timestamp with time zone default now() not null,
  constraint qurban_peserta_pkey PRIMARY KEY (id),
  constraint qurban_peserta_dicatat_by_fkey FOREIGN KEY (dicatat_by) REFERENCES profiles(id),
  constraint qurban_peserta_check CHECK (((jenis = 'sapi'::text) = (kelompok IS NOT NULL))),
  constraint qurban_peserta_jenis_check CHECK ((jenis = ANY (ARRAY['sapi'::text, 'kambing'::text]))),
  constraint qurban_peserta_kelompok_check CHECK (((kelompok >= 1) AND (kelompok <= 99))),
  constraint qurban_peserta_nama_check CHECK ((length(TRIM(BOTH FROM nama)) > 0)),
  constraint qurban_peserta_target_check CHECK ((target > (0)::numeric))
);
alter table public.qurban_peserta enable row level security;

create table if not exists public.qurban_setting (
  tahun integer not null,
  harga_sapi numeric(14,0) default 0 not null,
  harga_kambing numeric(14,0) default 0 not null,
  catatan text,
  diubah_by uuid,
  diubah_at timestamp with time zone default now() not null,
  constraint qurban_setting_pkey PRIMARY KEY (tahun),
  constraint qurban_setting_diubah_by_fkey FOREIGN KEY (diubah_by) REFERENCES profiles(id)
);
alter table public.qurban_setting enable row level security;

create table if not exists public.sesi_aplikasi (
  id bigint default nextval('sesi_aplikasi_id_seq'::regclass) not null,
  user_id uuid not null,
  mulai timestamp with time zone default now() not null,
  terakhir_aktif timestamp with time zone default now() not null,
  halaman text,
  perangkat text,
  constraint sesi_aplikasi_pkey PRIMARY KEY (id),
  constraint sesi_aplikasi_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
);
alter table public.sesi_aplikasi enable row level security;

create table if not exists public.takjil (
  id bigint default nextval('takjil_id_seq'::regclass) not null,
  tahun integer not null,
  tanggal date not null,
  ke integer not null,
  nama text not null,
  no_rumah text,
  no_hp text,
  isi text,
  porsi integer,
  sumber text default 'warga'::text not null,
  dibuat_by uuid,
  dibuat_at timestamp with time zone default now() not null,
  constraint takjil_pkey PRIMARY KEY (id),
  constraint takjil_dibuat_by_fkey FOREIGN KEY (dibuat_by) REFERENCES profiles(id),
  constraint takjil_ke_check CHECK (((ke >= 1) AND (ke <= 30))),
  constraint takjil_nama_check CHECK (((length(TRIM(BOTH FROM nama)) >= 2) AND (length(TRIM(BOTH FROM nama)) <= 60))),
  constraint takjil_porsi_check CHECK (((porsi IS NULL) OR ((porsi >= 1) AND (porsi <= 2000)))),
  constraint takjil_sumber_check CHECK ((sumber = ANY (ARRAY['warga'::text, 'pengurus'::text])))
);
alter table public.takjil enable row level security;

create table if not exists public.takjil_setting (
  tahun integer not null,
  kuota integer default 2 not null,
  buka boolean default true not null,
  catatan text,
  diubah_by uuid,
  diubah_at timestamp with time zone default now() not null,
  constraint takjil_setting_pkey PRIMARY KEY (tahun),
  constraint takjil_setting_diubah_by_fkey FOREIGN KEY (diubah_by) REFERENCES profiles(id),
  constraint takjil_setting_kuota_check CHECK (((kuota >= 1) AND (kuota <= 20)))
);
alter table public.takjil_setting enable row level security;

create table if not exists public.tarawih (
  id bigint default nextval('tarawih_id_seq'::regclass) not null,
  tahun integer not null,
  malam integer not null,
  imam text,
  bilal text,
  kultum text,
  tema text,
  diubah_by uuid default auth.uid(),
  diubah_at timestamp with time zone default now() not null,
  constraint tarawih_tahun_malam_key UNIQUE (tahun, malam),
  constraint tarawih_pkey PRIMARY KEY (id),
  constraint tarawih_diubah_by_fkey FOREIGN KEY (diubah_by) REFERENCES profiles(id),
  constraint tarawih_malam_check CHECK (((malam >= 1) AND (malam <= 30)))
);
alter table public.tarawih enable row level security;

create table if not exists public.warga (
  id bigint default nextval('warga_id_seq'::regclass) not null,
  nama text not null,
  alamat text,
  no_hp text,
  iuran_bulanan numeric(14,0) default 0 not null,
  aktif boolean default true not null,
  created_at timestamp with time zone default now() not null,
  constraint warga_pkey PRIMARY KEY (id)
);
alter table public.warga enable row level security;

create table if not exists public.zakat_salur (
  id bigint default nextval('zakat_salur_id_seq'::regclass) not null,
  tahun integer not null,
  tanggal date default today_wib() not null,
  nama text not null,
  alamat text,
  asnaf text default 'miskin'::text not null,
  beras_kg numeric(8,2) default 0 not null,
  uang numeric(14,0) default 0 not null,
  catatan text,
  dicatat_by uuid default auth.uid() not null,
  dicatat_at timestamp with time zone default now() not null,
  constraint zakat_salur_pkey PRIMARY KEY (id),
  constraint zakat_salur_dicatat_by_fkey FOREIGN KEY (dicatat_by) REFERENCES profiles(id),
  constraint zakat_salur_asnaf_check CHECK ((asnaf = ANY (ARRAY['fakir'::text, 'miskin'::text, 'amil'::text, 'mualaf'::text, 'riqab'::text, 'gharim'::text, 'fisabilillah'::text, 'ibnu_sabil'::text]))),
  constraint zakat_salur_beras_kg_check CHECK ((beras_kg >= (0)::numeric)),
  constraint zakat_salur_check CHECK (((beras_kg > (0)::numeric) OR (uang > (0)::numeric))),
  constraint zakat_salur_nama_check CHECK ((length(TRIM(BOTH FROM nama)) > 0)),
  constraint zakat_salur_uang_check CHECK ((uang >= (0)::numeric))
);
alter table public.zakat_salur enable row level security;

create table if not exists public.zakat_tahun (
  tahun integer not null,
  beras_kg numeric(6,2) default 2.5 not null,
  uang_jiwa numeric(14,0) default 0 not null,
  fidyah_beras_kg numeric(6,2) default 0.75 not null,
  fidyah_uang numeric(14,0) default 0 not null,
  diubah_by uuid,
  diubah_at timestamp with time zone default now() not null,
  constraint zakat_tahun_pkey PRIMARY KEY (tahun),
  constraint zakat_tahun_diubah_by_fkey FOREIGN KEY (diubah_by) REFERENCES profiles(id)
);
alter table public.zakat_tahun enable row level security;

create table if not exists public.zakat_terima (
  id bigint default nextval('zakat_terima_id_seq'::regclass) not null,
  tahun integer not null,
  tanggal date default today_wib() not null,
  jenis text not null,
  nama text not null,
  no_rumah text,
  jiwa integer default 0 not null,
  hari integer default 0 not null,
  bentuk text not null,
  beras_kg numeric(8,2) default 0 not null,
  uang numeric(14,0) default 0 not null,
  catatan text,
  dicatat_by uuid default auth.uid() not null,
  dicatat_at timestamp with time zone default now() not null,
  constraint zakat_terima_pkey PRIMARY KEY (id),
  constraint zakat_terima_dicatat_by_fkey FOREIGN KEY (dicatat_by) REFERENCES profiles(id),
  constraint zakat_terima_bentuk_check CHECK ((bentuk = ANY (ARRAY['beras'::text, 'uang'::text]))),
  constraint zakat_terima_beras_kg_check CHECK ((beras_kg >= (0)::numeric)),
  constraint zakat_terima_check CHECK (((beras_kg > (0)::numeric) OR (uang > (0)::numeric))),
  constraint zakat_terima_hari_check CHECK ((hari >= 0)),
  constraint zakat_terima_jenis_check CHECK ((jenis = ANY (ARRAY['fitrah'::text, 'fidyah'::text]))),
  constraint zakat_terima_jiwa_check CHECK ((jiwa >= 0)),
  constraint zakat_terima_nama_check CHECK ((length(TRIM(BOTH FROM nama)) > 0)),
  constraint zakat_terima_uang_check CHECK ((uang >= (0)::numeric))
);
alter table public.zakat_terima enable row level security;

create policy "baca_bidang" on public.bidang as PERMISSIVE for SELECT to authenticated using (true);

create policy "tulis_bidang" on public.bidang as PERMISSIVE for INSERT to authenticated with check (has_role(ARRAY['admin'::text, 'ketum'::text]));

create policy "ubah_bidang" on public.bidang as PERMISSIVE for UPDATE to authenticated using (has_role(ARRAY['admin'::text, 'ketum'::text]));

create policy "baca_intransit" on public.intransit as PERMISSIVE for SELECT to authenticated using (is_member());

create policy "inv_baca" on public.inventaris as PERMISSIVE for SELECT to authenticated using (is_member());

create policy "inv_hapus" on public.inventaris as PERMISSIVE for DELETE to authenticated using (has_role(ARRAY['admin'::text, 'ketum'::text]));

create policy "inv_tulis" on public.inventaris as PERMISSIVE for INSERT to authenticated with check (is_member());

create policy "inv_ubah" on public.inventaris as PERMISSIVE for UPDATE to authenticated using (is_member());

create policy "baca_iuran" on public.iuran as PERMISSIVE for SELECT to authenticated using (is_member());

create policy "baca_kas" on public.kas as PERMISSIVE for SELECT to authenticated using (is_member());

create policy "baca_keropak" on public.keropak_jumat as PERMISSIVE for SELECT to authenticated using (is_member());

create policy "baca_log" on public.log_aktivitas as PERMISSIVE for SELECT to authenticated using (is_member());

create policy "baca_maklumat" on public.maklumat as PERMISSIVE for SELECT to authenticated using (is_member());

create policy "baca_aju_item" on public.pengajuan_item as PERMISSIVE for SELECT to authenticated using (is_member());

create policy "baca_aju" on public.pengajuan as PERMISSIVE for SELECT to authenticated using (is_member());

create policy "pji_baca" on public.pinjam_item as PERMISSIVE for SELECT to authenticated using (is_member());

create policy "pj_baca" on public.pinjam as PERMISSIVE for SELECT to authenticated using (is_member());

create policy "baca_pos" on public.pos_dana as PERMISSIVE for SELECT to authenticated using (true);

create policy "tulis_pos" on public.pos_dana as PERMISSIVE for INSERT to authenticated with check ((has_role(ARRAY['admin'::text, 'ketum'::text, 'bendahara'::text]) AND (NOT utama)));

create policy "ubah_pos" on public.pos_dana as PERMISSIVE for UPDATE to authenticated using (has_role(ARRAY['admin'::text, 'ketum'::text, 'bendahara'::text]));

create policy "baca_profil" on public.profiles as PERMISSIVE for SELECT to authenticated using (((id = auth.uid()) OR is_member()));

create policy "qg_baca" on public.qurban_bagi as PERMISSIVE for SELECT to authenticated using (is_member());

create policy "qg_hapus" on public.qurban_bagi as PERMISSIVE for DELETE to authenticated using (((dicatat_by = auth.uid()) OR has_role(ARRAY['admin'::text, 'ketum'::text])));

create policy "qg_tulis" on public.qurban_bagi as PERMISSIVE for INSERT to authenticated with check (is_member());

create policy "qg_ubah" on public.qurban_bagi as PERMISSIVE for UPDATE to authenticated using (is_member());

create policy "qb_baca" on public.qurban_bayar as PERMISSIVE for SELECT to authenticated using (is_member());

create policy "qb_hapus" on public.qurban_bayar as PERMISSIVE for DELETE to authenticated using (((dicatat_by = auth.uid()) OR has_role(ARRAY['admin'::text, 'ketum'::text, 'bendahara'::text])));

create policy "qb_tulis" on public.qurban_bayar as PERMISSIVE for INSERT to authenticated with check ((is_member() AND (dicatat_by = auth.uid())));

create policy "qp_baca" on public.qurban_peserta as PERMISSIVE for SELECT to authenticated using (is_member());

create policy "qp_hapus" on public.qurban_peserta as PERMISSIVE for DELETE to authenticated using (((dicatat_by = auth.uid()) OR has_role(ARRAY['admin'::text, 'ketum'::text, 'bendahara'::text])));

create policy "qp_tulis" on public.qurban_peserta as PERMISSIVE for INSERT to authenticated with check ((is_member() AND (dicatat_by = auth.uid())));

create policy "qp_ubah" on public.qurban_peserta as PERMISSIVE for UPDATE to authenticated using (((dicatat_by = auth.uid()) OR has_role(ARRAY['admin'::text, 'ketum'::text, 'bendahara'::text])));

create policy "qs_baca" on public.qurban_setting as PERMISSIVE for SELECT to authenticated using (is_member());

create policy "qs_tulis" on public.qurban_setting as PERMISSIVE for INSERT to authenticated with check (has_role(ARRAY['admin'::text, 'ketum'::text]));

create policy "qs_ubah" on public.qurban_setting as PERMISSIVE for UPDATE to authenticated using (has_role(ARRAY['admin'::text, 'ketum'::text]));

create policy "baca_sesi" on public.sesi_aplikasi as PERMISSIVE for SELECT to authenticated using (has_role(ARRAY['admin'::text]));

create policy "tks_baca" on public.takjil_setting as PERMISSIVE for SELECT to authenticated using (is_member());

create policy "tks_tulis" on public.takjil_setting as PERMISSIVE for INSERT to authenticated with check (bisa_takjil());

create policy "tks_ubah" on public.takjil_setting as PERMISSIVE for UPDATE to authenticated using (bisa_takjil());

create policy "tk_baca" on public.takjil as PERMISSIVE for SELECT to authenticated using (is_member());

create policy "tk_hapus" on public.takjil as PERMISSIVE for DELETE to authenticated using (bisa_takjil());

create policy "tr_baca" on public.tarawih as PERMISSIVE for SELECT to authenticated using (is_member());

create policy "tr_hapus" on public.tarawih as PERMISSIVE for DELETE to authenticated using (bisa_maklumat());

create policy "tr_tulis" on public.tarawih as PERMISSIVE for INSERT to authenticated with check (bisa_maklumat());

create policy "tr_ubah" on public.tarawih as PERMISSIVE for UPDATE to authenticated using (bisa_maklumat());

create policy "baca_warga" on public.warga as PERMISSIVE for SELECT to authenticated using (is_member());

create policy "tulis_warga" on public.warga as PERMISSIVE for INSERT to authenticated with check (has_role(ARRAY['admin'::text, 'ketum'::text, 'bendahara'::text, 'sekretaris'::text, 'petugas'::text]));

create policy "ubah_warga" on public.warga as PERMISSIVE for UPDATE to authenticated using (has_role(ARRAY['admin'::text, 'ketum'::text, 'bendahara'::text, 'sekretaris'::text, 'petugas'::text]));

create policy "zs_baca" on public.zakat_salur as PERMISSIVE for SELECT to authenticated using (is_member());

create policy "zs_hapus" on public.zakat_salur as PERMISSIVE for DELETE to authenticated using (((dicatat_by = auth.uid()) OR has_role(ARRAY['admin'::text, 'ketum'::text])));

create policy "zs_tulis" on public.zakat_salur as PERMISSIVE for INSERT to authenticated with check ((is_member() AND (dicatat_by = auth.uid())));

create policy "zt_baca" on public.zakat_tahun as PERMISSIVE for SELECT to authenticated using (is_member());

create policy "zt_tulis" on public.zakat_tahun as PERMISSIVE for INSERT to authenticated with check (has_role(ARRAY['admin'::text, 'ketum'::text]));

create policy "zt_ubah" on public.zakat_tahun as PERMISSIVE for UPDATE to authenticated using (has_role(ARRAY['admin'::text, 'ketum'::text]));

create policy "zr_baca" on public.zakat_terima as PERMISSIVE for SELECT to authenticated using (is_member());

create policy "zr_hapus" on public.zakat_terima as PERMISSIVE for DELETE to authenticated using (((dicatat_by = auth.uid()) OR has_role(ARRAY['admin'::text, 'ketum'::text])));

create policy "zr_tulis" on public.zakat_terima as PERMISSIVE for INSERT to authenticated with check ((is_member() AND (dicatat_by = auth.uid())));

CREATE OR REPLACE FUNCTION public._inv_cek()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v int;
begin
  if tg_op = 'UPDATE' then
    v := _inv_dipinjam(new.id);
    if new.jumlah < v then raise exception 'Jumlah tidak boleh kurang dari yang sedang dipinjam (% %)', v, new.satuan; end if;
    if not new.aktif and v > 0 then raise exception 'Barang masih dipinjam, tidak bisa dinonaktifkan'; end if;
    new.diubah_by := auth.uid(); new.diubah_at := now();
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public._inv_dipinjam(p_inv bigint)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(sum(i.qty), 0)::int from pinjam_item i join pinjam p on p.id = i.pinjam_id
   where i.inventaris_id = p_inv and p.status = 'dipinjam';
$function$
;

CREATE OR REPLACE FUNCTION public._inv_log()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if tg_op = 'INSERT' then perform _log('inventaris', new.id, 'aset ditambahkan', new.nama || ' · ' || new.jumlah || ' ' || new.satuan);
  elsif tg_op = 'DELETE' then perform _log('inventaris', old.id, 'aset dihapus', old.nama);
  elsif new.jumlah <> old.jumlah or new.kondisi <> old.kondisi or new.aktif <> old.aktif then
    perform _log('inventaris', new.id, 'aset diubah', new.nama || ' · ' || new.jumlah || ' ' || new.satuan || ' · ' || replace(new.kondisi, '_', ' ') || case when new.aktif then '' else ' · nonaktif' end);
  end if;
  return null;
end $function$
;

CREATE OR REPLACE FUNCTION public._kas(p_tanggal date, p_jenis text, p_kategori text, p_jumlah numeric, p_ket text, p_ref_tabel text, p_ref_id bigint)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
end $function$
;

CREATE OR REPLACE FUNCTION public._kas_pos()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
end $function$
;

CREATE OR REPLACE FUNCTION public._log(p_modul text, p_ref bigint, p_aksi text, p_catatan text)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  insert into log_aktivitas (oleh, modul, ref_id, aksi, catatan) values (auth.uid(), p_modul, p_ref, p_aksi, p_catatan);
$function$
;

CREATE OR REPLACE FUNCTION public._qurban_bagi_waktu()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin new.diambil_at := case when new.diambil then coalesce(new.diambil_at, now()) end; return new; end $function$
;

CREATE OR REPLACE FUNCTION public._qurban_cek_bayar()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_target numeric; v_sudah numeric;
begin
  select target into v_target from qurban_peserta where id = new.peserta_id for update;
  select coalesce(sum(jumlah), 0) into v_sudah from qurban_bayar where peserta_id = new.peserta_id;
  if v_sudah + new.jumlah > v_target then
    raise exception 'Pembayaran melebihi kekurangan (sisa %)', _rp(v_target - v_sudah);
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public._qurban_cek_kelompok()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.jenis = 'sapi' then
    perform pg_advisory_xact_lock(667788, new.tahun * 100 + new.kelompok);
    if (select count(*) from qurban_peserta where tahun = new.tahun and jenis = 'sapi' and kelompok = new.kelompok and id <> coalesce(new.id, 0)) >= 7 then
      raise exception 'Kelompok sapi % sudah penuh (7 orang)', new.kelompok;
    end if;
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public._qurban_log()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_nama text;
begin
  if tg_table_name = 'qurban_peserta' then
    perform _log('qurban', coalesce(new.id, old.id),
      case when tg_op = 'INSERT' then 'peserta didaftarkan' else 'peserta dihapus' end,
      coalesce(new.nama, old.nama) || ' · ' || case when coalesce(new.jenis, old.jenis) = 'sapi' then 'sapi kelompok ' || coalesce(new.kelompok, old.kelompok) else 'kambing' end);
  else
    select nama into v_nama from qurban_peserta where id = coalesce(new.peserta_id, old.peserta_id);
    perform _log('qurban', coalesce(new.id, old.id),
      case when tg_op = 'INSERT' then 'pembayaran dicatat' else 'pembayaran dihapus' end,
      coalesce(v_nama, '-') || ' · ' || _rp(coalesce(new.jumlah, old.jumlah)));
  end if;
  return null;
end $function$
;

CREATE OR REPLACE FUNCTION public._rp(n numeric)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$ select 'Rp ' || replace(to_char(coalesce(n,0),'FM999,999,999,990'),',','.') $function$
;

CREATE OR REPLACE FUNCTION public._takjil_log_hapus()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin perform _log('takjil', old.id, 'pendaftaran dihapus', old.nama || ' · Ramadhan ke-' || old.ke); return null; end $function$
;

CREATE OR REPLACE FUNCTION public._zakat_cek_hapus()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_b numeric; v_u numeric;
begin
  perform pg_advisory_xact_lock(445566, old.tahun);
  select coalesce(sum(beras_kg),0) - old.beras_kg, coalesce(sum(uang),0) - old.uang into v_b, v_u from zakat_terima where tahun = old.tahun;
  select v_b - coalesce(sum(beras_kg),0), v_u - coalesce(sum(uang),0) into v_b, v_u from zakat_salur where tahun = old.tahun;
  if v_b < 0 or v_u < 0 then raise exception 'Tidak bisa dihapus: zakat ini sudah tersalurkan. Hapus dulu data penyaluran terkait'; end if;
  return old;
end $function$
;

CREATE OR REPLACE FUNCTION public._zakat_cek_salur()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_b numeric; v_u numeric;
begin
  perform pg_advisory_xact_lock(445566, new.tahun);
  select coalesce(sum(beras_kg),0), coalesce(sum(uang),0) into v_b, v_u from zakat_terima where tahun = new.tahun;
  select v_b - coalesce(sum(beras_kg),0), v_u - coalesce(sum(uang),0) into v_b, v_u from zakat_salur where tahun = new.tahun;
  if new.beras_kg > v_b then raise exception 'Beras yang disalurkan melebihi sisa (% kg)', v_b; end if;
  if new.uang > v_u then raise exception 'Uang yang disalurkan melebihi sisa (%)', _rp(v_u); end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public._zakat_log()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r record; v_isi text;
begin
  r := coalesce(new, old);
  v_isi := r.nama || ' · ' || concat_ws(' + ',
             case when r.beras_kg > 0 then trim(to_char(r.beras_kg, 'FM999990.##')) || ' kg beras' end,
             case when r.uang > 0 then _rp(r.uang) end);
  if tg_table_name = 'zakat_terima' then
    perform _log('zakat', r.id, case when tg_op = 'INSERT' then 'penerimaan ' || r.jenis || ' dicatat' else 'penerimaan dihapus' end, v_isi);
  else
    perform _log('zakat', r.id, case when tg_op = 'INSERT' then 'penyaluran dicatat' else 'penyaluran dihapus' end, v_isi);
  end if;
  return null;
end $function$
;

CREATE OR REPLACE FUNCTION public.ajukan_pengajuan(p_judul text, p_keterangan text, p_kebutuhan date, p_items jsonb)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
end $function$
;

CREATE OR REPLACE FUNCTION public.batal_iuran(p_id bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
end $function$
;

CREATE OR REPLACE FUNCTION public.batal_pengajuan(p_id bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare p pengajuan;
begin
  select * into p from pengajuan where id = p_id for update;
  if p.id is null then raise exception 'Pengajuan tidak ditemukan'; end if;
  if p.diajukan_by <> auth.uid() then raise exception 'Hanya pembuat pengajuan yang bisa membatalkan'; end if;
  if p.status <> 'diajukan' then raise exception 'Pengajuan sudah diproses Ketua Umum, tidak bisa dibatalkan'; end if;
  update pengajuan set status = 'dibatalkan' where id = p_id;
  perform _log('pengajuan', p_id, 'dibatalkan', null);
end $function$
;

CREATE OR REPLACE FUNCTION public.bendahara_cairkan(p_id bigint, p_metode text, p_catatan text, p_pos integer DEFAULT NULL::integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
end $function$
;

CREATE OR REPLACE FUNCTION public.bisa_maklumat()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select has_role(array['admin','ketum'])
      or exists (select 1 from profiles where id = auth.uid() and aktif and role <> 'pending' and boleh_maklumat);
$function$
;

CREATE OR REPLACE FUNCTION public.bisa_takjil()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ select bisa_maklumat() $function$
;

CREATE OR REPLACE FUNCTION public.catat_iuran(p_warga bigint, p_periode text[], p_jumlah numeric, p_metode text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
end $function$
;

CREATE OR REPLACE FUNCTION public.catat_kembalian(p_pengajuan bigint, p_jumlah numeric, p_catatan text)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
                                                                                                                                              end $function$
;

CREATE OR REPLACE FUNCTION public.daftar_takjil(p_tahun integer, p_tanggal date, p_ke integer, p_nama text, p_no_rumah text, p_no_hp text, p_isi text, p_porsi integer)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_kuota int; v_buka boolean; v_n int; v_hp text; v_id bigint; v_pengurus boolean := is_member();
begin
  select kuota, buka into v_kuota, v_buka from takjil_setting where tahun = p_tahun;
  v_kuota := coalesce(v_kuota, 2); v_buka := coalesce(v_buka, true);
  v_hp := nullif(regexp_replace(coalesce(p_no_hp,''), '\D', '', 'g'), '');
  if length(trim(coalesce(p_nama,''))) < 2 then raise exception 'Nama wajib diisi'; end if;
  if p_ke not between 1 and 30 then raise exception 'Hari Ramadhan tidak valid'; end if;

  if not v_pengurus then
    if not v_buka then raise exception 'Pendaftaran takjil sedang ditutup oleh pengurus'; end if;
    if p_tanggal < today_wib() then raise exception 'Tanggal ini sudah lewat'; end if;
    if p_tanggal > today_wib() + 400 then raise exception 'Tanggal tidak valid'; end if;
    if length(trim(coalesce(p_no_rumah,''))) = 0 then raise exception 'Nomor rumah wajib diisi'; end if;
    if v_hp is null or length(v_hp) not between 9 and 15 then raise exception 'Nomor HP/WA tidak valid'; end if;
    if (select count(*) from takjil where tahun = p_tahun and no_hp = v_hp) >= 3 then
      raise exception 'Nomor HP ini sudah terdaftar 3 kali. Hubungi pengurus kalau ingin menambah';
    end if;
  end if;

  perform pg_advisory_xact_lock(556677, (p_tanggal - date '2000-01-01'));
  if v_hp is not null and exists (select 1 from takjil where tahun = p_tahun and tanggal = p_tanggal and no_hp = v_hp) then
    raise exception 'Anda sudah terdaftar di tanggal ini';
  end if;
  select count(*) into v_n from takjil where tahun = p_tahun and tanggal = p_tanggal;
  if v_n >= v_kuota and not v_pengurus then
    raise exception 'Maaf, tanggal ini sudah penuh (% donatur). Silakan pilih tanggal lain', v_kuota;
  end if;

  insert into takjil (tahun, tanggal, ke, nama, no_rumah, no_hp, isi, porsi, sumber, dibuat_by)
  values (p_tahun, p_tanggal, p_ke, trim(p_nama), nullif(trim(coalesce(p_no_rumah,'')),''), v_hp,
          nullif(trim(coalesce(p_isi,'')),''), p_porsi, case when v_pengurus then 'pengurus' else 'warga' end,
          case when v_pengurus then auth.uid() end)
  returning id into v_id;
  perform _log('takjil', v_id, 'donatur terdaftar', trim(p_nama) || ' · Ramadhan ke-' || p_ke);
  return v_id;
end $function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
                                                            end $function$
;

CREATE OR REPLACE FUNCTION public.hapus_maklumat(p_id bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_tgl date;
begin
  if not has_role(array['admin','ketum']) then raise exception 'Hanya Admin / Ketua Umum yang bisa menghapus maklumat'; end if;
  delete from maklumat where id = p_id returning tanggal into v_tgl;
  if v_tgl is null then raise exception 'Maklumat tidak ditemukan'; end if;
  perform _log('maklumat', p_id, 'dihapus', to_char(v_tgl, 'DD-MM-YYYY'));
end $function$
;

CREATE OR REPLACE FUNCTION public.hapus_pinjam(p_id bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare p pinjam;
begin
  if not has_role(array['admin','ketum']) then raise exception 'Hanya Admin / Ketua Umum yang bisa menghapus'; end if;
  select * into p from pinjam where id = p_id;
  delete from pinjam where id = p_id;
  perform _log('inventaris', p_id, 'catatan pinjam dihapus', p.peminjam);
end $function$
;

CREATE OR REPLACE FUNCTION public.has_role(r text[])
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (select 1 from profiles where id = auth.uid() and aktif and role = any(r));
$function$
;

CREATE OR REPLACE FUNCTION public.is_member()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (select 1 from profiles where id = auth.uid() and aktif and role <> 'pending');
$function$
;

CREATE OR REPLACE FUNCTION public.jamaah_publik(p_tahun_hijri integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare m maklumat; v_tgl date := today_wib(); v_awal date := date_trunc('month', today_wib())::date; r jsonb;
begin
  select * into m from maklumat where tanggal <= v_tgl + 7 order by tanggal desc limit 1;

  r := jsonb_build_object(
    'maklumat', case when m.id is null then null else jsonb_build_object(
        'tanggal', m.tanggal, 'waktu', m.waktu, 'khatib', m.khatib, 'muadzin', m.muadzin,
        'petugas_maklumat', m.petugas_maklumat, 'nama_masjid', m.nama_masjid, 'alamat', m.alamat,
        'kegiatan', m.kegiatan, 'rekening', m.rekening, 'token_listrik', m.token_listrik, 'token_an', m.token_an) end,
    'laporan', case when m.id is null then '[]'::jsonb else coalesce((
        select jsonb_agg(x order by x.urutan, x.pos_id) from (
          select p.id pos_id, p.nama, p.urutan,
            coalesce(sum(case when k.tanggal <= m.tanggal - 7 then case when k.jenis = 'masuk' then k.jumlah else -k.jumlah end end), 0) saldo_lalu,
            coalesce(sum(case when k.tanggal > m.tanggal - 7 and k.tanggal <= m.tanggal and k.jenis = 'masuk' then k.jumlah end), 0) masuk,
            coalesce(sum(case when k.tanggal > m.tanggal - 7 and k.tanggal <= m.tanggal and k.jenis = 'keluar' then k.jumlah end), 0) keluar,
            coalesce(sum(case when k.tanggal <= m.tanggal then case when k.jenis = 'masuk' then k.jumlah else -k.jumlah end end), 0) total
          from pos_dana p left join kas k on k.pos_id = p.id
          where p.aktif or exists (select 1 from kas z where z.pos_id = p.id and z.tanggal <= m.tanggal)
          group by p.id, p.nama, p.urutan) x), '[]'::jsonb) end,
    'saldo', coalesce((
        select jsonb_agg(jsonb_build_object('nama', p.nama, 'saldo', s.saldo) order by p.urutan, p.id)
        from pos_dana p cross join lateral (select coalesce(sum(case when jenis = 'masuk' then jumlah else -jumlah end), 0) saldo from kas where pos_id = p.id) s
        where p.aktif or s.saldo <> 0), '[]'::jsonb),
    'bulan', (select jsonb_build_object(
        'masuk',  coalesce(sum(jumlah) filter (where jenis = 'masuk'), 0),
        'keluar', coalesce(sum(jumlah) filter (where jenis = 'keluar'), 0))
        from kas where tanggal >= v_awal and tanggal <= v_tgl),
    'zakat', (select jsonb_build_object(
        'muzakki', (select count(*) from zakat_terima where tahun = p_tahun_hijri),
        'jiwa', (select coalesce(sum(jiwa), 0) from zakat_terima where tahun = p_tahun_hijri),
        'terima_kg', (select coalesce(sum(beras_kg), 0) from zakat_terima where tahun = p_tahun_hijri),
        'terima_uang', (select coalesce(sum(uang), 0) from zakat_terima where tahun = p_tahun_hijri),
        'salur_kg', (select coalesce(sum(beras_kg), 0) from zakat_salur where tahun = p_tahun_hijri),
        'salur_uang', (select coalesce(sum(uang), 0) from zakat_salur where tahun = p_tahun_hijri),
        'mustahik', (select count(*) from zakat_salur where tahun = p_tahun_hijri))),
    'tarawih', coalesce((select jsonb_agg(jsonb_build_object('malam', malam, 'imam', imam, 'bilal', bilal, 'kultum', kultum, 'tema', tema) order by malam)
        from tarawih where tahun = p_tahun_hijri), '[]'::jsonb)
  );
  return r;
end $function$
;

CREATE OR REPLACE FUNCTION public.kas_manual(p_tanggal date, p_jenis text, p_pos integer, p_kategori text, p_jumlah numeric, p_keterangan text)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_id bigint;
begin
  if not has_role(array['bendahara','admin']) then raise exception 'Hanya Bendahara yang bisa mencatat transaksi kas'; end if;
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
end $function$
;

CREATE OR REPLACE FUNCTION public.kas_pindah_pos(p_tanggal date, p_dari integer, p_ke integer, p_jumlah numeric, p_keterangan text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_dari text; v_ke text; v_id bigint;
begin
  if not has_role(array['bendahara','admin']) then raise exception 'Hanya Bendahara yang bisa memindah dana'; end if;
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
end $function$
;

CREATE OR REPLACE FUNCTION public.kembalikan_pinjam(p_id bigint, p_catatan text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare p pinjam;
begin
  if not is_member() then raise exception 'Hanya pengurus yang bisa mencatat pengembalian'; end if;
  select * into p from pinjam where id = p_id for update;
  if p.id is null then raise exception 'Data peminjaman tidak ditemukan'; end if;
  if p.status = 'kembali' then raise exception 'Sudah dikembalikan sebelumnya'; end if;
  update pinjam set status = 'kembali', kembali_by = auth.uid(), kembali_at = now(),
         kembali_catatan = nullif(trim(coalesce(p_catatan,'')),'') where id = p_id;
  perform _log('inventaris', p_id, 'dikembalikan', p.peminjam || coalesce(' · ' || nullif(trim(coalesce(p_catatan,'')),''), ''));
end $function$
;

CREATE OR REPLACE FUNCTION public.ketum_putuskan(p_id bigint, p_setuju boolean, p_nominal numeric, p_catatan text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
end $function$
;

CREATE OR REPLACE FUNCTION public.konfirmasi_terima(p_id bigint, p_catatan text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
end $function$
;

CREATE OR REPLACE FUNCTION public.laporan_pos(p_tgl date)
 RETURNS TABLE(pos_id integer, nama text, saldo_lalu numeric, masuk numeric, keluar numeric, total numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select p.id, p.nama,
    coalesce(sum(case when k.tanggal <= p_tgl - 7 then case when k.jenis = 'masuk' then k.jumlah else -k.jumlah end end), 0),
    coalesce(sum(case when k.tanggal > p_tgl - 7 and k.tanggal <= p_tgl and k.jenis = 'masuk' then k.jumlah end), 0),
    coalesce(sum(case when k.tanggal > p_tgl - 7 and k.tanggal <= p_tgl and k.jenis = 'keluar' then k.jumlah end), 0),
    coalesce(sum(case when k.tanggal <= p_tgl then case when k.jenis = 'masuk' then k.jumlah else -k.jumlah end end), 0)
  from pos_dana p left join kas k on k.pos_id = p.id
  where is_member() and (p.aktif or exists (select 1 from kas x where x.pos_id = p.id and x.tanggal <= p_tgl))
  group by p.id, p.nama, p.urutan
  order by p.urutan, p.id;
$function$
;

CREATE OR REPLACE FUNCTION public.mulai_sesi(p_perangkat text)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_id bigint;
begin
  if auth.uid() is null then raise exception 'Belum login'; end if;
    select id into v_id from sesi_aplikasi
       where user_id = auth.uid() and perangkat = left(p_perangkat, 200)
            and terakhir_aktif > now() - interval '3 minutes'
               order by id desc limit 1;
                 if v_id is null then
                     insert into sesi_aplikasi (user_id, perangkat)
                         values (auth.uid(), left(p_perangkat, 200)) returning id into v_id;
                           end if;
                             return v_id;
                             end $function$
;

CREATE OR REPLACE FUNCTION public.ping_sesi(p_id bigint, p_halaman text)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
                                                                                                                                                                                                                                 update sesi_aplikasi set terakhir_aktif = now(), halaman = left(p_halaman, 40)
                                                                                                                                                                                                                                    where id = p_id and user_id = auth.uid();
                                                                                                                                                                                                                                    $function$
;

CREATE OR REPLACE FUNCTION public.pinjamkan(p_peminjam text, p_no_hp text, p_no_rumah text, p_keperluan text, p_tgl_pinjam date, p_tgl_kembali date, p_items jsonb)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_id bigint; it jsonb; b inventaris; v_sisa int; v_daftar text := '';
begin
  if not is_member() then raise exception 'Hanya pengurus yang bisa mencatat peminjaman'; end if;
  if length(trim(coalesce(p_peminjam,''))) = 0 then raise exception 'Nama peminjam wajib diisi'; end if;
  if p_tgl_kembali < p_tgl_pinjam then raise exception 'Tanggal kembali tidak boleh sebelum tanggal pinjam'; end if;
  if jsonb_array_length(coalesce(p_items, '[]')) = 0 then raise exception 'Pilih minimal 1 barang'; end if;

  insert into pinjam (peminjam, no_hp, no_rumah, keperluan, tgl_pinjam, tgl_kembali, dicatat_by)
  values (trim(p_peminjam), nullif(trim(coalesce(p_no_hp,'')),''), nullif(trim(coalesce(p_no_rumah,'')),''),
          nullif(trim(coalesce(p_keperluan,'')),''), p_tgl_pinjam, p_tgl_kembali, auth.uid())
  returning id into v_id;

  for it in select * from jsonb_array_elements(p_items) loop
    select * into b from inventaris where id = (it->>'id')::bigint and aktif for update;
    if b.id is null then raise exception 'Barang tidak ditemukan'; end if;
    if not b.bisa_dipinjam then raise exception '% tidak untuk dipinjamkan', b.nama; end if;
    v_sisa := b.jumlah - _inv_dipinjam(b.id);
    if (it->>'qty')::int > v_sisa then raise exception '% hanya tersedia % %', b.nama, v_sisa, b.satuan; end if;
    insert into pinjam_item (pinjam_id, inventaris_id, qty) values (v_id, b.id, (it->>'qty')::int);
    v_daftar := v_daftar || case when v_daftar = '' then '' else ', ' end || b.nama || ' ' || (it->>'qty') || ' ' || b.satuan;
  end loop;

  perform _log('inventaris', v_id, 'dipinjam', trim(p_peminjam) || ' · ' || v_daftar);
  return v_id;
end $function$
;

CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
  tbl name;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        SELECT c.relname INTO tbl FROM pg_catalog.pg_class c WHERE c.oid = cmd.objid;
        EXECUTE format('alter table if exists %I.%I enable row level security', cmd.schema_name, tbl);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.saldo_kas()
 RETURNS numeric
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(sum(case when jenis = 'masuk' then jumlah else -jumlah end), 0) from kas;
$function$
;

CREATE OR REPLACE FUNCTION public.saldo_pos(p_pos integer)
 RETURNS numeric
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(sum(case when jenis = 'masuk' then jumlah else -jumlah end), 0) from kas where pos_id = p_pos;
$function$
;

CREATE OR REPLACE FUNCTION public.serahkan_intransit(p_id bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
                                                                                                                                                                    end $function$
;

CREATE OR REPLACE FUNCTION public.set_akses_maklumat(p_id uuid, p_boleh boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not has_role(array['admin','ketum']) then raise exception 'Hanya Admin / Ketua Umum yang bisa mengatur akses maklumat'; end if;
  update profiles set boleh_maklumat = coalesce(p_boleh, false) where id = p_id;
  if not found then raise exception 'Pengurus tidak ditemukan'; end if;
  perform _log('user', null, case when p_boleh then 'beri akses maklumat' else 'cabut akses maklumat' end,
               (select nama from profiles where id = p_id));
end $function$
;

CREATE OR REPLACE FUNCTION public.set_user(p_id uuid, p_role text, p_bidang integer, p_jabatan text, p_aktif boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
end $function$
;

CREATE OR REPLACE FUNCTION public.setor_keropak(p_tanggal date, p_jumlah numeric, p_saksi1 text, p_saksi2 text, p_catatan text)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
end $function$
;

CREATE OR REPLACE FUNCTION public.simpan_maklumat(p jsonb)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
end $function$
;

CREATE OR REPLACE FUNCTION public.takjil_publik(p_tahun integer)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select jsonb_build_object(
    'kuota', coalesce((select kuota from takjil_setting where tahun = p_tahun), 2),
    'buka',  coalesce((select buka from takjil_setting where tahun = p_tahun), true),
    'catatan', (select catatan from takjil_setting where tahun = p_tahun),
    'daftar', coalesce((select jsonb_agg(jsonb_build_object('tanggal', tanggal, 'nama', nama, 'no_rumah', no_rumah, 'isi', isi) order by id)
                        from takjil where tahun = p_tahun), '[]'::jsonb));
$function$
;

CREATE OR REPLACE FUNCTION public.terima_intransit(p_id bigint, p_catatan text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
                                                                                                                                                                                                             end $function$
;

CREATE OR REPLACE FUNCTION public.terima_setoran_iuran(p_ids bigint[])
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
end $function$
;

CREATE OR REPLACE FUNCTION public.today_wib()
 RETURNS date
 LANGUAGE sql
 STABLE
AS $function$ select (now() at time zone 'Asia/Jakarta')::date $function$
;

CREATE OR REPLACE FUNCTION public.ubah_profil_saya(p_nama text, p_no_hp text, p_no_rumah text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
                                                              update profiles set nama = coalesce(nullif(trim(p_nama),''), nama), no_hp = p_no_hp,
                                                                       no_rumah = coalesce(nullif(trim(p_no_rumah),''), no_rumah)
                                                                          where id = auth.uid();
                                                                          $function$
;

CREATE OR REPLACE FUNCTION public.verifikasi_keropak(p_id bigint, p_terima boolean, p_catatan text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
end $function$
;

CREATE TRIGGER inv_cek BEFORE UPDATE ON public.inventaris FOR EACH ROW EXECUTE FUNCTION _inv_cek();

CREATE TRIGGER inv_log AFTER INSERT OR DELETE OR UPDATE ON public.inventaris FOR EACH ROW EXECUTE FUNCTION _inv_log();

CREATE TRIGGER kas_pos_trg BEFORE INSERT ON public.kas FOR EACH ROW EXECUTE FUNCTION _kas_pos();

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();

CREATE TRIGGER qurban_bagi_waktu BEFORE INSERT OR UPDATE ON public.qurban_bagi FOR EACH ROW EXECUTE FUNCTION _qurban_bagi_waktu();

CREATE TRIGGER qurban_bayar_log AFTER INSERT OR DELETE ON public.qurban_bayar FOR EACH ROW EXECUTE FUNCTION _qurban_log();

CREATE TRIGGER qurban_cek_bayar BEFORE INSERT ON public.qurban_bayar FOR EACH ROW EXECUTE FUNCTION _qurban_cek_bayar();

CREATE TRIGGER qurban_cek_kelompok BEFORE INSERT OR UPDATE OF kelompok, jenis ON public.qurban_peserta FOR EACH ROW EXECUTE FUNCTION _qurban_cek_kelompok();

CREATE TRIGGER qurban_peserta_log AFTER INSERT OR DELETE ON public.qurban_peserta FOR EACH ROW EXECUTE FUNCTION _qurban_log();

CREATE TRIGGER takjil_log_hapus AFTER DELETE ON public.takjil FOR EACH ROW EXECUTE FUNCTION _takjil_log_hapus();

CREATE TRIGGER zakat_cek_hapus BEFORE DELETE ON public.zakat_terima FOR EACH ROW EXECUTE FUNCTION _zakat_cek_hapus();

CREATE TRIGGER zakat_cek_salur BEFORE INSERT ON public.zakat_salur FOR EACH ROW EXECUTE FUNCTION _zakat_cek_salur();

CREATE TRIGGER zakat_salur_log AFTER INSERT OR DELETE ON public.zakat_salur FOR EACH ROW EXECUTE FUNCTION _zakat_log();

CREATE TRIGGER zakat_terima_log AFTER INSERT OR DELETE ON public.zakat_terima FOR EACH ROW EXECUTE FUNCTION _zakat_log();