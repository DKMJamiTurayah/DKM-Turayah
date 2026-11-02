export const NAMA_DKM = process.env.NEXT_PUBLIC_NAMA_DKM || 'DKM Masjid Jami Turayah';
export const EMAIL_DOMAIN = process.env.NEXT_PUBLIC_EMAIL_DOMAIN || 'dkmturayah.id';

export const ROLE = {
  pending: 'Menunggu aktivasi', admin: 'Admin', ketum: 'Ketua Umum', bendahara: 'Bendahara',
  sekretaris: 'Sekretaris', ketua_bidang: 'Ketua Bidang', petugas: 'Petugas Keropak/Iuran'
};
export const ST_AJU = {
  diajukan: ['Menunggu Ketum', 'b-kuning'], disetujui: ['Disetujui · tunggu pencairan', 'b-biru'],
  dicairkan: ['Dicairkan · tunggu konfirmasi', 'b-ungu'], diterima: ['Selesai · diterima', 'b-hijau'],
  ditolak: ['Ditolak', 'b-merah'], dibatalkan: ['Dibatalkan', 'b-abu']
};
export const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
export const BULAN_P = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

export const esc = s => (s ?? '').toString().replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const rp = n => 'Rp ' + Number(n || 0).toLocaleString('id-ID');
export const tgl = d => d ? new Date(d.length === 10 ? d + 'T00:00:00' : d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
export const jam = d => d ? new Date(d).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';
export const hariIni = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
export const bulanIni = () => hariIni().slice(0, 7);
export const angka = v => Number(String(v ?? '').replace(/[^\d]/g, '')) || 0;
export const pendek = n => (n || '').split(' (')[0];
export const periode = (th, i) => th + '-' + String(i + 1).padStart(2, '0');
export const keEmail = u => u.includes('@') ? u.trim().toLowerCase() : u.trim().toLowerCase().replace(/\s+/g, '') + '@' + EMAIL_DOMAIN;

export function jumatTerakhir() {
  const d = new Date(hariIni() + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() - 5 + 7) % 7));
  return d.toISOString().slice(0, 10);
}

// Jumat terdekat ke depan (hari ini kalau hari ini Jumat)
export function jumatDepan() {
  const d = new Date(hariIni() + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + ((5 - d.getUTCDay() + 7) % 7));
  return d.toISOString().slice(0, 10);
}

export const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
export function tglPanjang(s) {
  if (!s) return '-';
  const d = new Date(s + 'T00:00:00Z');
  return `${HARI[d.getUTCDay()]}, ${d.getUTCDate()} ${BULAN_P[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function pesanError(e) {
  const m = e?.message || String(e);
  if (/duplicate key|keropak_satu_per_tanggal/.test(m)) return 'Data sudah ada (dobel)';
  if (/Invalid login/.test(m)) return 'Username atau password salah';
  if (/already registered/.test(m)) return 'Username sudah dipakai';
  if (/Password should be/.test(m)) return 'Password minimal 6 karakter';
  return m;
}

export function unduhCSV(nama, rows) {
  const csv = '﻿' + rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = nama; a.click();
}

export function cetak(judul, isi) {
  const w = window.open('', '_blank');
  if (!w) return false;
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(judul)}</title><style>
    body{font:12px/1.4 Arial,sans-serif;margin:18mm 14mm;color:#000} h2{text-align:center;margin:0;font-size:16px} .sub{text-align:center;margin-bottom:14px}
    table{width:100%;border-collapse:collapse;margin:8px 0} .data th,.data td{border:1px solid #000;padding:4px 6px} .data th{background:#eee}
    .info td{padding:2px 4px} .r{text-align:right} .ttdt td{text-align:center;width:25%;vertical-align:top;padding-top:16px}
    .ttd{height:46px;font-size:10px;color:#0a6;display:flex;align-items:center;justify-content:center}
    @media print{button{display:none}}</style></head><body>${isi}
    <p style="font-size:10px;color:#666;margin-top:20px">Dicetak ${jam(new Date())} dari sistem ${esc(NAMA_DKM)}</p>
    <button onclick="print()" style="padding:8px 16px">Cetak</button></body></html>`);
  w.document.close();
  return true;
}
