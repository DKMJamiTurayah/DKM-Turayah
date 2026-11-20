// Kalender Hijriyah (Umm al-Qura bawaan browser). Di Indonesia bisa selisih 1 hari
// dari penetapan Kemenag/NU, makanya ada "koreksi" (-2..+2 hari).
export const BULAN_H = [
  "Muharram",
  "Safar",
  "Rabiul Awal",
  "Rabiul Akhir",
  "Jumadil Awal",
  "Jumadil Akhir",
  "Rajab",
  "Sya'ban",
  "Ramadhan",
  "Syawal",
  "Dzulqa'dah",
  "Dzulhijjah",
];
export const HARI_PENDEK = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
export const BULAN_M = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];

const fmt = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura-nu-latn", {
  day: "numeric",
  month: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

const geser = (iso, n) => {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export function hijri(iso, koreksi = 0) {
  const p = {};
  fmt
    .formatToParts(new Date(geser(iso, koreksi) + "T00:00:00Z"))
    .forEach((x) => {
      p[x.type] = x.value;
    });
  return { d: +p.day, m: +p.month, y: parseInt(p.year, 10) };
}

export const tglHijriyah = (iso, koreksi = 0) => {
  const h = hijri(iso, koreksi);
  return `${h.d} ${BULAN_H[h.m - 1]} ${h.y} H`;
};

// seluruh hari dalam bulan Hijriyah yang memuat tanggal iso
export function bulanHijriyah(iso, koreksi = 0) {
  const h = hijri(iso, koreksi);
  let awal = iso;
  for (let i = 0; i < 31; i++) {
    const k = geser(awal, -1);
    if (hijri(k, koreksi).m !== h.m) break;
    awal = k;
  }
  const hari = [];
  for (let g = awal, i = 0; i < 31; i++, g = geser(g, 1)) {
    const x = hijri(g, koreksi);
    if (x.m !== h.m) break;
    hari.push({ g, h: x.d });
  }
  return {
    nama: BULAN_H[h.m - 1],
    tahun: h.y,
    hari,
    mulai: new Date(awal + "T00:00:00Z").getUTCDay(),
  };
}
