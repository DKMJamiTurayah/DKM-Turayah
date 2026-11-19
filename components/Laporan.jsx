'use client';
import { useState } from 'react';
import { sb, q } from '@/lib/supabase';
import { BULAN_P, NAMA_DKM, bulanIni, cetak, esc, hariIni, rp, unduhCSV } from '@/lib/util';
import { Chips, Loading, useApp, useLoad } from './ui';
import { muatPos } from './Kas';

export const IK_LAPORAN = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><rect x="5" y="11" width="3" height="7"/><rect x="10.5" y="6" width="3" height="12"/><rect x="16" y="13" width="3" height="5"/></svg>';

const HIJAU = '#1a8f5a', MERAH = '#d9534f', EMAS = '#c99a2e';
const PRINT = '-webkit-print-color-adjust:exact;print-color-adjust:exact';

// Pindah antar pos & saldo awal bukan pemasukan/pengeluaran sungguhan -> tidak dihitung di grafik arus kas
const bukanArus = r => /pindah|mutasi|antar pos|saldo awal/i.test(r.kategori || '');
const nilai = r => (r.jenis === 'masuk' ? 1 : -1) * +r.jumlah;

// Supabase membatasi 1000 baris per ambil -> ambil bertahap sampai habis
async function semua(buat) {
  const out = [], N = 1000;
  for (let i = 0; ; i += N) {
    const d = await q(buat().range(i, i + N - 1));
    out.push(...d);
    if (d.length < N) return out;
  }
}

async function muat(mode, p) {
  let awal, akhir, labels, idx, batas;
  if (mode === 'bulan') {
    const [t, b] = p.split('-').map(Number);
    awal = p + '-01';
    akhir = new Date(Date.UTC(t, b, 1)).toISOString().slice(0, 10);
    const hari = new Date(Date.UTC(t, b, 0)).getUTCDate();
    labels = [];
    for (let d = 1; d <= hari; d += 7) { const e = Math.min(d + 6, hari); labels.push(d === e ? String(d) : d + '–' + e); }
    idx = tg => Math.floor((+tg.slice(8, 10) - 1) / 7);
    batas = p === bulanIni() ? idx(hariIni()) : labels.length - 1;
  } else {
    awal = p + '-01-01';
    akhir = (p + 1) + '-01-01';
    labels = BULAN_P.map(x => x.slice(0, 3));
    idx = tg => +tg.slice(5, 7) - 1;
    const kini = bulanIni();
    batas = +kini.slice(0, 4) === p ? +kini.slice(5, 7) - 1 : 11;
  }

  const [pos, sebelum, rows, aju] = await Promise.all([
    muatPos(),
    semua(() => sb().from('kas').select('jenis,jumlah,pos_id').lt('tanggal', awal).order('id')),
    semua(() => sb().from('kas').select('id,tanggal,jenis,jumlah,pos_id,kategori').gte('tanggal', awal).lt('tanggal', akhir).order('id')),
    semua(() => sb().from('pengajuan').select('id,bidang_id,total_disetujui').in('status', ['dicairkan', 'diterima'])
      .gte('cair_at', awal).lt('cair_at', akhir).order('id'))
  ]);

  const n = labels.length, nol = () => Array(n).fill(0);
  const masuk = nol(), keluar = nol(), bersih = nol();
  const katM = {}, katK = {}, saldoPos = {};
  let saldoAwal = 0;
  sebelum.forEach(r => { saldoAwal += nilai(r); saldoPos[r.pos_id] = (saldoPos[r.pos_id] || 0) + nilai(r); });
  rows.forEach(r => {
    const i = idx(r.tanggal), v = +r.jumlah;
    bersih[i] += nilai(r);
    saldoPos[r.pos_id] = (saldoPos[r.pos_id] || 0) + nilai(r);
    if (bukanArus(r)) return;
    const kat = r.kategori || 'Lain-lain';
    if (r.jenis === 'masuk') { masuk[i] += v; katM[kat] = (katM[kat] || 0) + v; }
    else { keluar[i] += v; katK[kat] = (katK[kat] || 0) + v; }
  });
  let sal = saldoAwal;
  const saldo = bersih.map((b, i) => { sal += b; return i <= batas ? sal : null; });
  const perBidang = {};
  aju.forEach(x => { perBidang[x.bidang_id] = (perBidang[x.bidang_id] || 0) + +(x.total_disetujui || 0); });
  const jml = arr => arr.reduce((x, v) => x + v, 0);

  return {
    labels, masuk, keluar, saldo, katM, katK, perBidang, saldoAwal, saldoAkhir: sal,
    totM: jml(masuk), totK: jml(keluar),
    pos: pos.map(p => ({ nama: p.nama, total: saldoPos[p.id] || 0 })).filter(p => p.total !== 0)
  };
}

/* ---------- grafik (SVG string, dipakai di layar & cetak) ---------- */
const W = 640, H = 240, PL = 56, PR = 12, PT = 14, PB = 30;
const bulat = max => { if (max <= 0) return 1; const p = 10 ** Math.floor(Math.log10(max)), n = max / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p; };
const singkat = v => { const a = Math.abs(v), s = v < 0 ? '-' : ''; return a >= 1e9 ? s + +(a / 1e9).toFixed(1) + ' M' : a >= 1e6 ? s + +(a / 1e6).toFixed(1) + ' jt' : a >= 1e3 ? s + Math.round(a / 1e3) + ' rb' : s + a; };

function kanvas(min, max, labels, isi) {
  const y = v => PT + (H - PT - PB) * (max - v) / (max - min);
  const lw = (W - PL - PR) / labels.length;
  let g = '';
  for (let i = 0; i <= 4; i++) {
    const v = min + (max - min) * i / 4, yy = y(v);
    g += `<line x1="${PL}" x2="${W - PR}" y1="${yy}" y2="${yy}" stroke="${v === 0 ? '#999' : '#e5e5e5'}"/><text x="${PL - 6}" y="${yy + 4}" text-anchor="end" font-size="11" fill="#777">${singkat(v)}</text>`;
  }
  labels.forEach((l, i) => { g += `<text x="${PL + lw * i + lw / 2}" y="${H - 10}" text-anchor="middle" font-size="11" fill="#777">${esc(l)}</text>`; });
  g += isi(y, lw);
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="height:auto;display:block;font-family:sans-serif">${g}</svg>`;
}

const legenda = seri => `<div style="display:flex;gap:14px;font-size:12px;margin-top:4px;${PRINT}">${seri.map(s =>
  `<span><i style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${s.warna};margin-right:4px"></i>${esc(s.nama)}</span>`).join('')}</div>`;

function svgBatang(labels, seri) {
  const max = bulat(Math.max(1, ...seri.flatMap(s => s.data)));
  return kanvas(0, max, labels, (y, lw) => {
    const bw = Math.min(24, lw * 0.8 / seri.length);
    let g = '';
    labels.forEach((l, i) => {
      const x0 = PL + lw * i + (lw - bw * seri.length) / 2;
      seri.forEach((s, k) => {
        const v = s.data[i];
        if (v > 0) g += `<rect x="${x0 + k * bw}" y="${y(v)}" width="${bw - 2}" height="${y(0) - y(v)}" rx="2" fill="${s.warna}"><title>${esc(s.nama)} ${esc(l)}: ${rp(v)}</title></rect>`;
      });
    });
    return g;
  }) + legenda(seri);
}

function svgGaris(labels, data, warna) {
  const ada = data.filter(v => v !== null);
  if (!ada.length) return '<div style="color:#888;font-size:13px">Belum ada data</div>';
  const mx = bulat(Math.max(1, ...ada)), mnRaw = Math.min(0, ...ada), mn = mnRaw < 0 ? -bulat(-mnRaw) : 0;
  return kanvas(mn, mx, labels, (y, lw) => {
    const t = data.map((v, i) => v === null ? null : [PL + lw * i + lw / 2, y(v), v, labels[i]]).filter(Boolean);
    const garis = t.map((p, i) => (i ? 'L' : 'M') + p[0] + ' ' + p[1]).join(' ');
    const area = `${garis} L${t[t.length - 1][0]} ${y(Math.max(mn, 0))} L${t[0][0]} ${y(Math.max(mn, 0))} Z`;
    return `<path d="${area}" fill="${warna}" opacity="0.12"/><path d="${garis}" fill="none" stroke="${warna}" stroke-width="2.5"/>` +
      t.map(p => `<circle cx="${p[0]}" cy="${p[1]}" r="3.5" fill="${warna}"><title>Saldo ${esc(p[3])}: ${rp(p[2])}</title></circle>`).join('');
  });
}

function htmlDaftar(obj, warna, nama = k => k) {
  const e = Object.entries(obj).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]);
  if (!e.length) return '<div style="color:#888;font-size:13px">Tidak ada data</div>';
  const mx = e[0][1], tot = e.reduce((x, v) => x + v[1], 0);
  return e.map(([k, v]) => `<div style="margin:7px 0;${PRINT}"><div style="display:flex;gap:8px;font-size:13px"><span style="flex:1">${esc(nama(k))}</span><b>${rp(v)}</b><span style="width:38px;text-align:right;color:#888">${Math.round(v / tot * 100)}%</span></div>
    <div style="background:#eee;border-radius:4px;height:8px;margin-top:3px"><div style="width:${(v / mx * 100).toFixed(1)}%;background:${warna};height:8px;border-radius:4px"></div></div></div>`).join('');
}

/* ---------- halaman ---------- */
export default function Laporan() {
  const a = useApp();
  const mode = a.sub.laporan || 'bulan';
  const [bln, setBln] = useState(bulanIni());
  const [thn, setThn] = useState(+bulanIni().slice(0, 4));
  const [th, bl] = bln.split('-').map(Number);
  const s = useLoad(() => muat(mode, mode === 'bulan' ? bln : thn), [mode, bln, thn, a.refreshKey]);

  const geser = d => {
    if (mode === 'tahun') return setThn(thn + d);
    let t = th, b = bl + d; if (b < 1) { b = 12; t--; } if (b > 12) { b = 1; t++; }
    setBln(t + '-' + String(b).padStart(2, '0'));
  };
  const judul = mode === 'bulan' ? BULAN_P[bl - 1] + ' ' + th : 'Tahun ' + thn;

  return <>
    <h2>Laporan Keuangan</h2>
    <Chips items={[['bulan', 'Bulanan'], ['tahun', 'Tahunan']]} value={mode} onChange={k => a.setSub('laporan', k)} />
    <div className="kartu baris-flex"><button className="btn sek kecil" onClick={() => geser(-1)}>‹</button>
      <b className="spasi" style={{ textAlign: 'center' }}>{judul}</b><button className="btn sek kecil" onClick={() => geser(1)}>›</button></div>
    {!s.data ? <Loading s={s} /> : <Isi d={s.data} judul={judul} mode={mode} />}
  </>;
}

function Isi({ d, judul, mode }) {
  const a = useApp();
  const unit = mode === 'bulan' ? 'Pekan (tanggal)' : 'Bulan';
  const g = {
    arus: svgBatang(d.labels, [{ nama: 'Pemasukan', warna: HIJAU, data: d.masuk }, { nama: 'Pengeluaran', warna: MERAH, data: d.keluar }]),
    saldo: svgGaris(d.labels, d.saldo, EMAS),
    katM: htmlDaftar(d.katM, HIJAU),
    katK: htmlDaftar(d.katK, MERAH),
    bidang: htmlDaftar(d.perBidang, EMAS, id => a.bn(+id))
  };
  const H = ({ html }) => <div dangerouslySetInnerHTML={{ __html: html }} />;
  const selisih = d.totM - d.totK;

  const csv = () => unduhCSV(`laporan-${mode === 'bulan' ? 'bulanan' : 'tahunan'}-${judul.replace(/\s+/g, '-')}.csv`, [
    [unit, 'Pemasukan', 'Pengeluaran', 'Saldo akhir'],
    ...d.labels.map((l, i) => [l, d.masuk[i], d.keluar[i], d.saldo[i] ?? '']),
    ['Total', d.totM, d.totK, d.saldoAkhir]
  ]);

  const print = () => {
    const kotak = (j, isi) => `<div style="border:1px solid #ddd;border-radius:6px;padding:8px 10px;margin:8px 0;page-break-inside:avoid"><b>${j}</b>${isi}</div>`;
    const ok = cetak('Laporan ' + judul, `<h2>LAPORAN KEUANGAN ${mode === 'bulan' ? 'BULANAN' : 'TAHUNAN'}</h2><div class="sub">${esc(NAMA_DKM)} — ${esc(judul)}</div>
      <table class="data"><tr><td>Saldo awal</td><td class="r">${rp(d.saldoAwal)}</td></tr><tr><td>Total pemasukan</td><td class="r">${rp(d.totM)}</td></tr>
      <tr><td>Total pengeluaran</td><td class="r">${rp(d.totK)}</td></tr><tr><th>Saldo akhir</th><th class="r">${rp(d.saldoAkhir)}</th></tr></table>
      ${kotak('Pemasukan vs Pengeluaran per ' + unit.toLowerCase(), g.arus)}
      ${kotak('Perkembangan saldo', g.saldo)}
      <table style="width:100%"><tr><td style="width:50%;vertical-align:top;padding-right:6px">${kotak('Sumber pemasukan', g.katM)}</td>
      <td style="vertical-align:top;padding-left:6px">${kotak('Jenis pengeluaran', g.katK)}</td></tr></table>
      ${kotak('Dana dicairkan per bidang', g.bidang)}
      <table class="data"><tr><th>Pos dana</th><th>Saldo akhir</th></tr>${d.pos.map(p => `<tr><td>${esc(p.nama)}</td><td class="r">${rp(p.total)}</td></tr>`).join('')}</table>
      <table class="ttdt"><tr><td style="width:50%">Mengetahui,<br>Ketua Umum<div class="ttd"></div><b>..................</b></td><td style="width:50%">Dibuat oleh,<br>Bendahara<div class="ttd"></div><b>..................</b></td></tr></table>`);
    if (!ok) a.toast('Izinkan pop-up untuk mencetak', true);
  };

  return <>
    <div className="ringkas">
      <div className="kartu"><span className="kecil">Saldo awal</span><b>{rp(d.saldoAwal)}</b></div>
      <div className="kartu"><span className="kecil">Saldo akhir</span><b>{rp(d.saldoAkhir)}</b></div>
      <div className="kartu"><span className="kecil">Pemasukan</span><b className="masuk">{rp(d.totM)}</b></div>
      <div className="kartu"><span className="kecil">Pengeluaran</span><b className="keluar">{rp(d.totK)}</b></div>
    </div>
    <div className="kartu kecil" style={{ textAlign: 'center' }}>{selisih >= 0 ? 'Surplus' : 'Defisit'} periode ini: <b className={selisih >= 0 ? 'masuk' : 'keluar'}>{rp(Math.abs(selisih))}</b></div>
    <div className="aksi" style={{ marginTop: 0, marginBottom: 10 }}>
      <button className="btn sek" onClick={csv}>Unduh Excel</button><button className="btn sek" onClick={print}>Cetak / PDF</button></div>

    <div className="kartu"><b>Pemasukan vs Pengeluaran</b><div className="kecil">per {unit.toLowerCase()}</div><H html={g.arus} /></div>
    <div className="kartu"><b>Perkembangan Saldo</b><div className="kecil">saldo kas di akhir tiap {mode === 'bulan' ? 'pekan' : 'bulan'}</div><H html={g.saldo} /></div>
    <div className="kartu"><b>Sumber Pemasukan</b><H html={g.katM} /></div>
    <div className="kartu"><b>Jenis Pengeluaran</b><H html={g.katK} /></div>
    <div className="kartu"><b>Dana Dicairkan per Bidang</b><div className="kecil">dari pengajuan anggaran yang sudah dicairkan</div><H html={g.bidang} /></div>
    <div className="kartu"><b>Saldo per Pos Dana</b><div className="kecil">di akhir periode</div>
      <table className="t" style={{ marginTop: 6 }}><tbody>{d.pos.map(p => <tr key={p.nama}><td>{p.nama}</td><td className="r tebal">{rp(p.total)}</td></tr>)}</tbody></table></div>
    <p className="kecil">Pindah dana antar pos dan &quot;Saldo Awal&quot; tidak dihitung sebagai pemasukan/pengeluaran di grafik, tapi tetap masuk ke saldo.</p>
  </>;
}
