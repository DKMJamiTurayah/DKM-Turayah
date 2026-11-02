'use client';
import { useEffect, useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import '@fontsource/plus-jakarta-sans/400.css';
import '@fontsource/plus-jakarta-sans/500.css';
import '@fontsource/plus-jakarta-sans/600.css';
import '@fontsource/plus-jakarta-sans/700.css';
import '@fontsource/plus-jakarta-sans/800.css';
import { sb, rpc, q } from '@/lib/supabase';
import { jam, jumatDepan, pesanError, rp, tglPanjang } from '@/lib/util';
import { Btn, Field, Loading, useApp, useLoad } from './ui';

// isian awal kalau belum pernah ada maklumat sama sekali
const BAWAAN = {
  waktu: '11.40 WIB', khatib: '', muadzin: '', petugas_maklumat: '',
  nama_masjid: 'Masjid Jami Turayah', alamat: 'Villa Athaland 2, Sindangmulya',
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
  const s = useLoad(() => q(sb().from('maklumat').select('*').order('tanggal', { ascending: false }).limit(60)), [a.refreshKey]);

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
      {bolehBuat(a) && <button className="btn kecil" onClick={baru}>+ Maklumat {tglPanjang(jumatDepan()).replace('Jumat, ', '')}</button>}</div>
    <p className="kecil">Laporan keuangan terisi otomatis dari Buku Kas per pos dana. Isian lain otomatis disalin dari maklumat minggu lalu, tinggal ganti petugasnya.{!bolehBuat(a) && ' Yang bisa membuat maklumat hanya pengurus yang ditunjuk Admin / Ketum, Anda bisa melihat & mengunduh.'}</p>
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
  const data = { ...f, kegiatan };
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
      <Btn onClick={unduh} disabled={!lap.data}>Unduh Gambar</Btn>
      <Btn className="btn emas" onClick={bagikan} disabled={!lap.data}>Bagikan ke WA</Btn>
    </div>

    <h3>Pratinjau</h3>
    {lap.err ? <div className="kartu kosong">Gagal memuat laporan: {lap.err}</div>
      : !lap.data ? <Loading /> : <Skala><Poster ref={poster} d={data} lap={lap.data} /></Skala>}

    {f.id && a.punya('admin', 'ketum') && <div className="aksi"><Btn className="btn merah-sek" onClick={hapus}>Hapus Maklumat Ini</Btn></div>}
  </>;
}

// poster dibuat lebar 1080px (ukuran gambar asli), lalu diperkecil agar muat di layar
function Skala({ children }) {
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
  const judul = (d.nama_masjid || '').trim();
  return <div ref={ref} className="mk">
    <div className="mk-atas">
      <svg className="mk-hias" width="230" height="200" viewBox="0 0 230 200" aria-hidden="true">
        <g stroke="#c9a14d" strokeWidth="2.2" opacity=".85">
          <line x1="82" y1="18" x2="40" y2="78" /><line x1="82" y1="18" x2="128" y2="58" /><line x1="128" y1="58" x2="186" y2="24" />
          <line x1="40" y1="78" x2="114" y2="128" /><line x1="128" y1="58" x2="114" y2="128" />
          <line x1="114" y1="128" x2="64" y2="168" /><line x1="114" y1="128" x2="176" y2="160" />
        </g>
        <circle cx="82" cy="18" r="14" fill="#f2bb48" /><circle cx="128" cy="58" r="10" fill="#f2bb48" />
        <circle cx="186" cy="24" r="5.5" fill="#c9a14d" /><circle cx="40" cy="78" r="8.5" fill="#c9a14d" />
        <circle cx="114" cy="128" r="11" fill="#f2bb48" /><circle cx="64" cy="168" r="6" fill="#c9a14d" />
        <circle cx="176" cy="160" r="6" fill="#c9a14d" />
      </svg>
      <div className="mk-kicker">Maklumat Jum&apos;at</div>
      <div className="mk-judul">{judul}</div>
      {d.alamat && <div className="mk-alamat">{d.alamat}</div>}
    </div>

    <div className="mk-isi">
      <div className="mk-waktu">
        <div><span>Tanggal</span><b>{tglPanjang(d.tanggal)}</b></div>
        <div><span>Waktu</span><b>{d.waktu || '-'}</b></div>
      </div>

      <div className="mk-petugas">
        <div><span>Khatib dan imam</span><b>{d.khatib || '-'}</b></div>
        <div><span>Muadzin dan bilal</span><b>{d.muadzin || '-'}</b></div>
        <div><span>Maklumat</span><b>{d.petugas_maklumat || '-'}</b></div>
      </div>

      <div className="mk-h">Laporan keuangan</div>
      <table className="mk-tabel">
        <thead><tr><th>Rincian</th><th>Saldo lalu</th><th className="c">Masuk</th><th className="c">Keluar</th><th>Total</th></tr></thead>
        <tbody>{lap.map(r => <tr key={r.pos_id}>
          <td>{r.nama}</td><td>{rp(r.saldo_lalu)}</td>
          <td className={+r.masuk ? '' : 'c'}>{strip(r.masuk)}</td><td className={+r.keluar ? '' : 'c'}>{strip(r.keluar)}</td>
          <td className="tb">{rp(r.total)}</td></tr>)}</tbody>
      </table>
      <div className="mk-total"><span>Total saldo saat ini</span><b>{rp(total)}</b></div>

      {d.kegiatan.length > 0 && <>
        <div className="mk-h">Kegiatan {judul}</div>
        {d.kegiatan.map((g, i) => <div className="mk-keg" key={i}>
          {g.judul && <div className="mk-keg-j">{d.kegiatan.length > 1 ? HURUF[i] + '. ' : ''}{g.judul}</div>}
          <ol>{g.items.map((t, j) => <li key={j}>{t}</li>)}</ol>
        </div>)}
      </>}
    </div>

    <div className="mk-bawah">
      <div><span>Rekening masjid</span><b>{d.rekening || '-'}</b></div>
      <div className="r"><span>Token listrik{d.token_an ? ', a/n ' + d.token_an : ''}</span><b>{d.token_listrik || '-'}</b></div>
    </div>
  </div>;
}
