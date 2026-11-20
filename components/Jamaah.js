'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import { rpc } from '@/lib/supabase';
import { BULAN_P, NAMA_DKM, hariIni, pesanError, rp, tglPanjang } from '@/lib/util';
import { hitungJadwal, tambahHari, LOKASI, WAJIB } from '@/lib/jadwal';
import { AppCtx, Btn, Loading, LogoMasjid, useApp } from './ui';
import { Poster, Skala } from './Maklumat';
import { hariTakjil } from './Takjil';
import InfoBerjalan from './InfoBerjalan';

const NAMA = { imsak: 'Imsak', subuh: 'Subuh', dzuhur: 'Dzuhur', ashar: 'Ashar', maghrib: 'Maghrib', isya: 'Isya' };
const menitWIB = () => (Date.now() / 60000 + 7 * 60) % 1440;
const kg = n => (+n || 0).toLocaleString('id-ID', { maximumFractionDigits: 2 }) + ' kg';
const sisa = m => { m = Math.max(0, Math.ceil(m)); const j = Math.floor(m / 60); return (j ? j + ' jam ' : '') + (m % 60) + ' menit'; };
const selisih = (a, b) => Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 864e5);

const CSS = `.jm-head{background:var(--hijau);color:#fff;padding:18px 16px;display:flex;gap:12px;align-items:center}
.jm-head b{font-size:18px;display:block}.jm-head span{font-size:13px;opacity:.9}
.jm-wrap{max-width:640px;margin:0 auto;padding:12px 12px 40px}
.jm-shalat{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin-top:10px;text-align:center}
.jm-shalat div{background:var(--hijau-muda);border-radius:10px;padding:7px 2px;font-size:12px;color:var(--hijau)}
.jm-shalat div b{display:block;font-size:15px;color:#1b2b26}.jm-shalat div.on{background:var(--hijau);color:#fff}.jm-shalat div.on b{color:#fff}
.jm-pos{display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--garis);font-size:14px}.jm-pos:last-child{border:0}
.jm-req{display:flex;gap:14px;align-items:flex-start}.jm-req-ic{flex:none;width:48px;height:48px;border-radius:14px;background:var(--hijau-muda);display:flex;align-items:center;justify-content:center;color:var(--hijau)}
.jm-req b{font-size:17px;display:block}.jm-req-wa{display:flex;align-items:center;justify-content:center;gap:8px;margin-top:14px;padding:13px 14px;border-radius:14px;background:var(--hijau);color:#fff;font-weight:700;text-decoration:none;box-shadow:0 4px 10px rgba(0,0,0,.12)}`;
const WA_ADMIN = '6282113609810'; // +62 821-1360-9810
const PESAN_ADMIN = 'Assalamualaikum Admin ' + NAMA_DKM + ', saya ingin mengajukan request:\n\n';

export default function Jamaah() {
  const [toastS, setToastS] = useState(null);
  const timer = useRef();
  const toast = useCallback((msg, err) => {
    setToastS({ msg, err }); clearTimeout(timer.current);
    timer.current = setTimeout(() => setToastS(null), err ? 5000 : 2500);
  }, []);
  return <AppCtx.Provider value={{ toast }}>
    <style>{CSS}</style>
    <Isi />
    <div id="toast" className={toastS ? 'on' + (toastS.err ? ' err' : '') : ''}>{toastS?.msg}</div>
  </AppCtx.Provider>;
}

function Isi() {
  const { tahun, hari } = hariTakjil();
  const [s, setS] = useState({ loading: true });
  const [, tik] = useState(0);
  useEffect(() => { const iv = setInterval(() => tik(x => x + 1), 30000); return () => clearInterval(iv); }, []);
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return setS({ err: 'Belum dikonfigurasi' });
    rpc('jamaah_publik', { p_tahun_hijri: tahun || 0 }).then(d => setS({ data: d }), e => setS({ err: pesanError(e) }));
  }, [tahun]);

  const hi = hariIni(), j = hitungJadwal(hi), now = menitWIB();
  let nx = ['imsak', ...WAJIB].find(k => j._menit[k] > now);
  const nxJam = nx ? j[nx] : hitungJadwal(tambahHari(hi, 1)).subuh;
  const nxLagi = nx ? j._menit[nx] - now : hitungJadwal(tambahHari(hi, 1))._menit.subuh + 1440 - now;
  if (!nx) nx = 'subuh';
  const ram = hari.find(h => h.tanggal === hi);
  const malamIni = hari.find(h => tambahHari(h.tanggal, -1) === hi);
  const lagiHari = hari.length ? selisih(hi, hari[0].tanggal) : 999;
  const bulan = BULAN_P[+hi.slice(5, 7) - 1];

  return <>
    <div className="jm-head"><LogoMasjid size={44} /><div><b>{NAMA_DKM}</b><span>{LOKASI.nama}</span></div></div>
    <InfoBerjalan />
    <div className="jm-wrap">
      <div className="kartu saldo">
        <div className="lbl">{tglPanjang(hi)}</div>
        <div className="angka">{nxJam} <small style={{ fontSize: 15, fontWeight: 600 }}>{NAMA[nx]}</small></div>
        <div className="kecil" style={{ color: '#d7ece4' }}>{sisa(nxLagi)} lagi</div>
        {ram && <div className="jd-ram">Ramadhan hari ke-{ram.ke} · Buka puasa <b>{j.maghrib}</b> · Imsak <b>{j.imsak}</b></div>}
        {!ram && lagiHari > 0 && lagiHari <= 60 && <div className="jd-ram">Ramadhan {tahun} H · {lagiHari} hari lagi</div>}
      </div>
      <div className="jm-shalat">{WAJIB.map(k => <div key={k} className={nx === k && j._menit[k] > now ? 'on' : ''}>{NAMA[k]}<b>{j[k]}</b></div>)}</div>

      {lagiHari <= 45 && hari.length && hi <= hari[hari.length - 1].tanggal ? <div className="kartu" style={{ marginTop: 12 }}>
        <b>Berbagi takjil buka puasa</b>
        <div className="kecil">Pilih tanggal yang masih kosong, tanpa perlu login.</div>
        <div className="aksi"><a className="btn" href="/takjil">Daftar Takjil</a></div>
      </div> : null}

      {!s.data ? <div style={{ marginTop: 12 }}><Loading s={s} /></div> : <Data d={s.data} tahun={tahun} malamIni={malamIni} bulan={bulan} />}
      <div className="kartu" style={{ marginTop: 16 }}>
        <div className="jm-req">
          <div className="jm-req-ic"><svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4 4h11a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H9l-4 3v-3H4a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3z" opacity=".85"/><path d="M20 9a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3v2l-3.5-2H11a3 3 0 0 1-2.6-1.5H15a4 4 0 0 0 4-4V9z"/></svg></div>
          <div><b>Request to Admin</b><div className="kecil">Punya masukan atau permintaan untuk pengelolaan kas atau kegiatan masjid? Sampaikan langsung ke Admin melalui WhatsApp.</div></div>
        </div>
        <a className="jm-req-wa" href={'https://wa.me/' + WA_ADMIN + '?text=' + encodeURIComponent(PESAN_ADMIN)} target="_blank" rel="noreferrer">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12.04 2a9.9 9.9 0 0 0-8.5 14.9L2 22l5.25-1.5A9.9 9.9 0 1 0 12.04 2zm0 18.1a8.2 8.2 0 0 1-4.2-1.15l-.3-.18-3.1.89.9-3.02-.2-.31a8.2 8.2 0 1 1 6.9 3.77zm4.5-6.15c-.25-.12-1.46-.72-1.69-.8-.22-.08-.39-.12-.55.12-.16.25-.63.8-.78.96-.14.17-.29.18-.53.06a6.7 6.7 0 0 1-3.3-2.88c-.25-.43.25-.4.72-1.33.08-.16.04-.3-.02-.42-.06-.12-.55-1.33-.76-1.82-.2-.48-.4-.41-.55-.42h-.47c-.16 0-.43.06-.65.3-.22.25-.86.84-.86 2.05s.88 2.38 1 2.55c.12.16 1.73 2.64 4.2 3.7 1.55.67 2.16.73 2.94.61.47-.07 1.46-.6 1.66-1.17.2-.58.2-1.07.14-1.18-.06-.1-.22-.16-.47-.28z"/></svg>
          Request to Admin
        </a>
      </div>
      <p className="kecil" style={{ textAlign: 'center', marginTop: 20 }}>Jadwal shalat metode Kemenag RI · Data keuangan dari sistem {NAMA_DKM}</p>
    </div>
  </>;
}

function Data({ d, tahun, malamIni, bulan }) {
  const a = useApp();
  const poster = useRef();
  const total = d.saldo.reduce((x, p) => x + +p.saldo, 0);
  const z = d.zakat, tw = malamIni && d.tarawih.find(t => t.malam === malamIni.ke);

  const gambar = async () => {
    await document.fonts?.ready;
    const opsi = { pixelRatio: 1, cacheBust: true, backgroundColor: '#f6eedf' };
    await toPng(poster.current, opsi);
    return { url: await toPng(poster.current, opsi), nama: `maklumat-jumat-${d.maklumat.tanggal}.png` };
  };
  const unduh = async () => { const { url, nama } = await gambar(); const el = document.createElement('a'); el.href = url; el.download = nama; el.click(); a.toast('Gambar diunduh'); };
  const bagikan = async () => {
    const { url, nama } = await gambar();
    const file = new File([await (await fetch(url)).blob()], nama, { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: 'Maklumat Jumat' }); } catch (e) { if (e.name !== 'AbortError') throw e; }
    } else { const el = document.createElement('a'); el.href = url; el.download = nama; el.click(); }
  };

  return <>
    {tw && <div className="kartu" style={{ marginTop: 12 }}>
      <b>Tarawih malam ini (malam ke-{tw.malam})</b>
      <div className="kecil">Imam: <b>{tw.imam || '-'}</b> · Bilal: <b>{tw.bilal || '-'}</b></div>
      <div className="kecil">Kultum: <b>{tw.kultum || '-'}</b>{tw.tema ? ' — ' + tw.tema : ''}</div>
    </div>}

    <h3>Keuangan Masjid</h3>
    <div className="kartu">
      <div className="baris-flex"><span className="spasi kecil">Total saldo saat ini</span><b style={{ fontSize: 20 }}>{rp(total)}</b></div>
      <div style={{ marginTop: 6 }}>{d.saldo.map(p => <div className="jm-pos" key={p.nama}><span>{p.nama}</span><b>{rp(p.saldo)}</b></div>)}</div>
    </div>
    <div className="ringkas">
      <div className="kartu"><span className="kecil">Pemasukan {bulan}</span><b className="masuk">{rp(d.bulan.masuk)}</b></div>
      <div className="kartu"><span className="kecil">Pengeluaran {bulan}</span><b className="keluar">{rp(d.bulan.keluar)}</b></div>
    </div>

    {z.muzakki > 0 && <>
      <h3>Zakat Fitrah &amp; Fidyah {tahun} H</h3>
      <div className="ringkas">
        <div className="kartu"><span className="kecil">Terkumpul · {z.muzakki} muzakki / {z.jiwa} jiwa</span><b>{kg(z.terima_kg)}</b><div><b>{rp(z.terima_uang)}</b></div></div>
        <div className="kartu"><span className="kecil">Disalurkan · {z.mustahik} mustahik</span><b>{kg(z.salur_kg)}</b><div><b>{rp(z.salur_uang)}</b></div></div>
      </div>
    </>}

    <h3>Maklumat Jumat Terbaru</h3>
    {d.maklumat ? <>
      <div className="aksi" style={{ marginTop: 0, marginBottom: 10 }}>
        <Btn onClick={unduh}>Unduh Gambar</Btn>
        <Btn className="btn emas" onClick={bagikan}>Bagikan ke WA</Btn>
      </div>
      <Skala><Poster ref={poster} d={{ ...d.maklumat, kegiatan: d.maklumat.kegiatan || [] }} lap={d.laporan} /></Skala>
    </> : <div className="kartu kosong">Belum ada maklumat.</div>}
  </>;
}
