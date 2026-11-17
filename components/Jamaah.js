'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import { rpc } from '@/lib/supabase';
import { BULAN_P, NAMA_DKM, hariIni, pesanError, rp, tglPanjang } from '@/lib/util';
import { hitungJadwal, tambahHari, LOKASI, WAJIB } from '@/lib/jadwal';
import { AppCtx, Btn, Loading, LogoMasjid, useApp } from './ui';
import { Poster, Skala } from './Maklumat';
import { hariTakjil } from './Takjil';

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
.jm-pos{display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--garis);font-size:14px}.jm-pos:last-child{border:0}`;

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
