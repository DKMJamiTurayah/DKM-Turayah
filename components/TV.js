'use client';
import { useEffect, useRef, useState } from 'react';
import { rpc } from '@/lib/supabase';
import { NAMA_DKM, hariIni, tglPanjang } from '@/lib/util';
import { hitungJadwal, tambahHari, LOKASI, WAJIB } from '@/lib/jadwal';
import { tglHijriyah } from '@/lib/hijriyah';
import { LogoMasjid } from './ui';
import { JalurInfo, susunInfo } from './InfoBerjalan';

// Halaman /tv untuk layar masjid. Tidak menampilkan data kas.
// Koreksi tanggal Hijriyah: /tv?koreksi=-1 (mundur 1 hari), -2, atau 1.
const NAMA = { subuh: 'Subuh', dzuhur: 'Dzuhur', ashar: 'Ashar', maghrib: 'Maghrib', isya: 'Isya' };
const menitWIB = () => ((Date.now() / 60000 + 7 * 60) % 1440);
const jamWIB = () => {
  const d = new Date(Date.now() + 7 * 3600e3);
  const p = n => String(n).padStart(2, '0');
  return [p(d.getUTCHours()), p(d.getUTCMinutes()), p(d.getUTCSeconds())];
};
const sisa = m => {
  m = Math.max(0, Math.ceil(m));
  const j = Math.floor(m / 60);
  return (j ? j + ' jam ' : '') + (m % 60) + ' menit';
};

const CSS = `.tv{position:fixed;inset:0;display:flex;flex-direction:column;background:linear-gradient(160deg,#0a3f30,#0f5e47 55%,#13775a);color:#fff;cursor:none;overflow:hidden;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
.tv-atas{display:flex;align-items:center;gap:2.2vmin;padding:2.6vmin 4vmin 0}
.tv-atas b{font-size:3.6vmin;display:block;line-height:1.15}.tv-atas span{font-size:2.3vmin;opacity:.85}
.tv-tengah{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1.4vmin;text-align:center;min-height:0}
.tv-jam{font-size:21vmin;font-weight:800;letter-spacing:.02em;line-height:1;font-variant-numeric:tabular-nums}
.tv-jam small{font-size:.38em;opacity:.7;margin-left:.15em}
.tv-tgl{font-size:4vmin;font-weight:600}.tv-hij{font-size:3.3vmin;color:#f1d58a}
.tv-next{font-size:3.4vmin;margin-top:1vmin;background:rgba(255,255,255,.12);padding:1.2vmin 3vmin;border-radius:99px}
.tv-shalat{display:grid;grid-template-columns:repeat(5,1fr);gap:1.6vmin;padding:0 4vmin 2.4vmin}
.tv-shalat div{background:rgba(255,255,255,.1);border-radius:2vmin;padding:2vmin 0;text-align:center;font-size:3vmin}
.tv-shalat div b{display:block;font-size:6.6vmin;margin-top:.4vmin;font-variant-numeric:tabular-nums}
.tv-shalat div.on{background:#fff;color:#0f5e47}
.tv .ib{font-size:4.4vmin;padding:1vmin 0}.tv .ib-arab{font-size:5.2vmin}
.tv .ib-jalan{padding:1.4vmin 0;animation-duration:calc(var(--ib-durasi,40s) * 1.8)!important}
.tv .ib-item{padding:0 3vmin}.tv .ib-item+.ib-item:before{margin-right:3vmin}`;

export default function TV() {
  const [, tik] = useState(0);
  const [items, setItems] = useState([]);
  const terakhir = useRef('');
  const [koreksi, setKoreksi] = useState(0);

  // jam berdetak tiap detik
  useEffect(() => { const iv = setInterval(() => tik(x => x + 1), 1000); return () => clearInterval(iv); }, []);

  // koreksi Hijriyah dari alamat (?koreksi=-1)
  useEffect(() => {
    const k = +new URLSearchParams(window.location.search).get('koreksi');
    if (k) setKoreksi(Math.max(-2, Math.min(2, k)));
  }, []);

  // teks berjalan dari Kelola -> Info Berjalan; tanpa saldo kas. Diambil ulang tiap 2 menit.
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return;
    let hidup = true;
    const muat = () => rpc('info_berjalan_publik').then(d => {
      if (!hidup) return;
      const baru = susunInfo(d && { ...d, saldo: null });
      const kunci = JSON.stringify(baru);
      if (kunci !== terakhir.current) { terakhir.current = kunci; setItems(baru); }
    }, () => {});
    muat();
    const iv = setInterval(muat, 120000);
    return () => { hidup = false; clearInterval(iv); };
  }, []);

  // layar TV tidak mati sendiri (kalau browser mendukung)
  useEffect(() => {
    let kunci = null, hidup = true;
    const minta = async () => { try { kunci = await navigator.wakeLock?.request('screen'); } catch {} };
    minta();
    const lagi = () => { if (hidup && document.visibilityState === 'visible') minta(); };
    document.addEventListener('visibilitychange', lagi);
    return () => { hidup = false; document.removeEventListener('visibilitychange', lagi); try { kunci?.release(); } catch {} };
  }, []);

  const hi = hariIni(), j = hitungJadwal(hi), now = menitWIB();
  const besok = hitungJadwal(tambahHari(hi, 1));
  let nx = WAJIB.find(k => j._menit[k] > now);
  const nxJam = nx ? j[nx] : besok.subuh;
  const nxLagi = nx ? j._menit[nx] - now : besok._menit.subuh + 1440 - now;
  if (!nx) nx = 'subuh';
  const [hh, mm, ss] = jamWIB();

  const layarPenuh = () => { try { document.documentElement.requestFullscreen?.(); } catch {} };

  return <div className="tv" onClick={layarPenuh}>
    <style>{CSS}</style>
    <div className="tv-atas"><LogoMasjid size={72} /><div><b>{NAMA_DKM}</b><span>{LOKASI.nama}</span></div></div>
    <div className="tv-tengah">
      <div className="tv-jam">{hh}:{mm}<small>{ss}</small></div>
      <div className="tv-tgl">{tglPanjang(hi)}</div>
      <div className="tv-hij">{tglHijriyah(hi, koreksi)}</div>
      <div className="tv-next">{NAMA[nx]} {nxJam} · {sisa(nxLagi)} lagi</div>
    </div>
    <div className="tv-shalat">
      {WAJIB.map(k => <div key={k} className={nx === k ? 'on' : ''}>{NAMA[k]}<b>{j[k]}</b></div>)}
    </div>
    <JalurInfo items={items} />
  </div>;
}
