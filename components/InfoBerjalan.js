'use client';
import { useEffect, useState } from 'react';
import { rpc } from '@/lib/supabase';
import { rp, tglPanjang } from '@/lib/util';

// Tulisan berjalan di bagian atas (aplikasi pengurus & halaman jamaah).
// Berhenti saat disentuh / disorot mouse. Kalau HP disetel "kurangi animasi", teks tidak bergerak (bisa digeser).
const CSS = `.ib{background:var(--emas-muda);color:#5a4210;border-bottom:1px solid #ecdcb4;overflow:hidden;font-size:14px;line-height:1;white-space:nowrap}
.ib-jalan{display:inline-flex;padding:9px 0;animation:ib-gerak var(--ib-durasi,40s) linear infinite;will-change:transform}
.ib:hover .ib-jalan,.ib:active .ib-jalan,.ib:focus-within .ib-jalan{animation-play-state:paused}
.ib-item{display:inline-flex;align-items:center;gap:6px;padding:0 14px}
.ib-item+.ib-item:before{content:'✦';color:var(--emas);margin-right:14px}
.ib-arab{font-size:17px;font-weight:600;unicode-bidi:isolate;color:var(--hijau)}
@keyframes ib-gerak{from{transform:translateX(0)}to{transform:translateX(-50%)}}
@media (prefers-reduced-motion:reduce){.ib{overflow-x:auto}.ib-jalan{animation:none}.ib-salin{display:none}}`;

const adaArab = s => /[؀-ۿ]/.test(s);

export function susunInfo(d) {
  if (!d?.aktif) return [];
  const x = [];
  if (d.salam) x.push(d.salam);
  (d.pesan || []).forEach(t => x.push(t));
  if (d.jumat) {
    const p = [d.jumat.khatib && 'Khatib: ' + d.jumat.khatib, d.jumat.muadzin && 'Muadzin: ' + d.jumat.muadzin].filter(Boolean);
    if (p.length) x.push('Jumat, ' + tglPanjang(d.jumat.tanggal).replace(/^Jumat,?\s*/, '') + ' — ' + p.join(' · '));
  }
  if (d.saldo !== null && d.saldo !== undefined) x.push('Total saldo kas masjid saat ini: ' + rp(d.saldo));
  return x;
}

export function JalurInfo({ items }) {
  if (!items.length) return null;
  const panjang = items.join(' ').length;
  const isi = salin => items.map((t, i) => (
    <span className={'ib-item' + (salin ? ' ib-salin' : '')} key={(salin ? 's' : '') + i} aria-hidden={salin || undefined}>
      {adaArab(t) ? <span className="ib-arab" dir="rtl" lang="ar">{t}</span> : t}
    </span>));
  return <div className="ib" role="marquee" aria-label="Info masjid" tabIndex={0}>
    <style>{CSS}</style>
    {/* isi diulang 2x supaya putarannya menyambung tanpa jeda kosong */}
    <div className="ib-jalan" style={{ '--ib-durasi': Math.max(25, Math.round(panjang * 0.22)) + 's' }}>{isi(false)}{isi(true)}</div>
  </div>;
}

export default function InfoBerjalan({ muatUlang }) {
  const [items, setItems] = useState([]);
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return;
    let hidup = true;
    // kalau SQL 006 belum dijalankan, diam saja (tidak tampil)
    rpc('info_berjalan_publik').then(d => hidup && setItems(susunInfo(d)), () => {});
    return () => { hidup = false; };
  }, [muatUlang]);
  return <JalurInfo items={items} />;
}
