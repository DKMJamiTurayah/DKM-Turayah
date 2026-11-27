'use client';
import { useEffect, useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import '@fontsource/plus-jakarta-sans/400.css';
import '@fontsource/plus-jakarta-sans/500.css';
import '@fontsource/plus-jakarta-sans/600.css';
import '@fontsource/plus-jakarta-sans/700.css';
import '@fontsource/plus-jakarta-sans/800.css';
import { sb, rpc, q } from '@/lib/supabase';
import { BULAN_P, jam, jumatDepan, pesanError, rp, tglPanjang } from '@/lib/util';
import { tglHijriyah } from '@/lib/hijriyah';
import { Btn, Field, Loading, useApp, useLoad } from './ui';

// isian awal kalau belum pernah ada maklumat sama sekali
const BAWAAN = {
  waktu: '11.40 WIB', khatib: '', muadzin: '', petugas_maklumat: '',
  nama_masjid: 'Masjid Jami Turayah', alamat: 'Villa Athaland Sindangmulya',
  rekening: 'Bank BJB 0146-20269-1100', token_listrik: '45139308915', token_an: 'Masjid Jami Turayah',
  kegiatan: [
    { judul: "Ba'da Ashar, jadwal hari Senin s/d Rabu", items: ['TPA Anak'] },
    { judul: "Ba'da Maghrib", items: [
      "Tahlil dan Yasinan, jadwal hari Kamis malam Jum'at",
      'Pengajian Minggu pekan 1, pembahasan Fiqih Ibadah',
      'Pengajian Minggu pekan 2, pembahasan Aqidah Akhlak',
      "Pengajian Minggu pekan 3, pembahasan Tahsin Al-Qur'an",
      'Rapat DKM masjid pekan 4, pembahasan progres kemakmuran masjid'] }
  ]
};
const KOLOM = ['waktu', 'khatib', 'muadzin', 'petugas_maklumat', 'nama_masjid', 'alamat', 'rekening', 'token_listrik', 'token_an', 'kegiatan'];
const HURUF = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export default function Maklumat() {
  const a = useApp();
  const [buka, setBuka] = useState(null);   // null = daftar, { ...data } = editor
  const [jadwal, setJadwal] = useState(false);
  const s = useLoad(() => q(sb().from('maklumat').select('*').order('tanggal', { ascending: false }).limit(60)), [a.refreshKey]);

  if (jadwal) return <JadwalKhatib riwayat={s.data || []} tutup={() => setJadwal(false)} />;
  if (buka) return <Editor awal={buka} riwayat={s.data || []} tutup={() => { setBuka(null); a.refresh(); }} />;
  if (!s.data) return <Loading s={s} />;

  const baru = () => {
    const tgl = jumatDepan();
    const ada = s.data.find(m => m.tanggal === tgl);
    if (ada) return setBuka(ada);
    const terakhir = s.data[0];
    const isi = {};
    KOLOM.forEach(k => { isi[k] = terakhir ? terakhir[k] : BAWAAN[k]; });
    if (!isi.kegiatan?.length) isi.kegiatan = BAWAAN.kegiatan;
    setBuka({ ...isi, tanggal: tgl });
  };

  return <>
    <div className="baris-flex"><h2 className="spasi">Maklumat Jumat</h2>
      <button className="btn sek kecil" onClick={() => setJadwal(true)}>Jadwal Khatib</button>
      {bolehBuat(a) && <button className="btn kecil" onClick={baru}>+ Maklumat {tglPanjang(jumatDepan()).replace('Jumat, ', '')}</button>}</div>
    <p className="kecil">Laporan keuangan terisi otomatis dari Buku Kas per pos dana. Isian lain otomatis disalin dari maklumat minggu lalu, tinggal ganti petugasnya.{!bolehBuat(a) && ' Yang bisa membuat maklumat hanya pengurus yang ditunjuk Admin / Ketum, Anda bisa melihat maklumat.'}</p>
    {s.data.length ? s.data.map(m => (
      <div className="kartu klik" key={m.id} onClick={() => setBuka(m)}>
        <div className="baris-flex"><b className="spasi">{tglPanjang(m.tanggal)}</b><span className="kecil">{m.waktu}</span></div>
        <div className="kecil">Khatib: {m.khatib || '-'} · Muadzin: {m.muadzin || '-'}</div>
        <div className="kecil">Disimpan {a.nm(m.diubah_by || m.dibuat_by)} · {jam(m.diubah_at || m.dibuat_at)}</div>
      </div>)) : <div className="kartu kosong">Belum ada maklumat. Klik tombol di atas untuk membuat yang pertama.</div>}
  </>;
}

export const bolehBuat = a => a.punya('admin', 'ketum') || !!a.me?.boleh_maklumat;

function Editor({ awal, riwayat, tutup }) {
  const a = useApp();
  const boleh = bolehBuat(a);
  const [f, setF] = useState(() => ({ ...awal, kegiatan: (awal.kegiatan || []).map(g => ({ judul: g.judul || '', teks: (g.items || []).join('\n') })) }));
  const [infoTetap, setInfoTetap] = useState(false);
  const [koreksiH, setKoreksiH] = useState(() => { try { return +localStorage.getItem('dkm_koreksi_hijriyah') || 0; } catch { return 0; } });
  const ubahKoreksi = v => { setKoreksiH(v); try { localStorage.setItem('dkm_koreksi_hijriyah', String(v)); } catch {} };
  const [lap, setLap] = useState({ loading: true });
  const poster = useRef();
  const set = (k, v) => setF(x => ({ ...x, [k]: v }));

  useEffect(() => {
    let hidup = true;
    setLap(x => ({ ...x, loading: true }));
    rpc('laporan_pos', { p_tgl: f.tanggal })
      .then(d => hidup && setLap({ data: d }))
      .catch(e => hidup && setLap({ err: pesanError(e) }));
    return () => { hidup = false; };
  }, [f.tanggal, a.refreshKey]);

  const nama = k => [...new Set(riwayat.map(m => m[k]).filter(Boolean))];
  const kegiatan = f.kegiatan.map(g => ({ judul: g.judul.trim(), items: g.teks.split('\n').map(t => t.trim()).filter(Boolean) }))
    .filter(g => g.judul || g.items.length);
  const data = { ...f, kegiatan, koreksiH };
  const bukanJumat = f.tanggal && new Date(f.tanggal + 'T00:00:00Z').getUTCDay() !== 5;

  const simpan = async (diam) => {
    if (bukanJumat) throw new Error('Tanggal harus hari Jumat');
    const p = { tanggal: f.tanggal, kegiatan };
    KOLOM.filter(k => k !== 'kegiatan').forEach(k => { p[k] = (f[k] || '').trim(); });
    await rpc('simpan_maklumat', { p });
    if (!diam) a.toast('Maklumat tersimpan');
  };

  const buatGambar = async () => {
    await document.fonts?.ready;
    const opsi = { pixelRatio: 1, cacheBust: true, backgroundColor: '#f6eedf' };
    await toPng(poster.current, opsi);          // render pertama: memanaskan font (Safari/iPhone)
    const url = await toPng(poster.current, opsi);
    return { url, nama: `maklumat-jumat-${f.tanggal}.png` };
  };
  const unduh = async () => {
    if (boleh) await simpan(true);
    const { url, nama } = await buatGambar();
    const el = document.createElement('a'); el.href = url; el.download = nama; el.click();
    a.toast(boleh ? 'Tersimpan & gambar diunduh' : 'Gambar diunduh');
  };
  const bagikan = async () => {
    if (boleh) await simpan(true);
    const { url, nama } = await buatGambar();
    const file = new File([await (await fetch(url)).blob()], nama, { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: 'Maklumat Jumat' }); } catch (e) { if (e.name !== 'AbortError') throw e; }
    } else {
      const el = document.createElement('a'); el.href = url; el.download = nama; el.click();
      a.toast('HP/browser ini tidak bisa langsung share, gambar diunduh');
    }
  };
  const hapus = async () => {
    if (!confirm('Hapus maklumat ' + tglPanjang(f.tanggal) + '?')) return;
    await rpc('hapus_maklumat', { p_id: f.id }); a.toast('Maklumat dihapus'); tutup();
  };

  const ubahGrup = (i, k, v) => set('kegiatan', f.kegiatan.map((g, j) => j === i ? { ...g, [k]: v } : g));
  const geserGrup = (i, d) => { const k = [...f.kegiatan]; const j = i + d; if (j < 0 || j >= k.length) return; [k[i], k[j]] = [k[j], k[i]]; set('kegiatan', k); };

  return <>
    <div className="baris-flex"><button className="btn sek kecil" onClick={tutup}>‹ Kembali</button>
      <h2 className="spasi" style={{ margin: 0 }}>{!boleh ? tglPanjang(f.tanggal) : f.id ? 'Ubah Maklumat' : 'Buat Maklumat'}</h2></div>

    {boleh && <>
    <div className="kartu" style={{ marginTop: 10 }}>
      <Field id="mTgl" label="Tanggal (hari Jumat)" type="date" value={f.tanggal} onChange={e => set('tanggal', e.target.value)} disabled={!!f.id} />
      {bukanJumat && <div className="kecil keluar">Tanggal yang dipilih bukan hari Jumat</div>}
      <Field id="mJam" label="Waktu pelaksanaan" placeholder="11.40 WIB" value={f.waktu || ''} onChange={e => set('waktu', e.target.value)} />
      <Field id="mKhatib" label="Khatib dan imam" list="dlKhatib" value={f.khatib || ''} onChange={e => set('khatib', e.target.value)} />
      <Field id="mMuadzin" label="Muadzin dan bilal" list="dlMuadzin" value={f.muadzin || ''} onChange={e => set('muadzin', e.target.value)} />
      <Field id="mPetugas" label="Petugas maklumat" list="dlPetugas" value={f.petugas_maklumat || ''} onChange={e => set('petugas_maklumat', e.target.value)} />
      <datalist id="dlKhatib">{nama('khatib').map(x => <option key={x} value={x} />)}</datalist>
      <datalist id="dlMuadzin">{nama('muadzin').map(x => <option key={x} value={x} />)}</datalist>
      <datalist id="dlPetugas">{nama('petugas_maklumat').map(x => <option key={x} value={x} />)}</datalist>
    </div>

    <div className="kartu">
      <b>Laporan keuangan</b>
      <div className="kecil">Otomatis dari Buku Kas: saldo s/d Jumat lalu, masuk &amp; keluar seminggu terakhir, total s/d {tglPanjang(f.tanggal)}. Kalau ada yang belum sesuai, perbaiki di Buku Kas (oleh Bendahara).</div>
    </div>

    <div className="kartu">
      <div className="baris-flex"><b className="spasi">Kegiatan masjid</b>
        <button className="btn sek kecil" onClick={() => set('kegiatan', [...f.kegiatan, { judul: '', teks: '' }])}>+ Kelompok</button></div>
      {f.kegiatan.map((g, i) => <div key={i} className="mk-grup">
        <div className="baris-flex">
          <b>{HURUF[i]}.</b>
          <input className="f spasi" placeholder="Judul kelompok, contoh: Ba'da Maghrib" value={g.judul} onChange={e => ubahGrup(i, 'judul', e.target.value)} aria-label={'Judul kelompok ' + HURUF[i]} />
          <button className="btn sek kecil" onClick={() => geserGrup(i, -1)} aria-label="Naikkan">↑</button>
          <button className="btn merah-sek kecil" onClick={() => set('kegiatan', f.kegiatan.filter((_, j) => j !== i))} aria-label="Hapus kelompok">✕</button>
        </div>
        <textarea className="f" style={{ marginTop: 6 }} rows={Math.max(3, Math.ceil(g.teks.split('\n').length * 1.6))} placeholder="Satu kegiatan per baris" value={g.teks}
          onChange={e => ubahGrup(i, 'teks', e.target.value)} aria-label={'Daftar kegiatan ' + HURUF[i]} />
      </div>)}
      <div className="kecil">Tulis satu kegiatan per baris, nomor otomatis.</div>
    </div>

    <div className="kartu">
      <b>Tanggal Hijriyah</b>
      <div className="kecil">Tampil otomatis di bawah tanggal Masehi pada poster. Jumat ini: <b>{f.tanggal ? tglHijriyah(f.tanggal, koreksiH) : '-'}</b></div>
      <label className="f" htmlFor="mKoreksi">Koreksi tanggal Hijriyah (kalau beda dengan Kemenag/NU)</label>
      <select className="f" id="mKoreksi" value={koreksiH} onChange={e => ubahKoreksi(+e.target.value)}>
        <option value={-2}>Mundur 2 hari</option><option value={-1}>Mundur 1 hari</option><option value={0}>Tanpa koreksi</option>
        <option value={1}>Maju 1 hari</option><option value={2}>Maju 2 hari</option>
      </select>
      <div className="kecil">Pengaturan ini tersimpan di HP/browser ini.</div>
    </div>

    <div className="kartu">
      <div className="baris-flex klik" style={{ cursor: 'pointer' }} onClick={() => setInfoTetap(!infoTetap)}>
        <b className="spasi">Info tetap (nama masjid, rekening, token)</b><span>{infoTetap ? '▲' : '▼'}</span></div>
      {infoTetap && <>
        <Field id="mNama" label="Nama masjid" value={f.nama_masjid || ''} onChange={e => set('nama_masjid', e.target.value)} />
        <Field id="mAlamat" label="Alamat" value={f.alamat || ''} onChange={e => set('alamat', e.target.value)} />
        <Field id="mRek" label="Rekening masjid" value={f.rekening || ''} onChange={e => set('rekening', e.target.value)} />
        <Field id="mToken" label="Nomor token listrik" value={f.token_listrik || ''} onChange={e => set('token_listrik', e.target.value)} />
        <Field id="mTokenAn" label="Token listrik atas nama" value={f.token_an || ''} onChange={e => set('token_an', e.target.value)} />
      </>}
    </div>

    </>}
    <div className="aksi" style={{ marginTop: boleh ? 0 : 10, marginBottom: 10 }}>
      {boleh && <Btn className="btn sek" onClick={() => simpan()}>Simpan</Btn>}
      {a.punya('admin') && <Btn onClick={unduh} disabled={!lap.data}>Unduh Gambar</Btn>}
      {a.punya('admin') && <Btn className="btn emas" onClick={bagikan} disabled={!lap.data}>Bagikan ke WA</Btn>}
    </div>

    <h3>Pratinjau</h3>
    {lap.err ? <div className="kartu kosong">Gagal memuat laporan: {lap.err}</div>
      : !lap.data ? <Loading /> : <Skala><Poster ref={poster} d={data} lap={lap.data} /></Skala>}

    {f.id && a.punya('admin', 'ketum') && <div className="aksi"><Btn className="btn merah-sek" onClick={hapus}>Hapus Maklumat Ini</Btn></div>}
  </>;
}

// poster dibuat lebar 1080px (ukuran gambar asli), lalu diperkecil agar muat di layar
export function Skala({ children }) {
  const luar = useRef(), dalam = useRef();
  const [ukur, setUkur] = useState({ s: 0.3, h: 400 });
  useEffect(() => {
    const hitung = () => {
      if (!luar.current || !dalam.current) return;
      const s = luar.current.clientWidth / 1080;
      setUkur({ s, h: dalam.current.offsetHeight * s });
    };
    hitung();
    const ro = new ResizeObserver(hitung);
    ro.observe(luar.current); ro.observe(dalam.current);
    return () => ro.disconnect();
  }, []);
  return <div ref={luar} className="mk-skala" style={{ height: ukur.h }}>
    <div ref={dalam} style={{ transform: `scale(${ukur.s})`, transformOrigin: '0 0', width: 1080 }}>{children}</div>
  </div>;
}

const strip = n => +n ? rp(n) : '-';

export function Poster({ d, lap, ref }) {
  const total = lap.reduce((x, r) => x + +r.total, 0);
  const jml = k => lap.reduce((x, r) => x + +r[k], 0);
  const judul = (d.nama_masjid || '').trim();
  return <div ref={ref} className="mk">
    <div className="mk-atas" style={{ position: 'relative' }}>
      <img src="/logo-masjid-jamie-jelas.png" alt="" style={{ position: 'absolute', top: 40, right: 56, zIndex: 2, width: 170, height: 170, objectFit: 'contain', background: '#fff', borderRadius: 24, padding: 8 }} />
      <div className="mk-kicker">Maklumat Jum&apos;at</div>
      <div className="mk-judul">{judul}</div>
      {d.alamat && <div className="mk-alamat">{d.alamat}</div>}
    </div>

    <div className="mk-isi">
      <div className="mk-waktu">
        <div><span>Tanggal</span><b>{tglPanjang(d.tanggal)}</b><em style={{ display: 'block', fontStyle: 'normal', fontSize: 24, fontWeight: 600, color: '#5f6680', marginTop: 6 }}>{tglHijriyah(d.tanggal, d.koreksiH || 0)}</em></div>
        <div><span>Waktu</span><b>{d.waktu || '-'}</b></div>
      </div>

      <div className="mk-petugas">
        <div><span>Khatib dan imam</span><b>{d.khatib || '-'}</b></div>
        <div><span>Muadzin dan bilal</span><b>{d.muadzin || '-'}</b></div>
        <div><span>Maklumat</span><b>{d.petugas_maklumat || '-'}</b></div>
      </div>

      {/* Rekening BJB & token PLN, di tengah antara petugas dan laporan keuangan */}
      <div style={{ display: 'flex', gap: 20, margin: '28px 0 8px' }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 18, background: '#f08a1c', color: '#fff', borderRadius: 22, padding: '20px 24px' }}>
          <svg width="84" height="84" viewBox="0 0 84 84" style={{ flex: 'none' }}>
            <rect width="84" height="84" rx="18" fill="#fff" />
            <rect x="6" y="6" width="72" height="72" rx="14" fill="#0b5aa8" />
            <text x="42" y="53" textAnchor="middle" fontSize="30" fontWeight="800" fill="#fff" fontFamily="Plus Jakarta Sans, sans-serif">bjb</text>
          </svg>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 20, fontWeight: 600 }}>Rekening masjid</div>
            <div style={{ fontSize: 25, fontWeight: 800, lineHeight: 1.2, whiteSpace: 'nowrap' }}>{d.rekening || '-'}</div>
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 18, background: '#f08a1c', color: '#fff', borderRadius: 22, padding: '20px 24px' }}>
          <svg width="84" height="84" viewBox="0 0 84 84" style={{ flex: 'none' }}>
            <rect width="84" height="84" rx="18" fill="#fff" />
            <rect x="6" y="6" width="72" height="72" rx="14" fill="#1a8fc9" />
            <path d="M48 12 L26 48 H40 L34 72 L58 34 H44 Z" fill="#fbd51a" />
          </svg>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 20, fontWeight: 600 }}>Token listrik{d.token_an ? ', a/n ' + d.token_an : ''}</div>
            <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1.2 }}>{d.token_listrik || '-'}</div>
          </div>
        </div>
      </div>

      <div className="mk-h">Laporan keuangan</div>
      <table className="mk-tabel">
        <thead><tr><th>Rincian</th><th>Saldo lalu</th><th className="c">Masuk</th><th className="c">Keluar</th><th>Saldo Akhir</th></tr></thead>
        <tbody>{lap.map(r => <tr key={r.pos_id}>
          <td>{r.nama}</td><td>{rp(r.saldo_lalu)}</td>
          <td className={+r.masuk ? '' : 'c'}>{strip(r.masuk)}</td><td className={+r.keluar ? '' : 'c'}>{strip(r.keluar)}</td>
          <td className="tb">{rp(r.total)}</td></tr>)}</tbody>
        <tfoot><tr>
          <td style={{ borderTop: '3px solid #1c2452', borderBottom: 'none', fontWeight: 800 }}>Total</td>
          <td style={{ borderTop: '3px solid #1c2452', borderBottom: 'none', fontWeight: 800 }}>{rp(jml('saldo_lalu'))}</td>
          <td className={jml('masuk') ? '' : 'c'} style={{ borderTop: '3px solid #1c2452', borderBottom: 'none', fontWeight: 800 }}>{strip(jml('masuk'))}</td>
          <td className={jml('keluar') ? '' : 'c'} style={{ borderTop: '3px solid #1c2452', borderBottom: 'none', fontWeight: 800 }}>{strip(jml('keluar'))}</td>
          <td style={{ borderTop: '3px solid #1c2452', borderBottom: 'none', fontWeight: 800 }}>{rp(total)}</td>
        </tr></tfoot>
      </table>
      <div className="mk-total"><span>Total Saldo Jumat ini Tgl {tglPanjang(d.tanggal).replace(/^[^,]+, /, '')}</span><b>{rp(total)}</b></div>

      {d.kegiatan.length > 0 && <>
        <div className="mk-h">Kegiatan {judul}</div>
        {d.kegiatan.map((g, i) => <div className="mk-keg" key={i}>
          {g.judul && <div className="mk-keg-j">{d.kegiatan.length > 1 ? HURUF[i] + '. ' : ''}{g.judul}</div>}
          <ol>{g.items.map((t, j) => <li key={j}>{t}</li>)}</ol>
        </div>)}
      </>}

    </div>
  </div>;
}

/* ====== Jadwal Khatib per bulan (rekap + rencana ke depan) ====== */
const bulanJumat = bln => {
  const [t, b] = bln.split('-').map(Number), out = [];
  for (let d = new Date(Date.UTC(t, b - 1, 1)); d.getUTCMonth() === b - 1; d.setUTCDate(d.getUTCDate() + 1))
    if (d.getUTCDay() === 5) out.push(d.toISOString().slice(0, 10));
  return out;
};
const tglJumat = x => { const d = new Date(x + 'T00:00:00Z'); return d.getUTCDate() + ' ' + BULAN_P[d.getUTCMonth()]; };

function JadwalKhatib({ riwayat, tutup }) {
  const a = useApp();
  const boleh = bolehBuat(a);
  const [bln, setBln] = useState(jumatDepan().slice(0, 7));
  const [th, bl] = bln.split('-').map(Number);
  const poster = useRef();
  const jumat = bulanJumat(bln);
  const s = useLoad(() => q(sb().from('maklumat').select('*').gte('tanggal', jumat[0]).lte('tanggal', jumat[jumat.length - 1])), [bln, a.refreshKey]);
  const geser = d => { let t = th, b = bl + d; if (b < 1) { b = 12; t--; } if (b > 12) { b = 1; t++; } setBln(t + '-' + String(b).padStart(2, '0')); };
  const judul = BULAN_P[bl - 1] + ' ' + th;
  const baris = jumat.map(t => ({ tanggal: t, m: (s.data || []).find(x => x.tanggal === t) }));
  const rekap = {};
  baris.forEach(r => { const k = r.m?.khatib?.trim(); if (k) rekap[k] = (rekap[k] || 0) + 1; });
  const isi = t => {
    const ada = (s.data || []).find(x => x.tanggal === t);
    if (ada) return ada;
    const dasar = riwayat.find(x => x.tanggal < t) || riwayat[riwayat.length - 1];
    const x = {}; KOLOM.forEach(k => { x[k] = dasar ? dasar[k] : BAWAAN[k]; });
    if (!x.kegiatan?.length) x.kegiatan = BAWAAN.kegiatan;
    return { ...x, khatib: '', muadzin: '', tanggal: t };
  };
  const unduh = async () => {
    await document.fonts?.ready;
    const opsi = { pixelRatio: 1, cacheBust: true, backgroundColor: '#f6eedf' };
    await toPng(poster.current, opsi);
    const url = await toPng(poster.current, opsi);
    const el = document.createElement('a'); el.href = url; el.download = `jadwal-khatib-${bln}.png`; el.click();
    a.toast('Gambar diunduh');
  };

  return <>
    <div className="baris-flex"><button className="btn sek kecil" onClick={tutup}>‹ Kembali</button><h2 className="spasi">Jadwal Khatib</h2></div>
    <div className="kartu baris-flex"><button className="btn sek kecil" onClick={() => geser(-1)}>‹</button>
      <b className="spasi" style={{ textAlign: 'center' }}>{judul}</b><button className="btn sek kecil" onClick={() => geser(1)}>›</button></div>
    <p className="kecil">Terisi otomatis dari maklumat tiap Jumat.{boleh ? ' Ketuk tanggal untuk mengisi atau merencanakan petugas Jumat ke depan.' : ''}</p>
    {!s.data ? <Loading s={s} /> : <>
      {baris.map(r => <div key={r.tanggal} className={'kartu' + (boleh ? ' klik' : '')}
        onClick={() => boleh && a.openModal('Petugas Jumat ' + tglJumat(r.tanggal), <FormPetugas awal={isi(r.tanggal)} riwayat={riwayat} />)}>
        <div className="baris-flex"><b className="spasi">Jumat, {tglJumat(r.tanggal)}</b>
          {!r.m?.khatib && <span className="badge b-kuning">belum diisi</span>}</div>
        <div className="kecil">Khatib: <b>{r.m?.khatib || '-'}</b> · Muadzin: {r.m?.muadzin || '-'}</div>
      </div>)}
      {Object.keys(rekap).length > 0 && <div className="kartu"><b>Rekap khatib {judul}</b>
        <table className="t" style={{ marginTop: 6 }}><tbody>{Object.entries(rekap).sort((x, y) => y[1] - x[1]).map(([n, c]) =>
          <tr key={n}><td>{n}</td><td className="r tebal">{c}x</td></tr>)}</tbody></table></div>}
      <h3>Gambar jadwal</h3>
      <Skala><PosterJadwal ref={poster} judul={judul} baris={baris} /></Skala>
      <div className="aksi"><Btn onClick={unduh}>Unduh Gambar</Btn></div>
    </>}
  </>;
}

function FormPetugas({ awal, riwayat }) {
  const a = useApp();
  const [f, setF] = useState({ khatib: awal.khatib || '', muadzin: awal.muadzin || '' });
  const nama = k => [...new Set(riwayat.map(m => m[k]).filter(Boolean))];
  const simpan = async () => {
    await rpc('simpan_maklumat', { p: { ...awal, khatib: f.khatib.trim(), muadzin: f.muadzin.trim() } });
    a.closeModal(); a.toast('Petugas tersimpan'); a.refresh();
  };
  return <>
    <Field id="jKhatib" label="Khatib dan imam" list="jdlKhatib" value={f.khatib} onChange={e => setF({ ...f, khatib: e.target.value })} />
    <Field id="jMuadzin" label="Muadzin dan bilal" list="jdlMuadzin" value={f.muadzin} onChange={e => setF({ ...f, muadzin: e.target.value })} />
    <datalist id="jdlKhatib">{nama('khatib').map(x => <option key={x} value={x} />)}</datalist>
    <datalist id="jdlMuadzin">{nama('muadzin').map(x => <option key={x} value={x} />)}</datalist>
    <div className="aksi"><Btn onClick={simpan}>Simpan</Btn></div>
    <p className="kecil">Tersimpan sebagai maklumat Jumat tanggal ini. Isian lainnya (kegiatan, rekening, dll) disalin dari maklumat sebelumnya dan bisa diubah nanti di menu Maklumat.</p>
  </>;
}

function PosterJadwal({ judul, baris, ref }) {
  return <div ref={ref} className="mk">
    <div className="mk-atas" style={{ paddingBottom: 70 }}>
      <img src="/logo-masjid-jamie-jelas.png" alt="" style={{ position: 'absolute', top: 40, right: 56, width: 170, height: 170, objectFit: 'contain', background: '#fff', borderRadius: 24, padding: 8 }} />
      <div className="mk-kicker">Jadwal Petugas Jum&apos;at</div>
      <div className="mk-judul">{judul}</div>
      <div className="mk-alamat">Masjid Jami Turayah</div>
    </div>
    <div style={{ padding: '44px 56px 50px' }}>
      {baris.map(r => <div key={r.tanggal} style={{ display: 'flex', gap: 24, alignItems: 'center', background: '#fcf8ef', border: '2px solid #ead9b3', borderRadius: 20, padding: '22px 28px', marginBottom: 16 }}>
        <div style={{ flex: 'none', width: 150, textAlign: 'center', background: '#1c2452', color: '#fff', borderRadius: 16, padding: '12px 0' }}>
          <div style={{ fontSize: 20, color: '#f2bb48', fontWeight: 700 }}>Jumat</div>
          <div style={{ fontSize: 34, fontWeight: 800 }}>{tglJumat(r.tanggal).replace(/ (\w{3})\w*$/, ' $1')}</div></div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 19, color: '#5f6680', fontWeight: 600 }}>Khatib dan imam</div>
          <div style={{ fontSize: 30, fontWeight: 800 }}>{r.m?.khatib || '……………………'}</div>
          <div style={{ fontSize: 19, color: '#5f6680', fontWeight: 600, marginTop: 8 }}>Muadzin dan bilal</div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{r.m?.muadzin || '……………………'}</div>
        </div></div>)}
    </div>
    <div className="mk-bawah" style={{ padding: '26px 56px', justifyContent: 'center' }}><span>DKM Masjid Jami Turayah</span></div>
  </div>;
}
