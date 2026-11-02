# Aplikasi DKM Masjid Jami Turayah — Setup (GitHub + Vercel + Supabase + Next.js)

## 1. Supabase
1. supabase.com → **New project** → nama `DKM Masjid Jami Turayah`, region Singapore.
   (Akun gratis maksimal 2 project aktif.)
2. **SQL Editor → New query** → paste isi `supabase/migrations/001_dkm_init.sql` → **Run** (sekali saja).
   Lalu **New query** lagi → paste isi `002_pos_dana_maklumat.sql` → **Run** (sekali saja).
   > Kalau database sudah jalan dari versi sebelumnya: cukup jalankan `002_pos_dana_maklumat.sql` saja. Data lama aman, semua transaksi lama otomatis masuk pos **Infak DKM**.
3. **Authentication → Sign In / Providers → Email** → matikan **Confirm email** → Save.
4. **Project Settings → API** → catat **Project URL** dan **anon public key**.

## 2. GitHub
Bikin repo baru (misal `dkm-turayah`) → upload semua isi folder ini.
Folder `node_modules` dan `.next` tidak perlu (sudah di-.gitignore).

## 3. Vercel
1. **Add New → Project** → import repo `dkm-turayah` (Framework otomatis Next.js).
2. Sebelum Deploy, buka **Environment Variables**, isi:
   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL dari Supabase |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon public key |
   | `NEXT_PUBLIC_NAMA_DKM` | `DKM Masjid Jami Turayah` (opsional) |
   | `NEXT_PUBLIC_EMAIL_DOMAIN` | `dkmturayah.id` (opsional) |
3. **Deploy**. Kalau env diisi/diubah setelah deploy, lakukan **Redeploy** supaya terbaca.

Coba di komputer sendiri (opsional): salin `.env.local.example` jadi `.env.local`, isi, lalu `npm install` → `npm run dev`.

## 4. Mulai pakai
1. **Akun pertama yang daftar otomatis jadi Admin** — daftar duluan pakai akunmu.
2. Pengurus lain daftar sendiri ("Daftar Pengurus"), Admin/Ketum atur jabatannya di menu **Kelola**.
3. Bendahara catat **Saldo Awal per pos** di Buku Kas → + Transaksi → Pemasukan → pilih pos (Infak DKM / Ambulans / Pembangunan / PHBI) → kategori "Saldo Awal". Satu transaksi per pos.
4. Input warga di **Iuran Warga → Data Warga** (bisa "Tambah Banyak").

## Hak akses
| Peran | Bisa |
|---|---|
| Ketua Bidang | Ajukan anggaran bidangnya, klik "Sudah Diterima" setelah dana sampai |
| Ketua Umum | Approve / tolak pengajuan (boleh kurangi nominal), kelola pengurus |
| Bendahara | Cairkan dana, terima setoran keropak & iuran, catat kas lain-lain |
| Petugas / Sekretaris | Setor keropak Jumat (+ saksi), catat iuran warga |
| Admin | Kelola pengurus & bidang |

## Alur
- **Pengajuan:** Ketua Bidang ajukan → Ketum approve → Bendahara cairkan (otomatis keluar kas) → Ketua Bidang konfirmasi terima
- **Keropak Jumat:** Petugas setor + saksi → Bendahara terima (otomatis masuk kas) / tolak untuk hitung ulang
- **Iuran warga:** Petugas catat → setor ke Bendahara → Bendahara klik terima (masuk kas). Dicatat Bendahara langsung masuk kas.

Transaksi kas tidak bisa dihapus/diedit. Kalau salah, buat transaksi koreksi kebalikannya.

## Pos dana
- Kas dibagi per pos: **Infak DKM** (pos utama), **Ambulans**, **Pembangunan**, **PHBI**. Tambah/ubah/urutkan di Buku Kas → **Atur** (Admin, Ketum, Bendahara).
- Keropak Jumat & iuran warga otomatis masuk pos utama. Transaksi manual & pencairan bidang: Bendahara pilih posnya.
- Pengeluaran ditolak kalau saldo pos tersebut tidak cukup.
- **Pindah** = pindah dana antar pos (misal Infak DKM → PHBI). Total kas tetap.

## Maklumat Jumat
1. Menu **Maklumat** → **+ Maklumat [tanggal]** (otomatis Jumat terdekat).
2. Isian disalin dari maklumat minggu lalu → tinggal ganti waktu & petugas.
3. Laporan keuangan **otomatis** dari Buku Kas per pos: Saldo lalu = saldo s/d Jumat sebelumnya, Masuk/Keluar = 7 hari terakhir, Total = saldo s/d Jumat ini.
4. **Unduh Gambar** (PNG 1080px) atau **Bagikan ke WA** (di HP langsung buka menu share). Keduanya otomatis menyimpan.
- Yang bisa membuat/ubah maklumat: **Admin, Ketum, dan pengurus yang dicentang** di Kelola → klik nama → "Boleh membuat & mengubah Maklumat Jumat". Pengurus lain hanya bisa melihat & mengunduh gambar. Hapus maklumat: Admin & Ketum.
- Kegiatan, nama masjid, rekening & token listrik bisa diubah di editor (bagian "Info tetap").

## Struktur kode
- `app/` — halaman Next.js (App Router)
- `components/` — tiap menu: `Beranda`, `Pengajuan`, `Keropak`, `Iuran`, `Kas`, `Maklumat`, `Kelola`, `Akun`, `Login`
- `lib/` — koneksi Supabase & fungsi bantu
- `supabase/migrations/` — database & aturan alur
