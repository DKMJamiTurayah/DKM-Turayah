// Hitung jadwal shalat — metode Kemenag RI (Subuh 20°, Isya 18°, Ashar Syafi'i), disesuaikan dengan NU Online
// (Maghrib & Isya tetap pakai ihtiyat 2 menit). Tidak butuh internet / API, dihitung langsung di HP.

// Lokasi Masjid Jami Turayah (Villa Athaland, Sindangmulya, Cibarusah). Ganti kalau mau lebih presisi.
export const LOKASI = { nama: 'Villa Athaland, Sindangmulya', lat: -6.4196, lon: 107.0752, tz: 7, tinggi: 50 };

// 1 Ramadhan per tahun Masehi. Sesuaikan setelah sidang isbat Kemenag.
// Kalau tahunnya belum ada di sini, otomatis pakai kalender Ummul Qura.
export const AWAL_RAMADHAN = { 2027: '2027-02-08' };
export const LAMA_RAMADHAN = { 2027: 30 };

export const WAKTU = [
  ['imsak', 'Imsak'], ['subuh', 'Subuh'], ['terbit', 'Terbit'], ['dhuha', 'Dhuha'],
  ['dzuhur', 'Dzuhur'], ['ashar', 'Ashar'], ['maghrib', 'Maghrib'], ['isya', 'Isya']
];
export const WAJIB = ['subuh', 'dzuhur', 'ashar', 'maghrib', 'isya'];

const rad = d => d * Math.PI / 180, deg = r => r * 180 / Math.PI;
const sin = d => Math.sin(rad(d)), cos = d => Math.cos(rad(d)), tan = d => Math.tan(rad(d));
const acos = x => deg(Math.acos(Math.max(-1, Math.min(1, x))));
const atan2 = (y, x) => deg(Math.atan2(y, x)), asin = x => deg(Math.asin(x));
// sudut ufuk terbit/terbenam: refraksi + semidiameter + kerendahan ufuk dari ketinggian tempat
const UFUK = lok => 0.833 + 0.0347 * Math.sqrt(lok.tinggi || 0);
const fix = (a, b) => { a = a - b * Math.floor(a / b); return a < 0 ? a + b : a; };

function posisiMatahari(jd) {
  const D = jd - 2451545.0;
  const g = fix(357.529 + 0.98560028 * D, 360), q = fix(280.459 + 0.98564736 * D, 360);
  const L = fix(q + 1.915 * sin(g) + 0.020 * sin(2 * g), 360);
  const e = 23.439 - 0.00000036 * D;
  const RA = fix(atan2(cos(e) * sin(L), cos(L)) / 15, 24);
  return { dekl: asin(sin(e) * sin(L)), eqt: q / 15 - RA };
}

// tanggal 'YYYY-MM-DD' -> { imsak: 'HH:MM', ... , _menit: {imsak: menit-dari-00:00, ...} }
export function hitungJadwal(tanggal, lok = LOKASI) {
  const [y, m, d] = tanggal.split('-').map(Number);
  let Y = y, M = m; if (M <= 2) { Y--; M += 12; }
  const A = Math.floor(Y / 100), B = 2 - A + Math.floor(A / 4);
  const jd0 = Math.floor(365.25 * (Y + 4716)) + Math.floor(30.6001 * (M + 1)) + d + B - 1524.5 - lok.lon / 360;

  const zuhurPada = t => 12 - posisiMatahari(jd0 + t / 24).eqt;
  const sudutWaktu = (sudut, t) => {
    const { dekl } = posisiMatahari(jd0 + t / 24);
    return acos((-sin(sudut) - sin(dekl) * sin(lok.lat)) / (cos(dekl) * cos(lok.lat))) / 15;
  };
  const ashar = t => {
    const { dekl } = posisiMatahari(jd0 + t / 24);
    const alt = -deg(Math.atan(1 / (1 + tan(Math.abs(lok.lat - dekl)))));
    return zuhurPada(t) + sudutWaktu(alt, t);
  };

  // 2x iterasi biar posisi matahari dihitung tepat di jam masing-masing
  let t = { subuh: 5, terbit: 6, dzuhur: 12, ashar: 15, maghrib: 18, isya: 19 };
  for (let i = 0; i < 2; i++) {
    t = {
      subuh: zuhurPada(t.subuh) - sudutWaktu(20, t.subuh),
      terbit: zuhurPada(t.terbit) - sudutWaktu(UFUK(lok), t.terbit),
      dzuhur: zuhurPada(t.dzuhur),
      ashar: ashar(t.ashar),
      maghrib: zuhurPada(t.maghrib) + sudutWaktu(UFUK(lok), t.maghrib),
      isya: zuhurPada(t.isya) + sudutWaktu(18, t.isya)
    };
  }
  const geser = lok.tz - lok.lon / 15;
  const mnt = {};
  for (const k in t) mnt[k] = (t[k] + geser) * 60;
  // ihtiyat (kehati-hatian): disamakan dengan NU Online. Maghrib & Isya tetap +2 menit.
  mnt.dzuhur += 1; mnt.maghrib += 2; mnt.isya += 2;
  // bulatkan ke atas (lebih aman utk buka puasa), terbit ke bawah (lebih aman utk batas Subuh)
  for (const k in mnt) mnt[k] = k === 'terbit' ? Math.floor(mnt[k]) : Math.ceil(mnt[k]);
  mnt.imsak = mnt.subuh - 10;
  mnt.dhuha = mnt.terbit + 25;

  const out = { _menit: mnt };
  for (const [k] of WAKTU) out[k] = fmt(mnt[k]);
  return out;
}

export const fmt = m => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(Math.round(m % 60)).padStart(2, '0');

const tambahHari = (tgl, n) => { const d = new Date(tgl + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

// cari 1 Ramadhan untuk tahun Masehi tertentu (pakai tabel di atas, cadangan: Ummul Qura)
export function awalRamadhan(tahun) {
  if (AWAL_RAMADHAN[tahun]) return AWAL_RAMADHAN[tahun];
  try {
    const f = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { month: 'numeric', day: 'numeric', timeZone: 'UTC' });
    for (let i = 0; i < 366; i++) {
      const tgl = tambahHari(tahun + '-01-01', i);
      const p = Object.fromEntries(f.formatToParts(new Date(tgl + 'T12:00:00Z')).map(x => [x.type, x.value]));
      if (p.month === '9' && p.day === '1') return tgl;
    }
  } catch {}
  return null;
}

// daftar hari Ramadhan: [{ tanggal, ke, ...jadwal }]
export function jadwalRamadhan(tahun) {
  const awal = awalRamadhan(tahun);
  if (!awal) return [];
  const n = LAMA_RAMADHAN[tahun] || 30;
  return Array.from({ length: n }, (_, i) => { const tanggal = tambahHari(awal, i); return { tanggal, ke: i + 1, ...hitungJadwal(tanggal) }; });
}

// Ramadhan yang paling dekat: tahun ini kalau belum lewat, kalau sudah lewat tahun depan
export function ramadhanTerdekat(hariIni) {
  const th = +hariIni.slice(0, 4);
  const ini = jadwalRamadhan(th);
  if (ini.length && ini[ini.length - 1].tanggal >= hariIni) return { tahun: th, hari: ini };
  return { tahun: th + 1, hari: jadwalRamadhan(th + 1) };
}

export { tambahHari };
