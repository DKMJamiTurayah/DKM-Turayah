'use client';
import { useEffect, useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import { hariIni, HARI, BULAN, BULAN_P } from '@/lib/util';
import { hitungJadwal, ramadhanTerdekat, tambahHari, LOKASI, WAKTU, WAJIB } from '@/lib/jadwal';
import { Btn, Chips, useApp } from './ui';
import { Skala } from './Maklumat';
import Tarawih from './Tarawih';

const NAMA = { imsak: 'Imsak', subuh: 'Subuh', terbit: 'Terbit', dhuha: 'Dhuha', dzuhur: 'Dzuhur', ashar: 'Ashar', maghrib: 'Maghrib', isya: 'Isya' };
const menitWIB = () => (Date.now() / 60000 + 7 * 60) % 1440;
const tglHari = t => { const d = new Date(t + 'T00:00:00Z'); return `${HARI[d.getUTCDay()]}, ${d.getUTCDate()} ${BULAN_P[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };
const tglPendek = t => { const d = new Date(t + 'T00:00:00Z'); return `${d.getUTCDate()} ${BULAN[d.getUTCMonth()]}`; };
const hariPendek = t => HARI[new Date(t + 'T00:00:00Z').getUTCDay()];
const sisa = m => { m = Math.max(0, Math.ceil(m)); const j = Math.floor(m / 60); return (j ? j + ' jam ' : '') + (m % 60) + ' menit'; };
const tahunHijriah = t => { try { return new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { year: 'numeric', timeZone: 'UTC' }).format(new Date(t + 'T12:00:00Z')).replace(/\D/g, ''); } catch { return ''; } };
const selisihHari = (a, b) => Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 864e5);

// waktu shalat berikutnya dari sekarang (bisa Subuh besok)
export function berikutnya() {
  const now = menitWIB(), hi = hariIni();
  const j = hitungJadwal(hi);
  for (const k of ['imsak', ...WAJIB]) if (j._menit[k] > now) return { k, jam: j[k], lagi: j._menit[k] - now };
  const b = hitungJadwal(tambahHari(hi, 1));
  return { k: 'subuh', jam: b.subuh, lagi: b._menit.subuh + 1440 - now, besok: true };
}

// status Ramadhan untuk hari ini
export function infoRamadhan() {
  const hi = hariIni(), r = ramadhanTerdekat(hi);
  if (!r.hari.length) return { r };
  const ini = r.hari.find(h => h.tanggal === hi);
  return { r, ini, mulai: r.hari[0].tanggal, lagiHari: selisihHari(hi, r.hari[0].tanggal), hijri: tahunHijriah(r.hari[0].tanggal) };
}

// kartu kecil di Beranda
export function KartuJadwal() {
  const a = useApp();
  const [, tik] = useState(0);
  useEffect(() => { const iv = setInterval(() => tik(x => x + 1), 30000); return () => clearInterval(iv); }, []);
  const nx = berikutnya(), rm = infoRamadhan(), j = hitungJadwal(hariIni());
  return <div className="kartu klik jd-mini" onClick={() => a.go('jadwal')}>
    <div className="baris-flex">
      <div className="spasi">
        <div className="kecil">{nx.k === 'imsak' ? 'Imsak' : 'Shalat ' + NAMA[nx.k]}{nx.besok ? ' (besok)' : ''} · {sisa(nx.lagi)} lagi</div>
        <b className="jd-jam">{nx.jam}</b>
      </div>
      {rm.ini ? <div className="jd-buka"><span>Buka puasa</span><b>{j.maghrib}</b><span>Ramadhan ke-{rm.ini.ke}</span></div>
        : rm.mulai && rm.lagiHari <= 60 ? <div className="jd-buka"><span>Ramadhan {rm.hijri} H</span><b>{rm.lagiHari} hari</b><span>lagi</span></div> : null}
    </div>
    <div className="jd-baris">{WAJIB.map(k => <div key={k} className={nx.k === k && !nx.besok ? 'on' : ''}><span>{NAMA[k]}</span><b>{j[k]}</b></div>)}</div>
  </div>;
}

export default function Jadwal() {
  const a = useApp();
  const [tab, setTab] = useState('hari');
  const [, tik] = useState(0);
  useEffect(() => { const iv = setInterval(() => tik(x => x + 1), 30000); return () => clearInterval(iv); }, []);
  const hi = hariIni(), j = hitungJadwal(hi), nx = berikutnya(), rm = infoRamadhan();
  const poster = useRef();

  const buatGambar = async () => {
    await document.fonts?.ready;
    const opsi = { pixelRatio: 1, cacheBust: true, backgroundColor: '#f6eedf' };
    await toPng(poster.current, opsi);
    return { url: await toPng(poster.current, opsi), nama: `imsakiyah-ramadhan-${rm.hijri || rm.r.tahun}.png` };
  };
  const unduh = async () => {
    const { url, nama } = await buatGambar();
    const el = document.createElement('a'); el.href = url; el.download = nama; el.click();
    a.toast('Gambar diunduh');
  };
  const bagikan = async () => {
    const { url, nama } = await buatGambar();
    const file = new File([await (await fetch(url)).blob()], nama, { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: 'Jadwal Imsakiyah' }); } catch (e) { if (e.name !== 'AbortError') throw e; }
    } else {
      const el = document.createElement('a'); el.href = url; el.download = nama; el.click();
      a.toast('HP/browser ini tidak bisa langsung share, gambar diunduh');
    }
  };

  return <>
    <h2>Jadwal Shalat & Puasa</h2>
    <Chips items={[['hari', 'Hari Ini'], ['ramadhan', 'Imsakiyah Ramadhan'], ['tarawih', 'Petugas Tarawih']]} value={tab} onChange={setTab} />

    {tab === 'hari' ? <>
      <div className="kartu saldo">
        <div className="lbl">{tglHari(hi)}</div>
        <div className="angka">{nx.jam} <small style={{ fontSize: 15, fontWeight: 600 }}>{nx.k === 'imsak' ? 'Imsak' : NAMA[nx.k]}{nx.besok ? ' besok' : ''}</small></div>
        <div className="kecil" style={{ color: '#d7ece4' }}>{sisa(nx.lagi)} lagi</div>
        {rm.ini && <div className="jd-ram">Ramadhan hari ke-{rm.ini.ke} · Buka puasa <b>{j.maghrib}</b> · Imsak <b>{j.imsak}</b></div>}
      </div>
      <div className="kartu" style={{ padding: 0 }}>
        {WAKTU.map(([k]) => {
          const lewat = j._menit[k] <= menitWIB(), on = nx.k === k && !nx.besok;
          return <div key={k} className={'jd-row' + (on ? ' on' : '') + (lewat && !on ? ' lewat' : '') + (WAJIB.includes(k) ? '' : ' sunah')}>
            <span>{NAMA[k]}{k === 'maghrib' && rm.ini ? ' · buka puasa' : ''}</span><b>{j[k]}</b></div>;
        })}
      </div>
      <p className="kecil">Lokasi {LOKASI.nama}. Dihitung dengan metode Kemenag RI (Subuh 20°, Isya 18°, ihtiyat ±2 menit), selisih dengan jadwal resmi Kemenag Kab. Bekasi maksimal 1 menit.</p>
    </> : tab === 'tarawih' ? (rm.r.hari.length ? <Tarawih rm={rm} /> : <div className="kartu kosong">Jadwal Ramadhan belum tersedia.</div>) : <>
      {rm.r.hari.length ? <>
        <div className="kartu">
          <b>Ramadhan {rm.hijri} H</b>
          <div className="kecil">1 Ramadhan: {tglHari(rm.mulai)}{rm.ini ? ` · hari ini ke-${rm.ini.ke}` : rm.lagiHari > 0 ? ` · ${rm.lagiHari} hari lagi` : ''}</div>
          <div className="kecil">Tanggal awal masih perkiraan, menunggu sidang isbat Kemenag.</div>
          <div className="aksi" style={{ marginTop: 10 }}>
            <Btn onClick={bagikan}>Bagikan ke WA</Btn>
            <Btn className="btn sek" onClick={unduh}>Unduh Gambar</Btn>
          </div>
        </div>
        <div className="kartu" style={{ padding: 6, overflowX: 'auto' }}>
          <table className="t jd-tabel">
            <thead><tr><th>Ke</th><th>Tanggal</th><th>Imsak</th><th>Subuh</th><th>Dzuhur</th><th>Ashar</th><th>Buka</th><th>Isya</th></tr></thead>
            <tbody>{rm.r.hari.map(h => <tr key={h.tanggal} className={h.tanggal === hi ? 'on' : ''}>
              <td>{h.ke}</td><td>{hariPendek(h.tanggal).slice(0, 3)} {tglPendek(h.tanggal).replace(/ \w+$/, m => '/' + (BULAN.indexOf(m.trim()) + 1))}</td>
              <td>{h.imsak}</td><td>{h.subuh}</td><td>{h.dzuhur}</td><td>{h.ashar}</td><td className="tebal">{h.maghrib}</td><td>{h.isya}</td></tr>)}</tbody>
          </table>
        </div>
        <h3>Pratinjau gambar</h3>
        <Skala><PosterImsakiyah ref={poster} rm={rm} /></Skala>
      </> : <div className="kartu kosong">Jadwal Ramadhan belum tersedia.</div>}
    </>}
  </>;
}

function PosterImsakiyah({ rm, ref }) {
  return <div ref={ref} className="mk jd-poster">
    <div className="mk-atas" style={{ paddingBottom: 90 }}>
      <img src="/logo-masjid-jamie-jelas.png" alt="" style={{ position: 'absolute', top: 40, right: 56, width: 170, height: 170, objectFit: 'contain', background: '#fff', borderRadius: 24, padding: 8 }} />
      <div className="mk-kicker">Jadwal Imsakiyah</div>
      <div className="mk-judul" style={{ fontSize: 70 }}>Ramadhan {rm.hijri} H</div>
      <div className="mk-alamat">Masjid Jami Turayah · {LOKASI.nama}</div>
    </div>
    <div className="mk-isi">
      <table className="jd-pt">
        <thead><tr><th>Ramadhan</th><th className="l">Tanggal</th><th>Imsak</th><th>Subuh</th><th>Dzuhur</th><th>Ashar</th><th className="bk">Maghrib</th><th>Isya</th></tr></thead>
        <tbody>{rm.r.hari.map(h => <tr key={h.tanggal} className={new Date(h.tanggal + 'T00:00:00Z').getUTCDay() === 5 ? 'jm' : ''}>
          <td className="ke">{h.ke}</td><td className="l">{hariPendek(h.tanggal)}, {tglPendek(h.tanggal)} {h.tanggal.slice(0, 4)}</td>
          <td>{h.imsak}</td><td>{h.subuh}</td><td>{h.dzuhur}</td><td>{h.ashar}</td><td className="bk">{h.maghrib}</td><td>{h.isya}</td></tr>)}</tbody>
      </table>
      <div className="jd-catatan">Metode perhitungan Kemenag RI · ihtiyat 2 menit · 1 Ramadhan mengikuti keputusan sidang isbat pemerintah</div>
    </div>
  </div>;
}

