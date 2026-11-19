'use client';
import { useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import { sb, q } from '@/lib/supabase';
import { NAMA_DKM } from '@/lib/util';
import { Btn, Loading, useApp, useLoad } from './ui';
import { Skala } from './Maklumat';

const muat = () => q(sb().from('struktur_dkm').select('*').order('urutan').order('id'));

// kartu Struktur DKM (tampil di Beranda). Admin & Ketum bisa ubah nama.
export default function Struktur() {
  const a = useApp();
  const [buka, setBuka] = useState(false);
  const s = useLoad(muat, [a.refreshKey]);
  if (s.err) return null;   // mis. migration 007 belum dijalankan
  const boleh = a.punya('admin', 'ketum');
  const kelompok = [];
  (s.data || []).forEach(r => { let k = kelompok.find(x => x.nama === r.kelompok); if (!k) kelompok.push(k = { nama: r.kelompok, isi: [] }); k.isi.push(r); });

  return <>
    <div className="baris-flex"><h3 className="spasi">Struktur DKM</h3>
      <button className="btn sek kecil" onClick={() => setBuka(!buka)}>{buka ? 'Tutup' : 'Lihat'}</button>
      {s.data && <button className="btn sek kecil" onClick={() => a.openModal('Bagan Struktur DKM', <UnduhBagan list={s.data} />)}>Unduh Bagan</button>}
      {boleh && s.data && <button className="btn sek kecil" onClick={() => a.openModal('Ubah Nama Pengurus', <FormStruktur list={s.data} />)}>Ubah Nama</button>}</div>
    {buka && (!s.data ? <Loading s={s} /> : <div className="kartu">
      {kelompok.map(k => <div key={k.nama} style={{ marginBottom: 8 }}>
        <div className="kecil tebal">{k.nama}</div>
        <table className="t"><tbody>{k.isi.map(r => <tr key={r.id}>
          <td style={{ width: '45%' }}>{r.jabatan}</td><td className="tebal">{r.nama || <i className="kecil">belum diisi</i>}</td></tr>)}</tbody></table>
      </div>)}
    </div>)}
  </>;
}

function FormStruktur({ list }) {
  const a = useApp();
  const [nama, setNama] = useState(Object.fromEntries(list.map(r => [r.id, r.nama || ''])));
  const simpan = async () => {
    const ubah = list.filter(r => (r.nama || '') !== nama[r.id].trim());
    if (!ubah.length) return a.closeModal();
    for (const r of ubah)
      await q(sb().from('struktur_dkm').update({ nama: nama[r.id].trim() || null, diubah_by: a.me.id, diubah_at: new Date().toISOString() }).eq('id', r.id));
    a.closeModal(); a.toast(ubah.length + ' nama diperbarui'); a.refresh();
  };
  let kel = '';
  return <>
    <p className="kecil">Jabatan sudah tetap, cukup ganti nama saat ada pergantian pengurus. Kosongkan kalau jabatan belum terisi. Satu jabatan boleh diisi lebih dari satu nama (pisahkan dengan koma).</p>
    {list.map(r => {
      const judul = r.kelompok !== kel ? (kel = r.kelompok) : null;
      return <div key={r.id}>
        {judul && <div className="kecil tebal" style={{ marginTop: 10 }}>{judul}</div>}
        <label className="f" htmlFor={'st' + r.id}>{r.jabatan}</label>
        <input className="f" id={'st' + r.id} value={nama[r.id]} placeholder="Nama" onChange={e => setNama({ ...nama, [r.id]: e.target.value })} />
      </div>;
    })}
    <div className="aksi"><Btn onClick={simpan}>Simpan</Btn></div>
  </>;
}

/* ====== Bagan struktur (gambar untuk dibagikan / dicetak) ====== */
const NAVY = '#1c2452', EMAS = '#f2bb48';
const garis = <div style={{ width: 4, height: 34, background: EMAS, margin: '0 auto' }} />;

// "Wakil X" digabung ke kotak X (Wakil Ketua -> Ketua Umum)
function susun(list) {
  const kel = [];
  list.forEach(r => { let k = kel.find(x => x.nama === r.kelompok); if (!k) kel.push(k = { nama: r.kelompok, isi: [] }); k.isi.push({ ...r, wakil: [] }); });
  kel.forEach(k => {
    k.isi.filter(r => /^wakil /i.test(r.jabatan)).forEach(w => {
      const dasar = w.jabatan.replace(/^wakil /i, '').toLowerCase();
      const induk = k.isi.find(r => r !== w && !/^wakil /i.test(r.jabatan) && r.jabatan.toLowerCase().startsWith(dasar));
      if (induk) { induk.wakil.push(w); w.gabung = true; }
    });
    k.isi = k.isi.filter(r => !r.gabung);
  });
  return kel;
}

function Kotak({ r, utama }) {
  const nm = x => x || '……………………';
  return <div style={{ background: utama ? NAVY : '#fcf8ef', color: utama ? '#fff' : NAVY, border: '2px solid ' + (utama ? NAVY : '#ead9b3'),
    borderTop: '6px solid ' + EMAS, borderRadius: 18, padding: '18px 16px', textAlign: 'center', minWidth: 0, flex: 1 }}>
    <div style={{ fontSize: 19, fontWeight: 600, color: utama ? EMAS : '#5f6680' }}>{r.jabatan}</div>
    <div style={{ fontSize: utama ? 32 : 25, fontWeight: 800, marginTop: 4, lineHeight: 1.2 }}>{nm(r.nama)}</div>
    {r.wakil.map(w => <div key={w.id} style={{ marginTop: 10, paddingTop: 8, borderTop: '1.5px dashed ' + (utama ? '#ffffff55' : '#e6dcc7') }}>
      <div style={{ fontSize: 16, fontWeight: 600, color: utama ? '#c9cde3' : '#5f6680' }}>{w.jabatan}</div>
      <div style={{ fontSize: 21, fontWeight: 700 }}>{nm(w.nama)}</div></div>)}
  </div>;
}

export function Bagan({ list, ref }) {
  const kel = susun(list);
  return <div ref={ref} className="mk">
    <div className="mk-atas" style={{ paddingBottom: 60 }}>
      <img src="/logo-masjid-jamie-jelas.png" alt="" style={{ position: 'absolute', top: 40, right: 56, width: 170, height: 170, objectFit: 'contain', background: '#fff', borderRadius: 24, padding: 8 }} />
      <div className="mk-kicker">Struktur Organisasi</div>
      <div className="mk-judul" style={{ fontSize: 66 }}>{NAMA_DKM}</div>
    </div>
    <div style={{ padding: '40px 56px 50px' }}>
      {kel.map((k, i) => {
        const top = k.isi.find(r => /ketua umum/i.test(r.jabatan));
        const sisa = k.isi.filter(r => r !== top);
        const kol = Math.min(sisa.length, sisa.length === 4 ? 4 : 3) || 1;
        return <div key={k.nama}>
          {i > 0 && garis}
          <div style={{ textAlign: 'center', fontSize: 22, fontWeight: 800, color: NAVY, letterSpacing: 1, textTransform: 'uppercase', margin: '4px 0 14px' }}>{k.nama}</div>
          {top && <div style={{ maxWidth: 480, margin: '0 auto' }}><Kotak r={top} utama /></div>}
          {top && sisa.length > 0 && garis}
          {sisa.length > 0 && <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 18, maxWidth: kol === 1 ? 420 : kol === 2 ? 760 : 'none', margin: '0 auto' }}>
            {sisa.map(r => <div key={r.id} style={{ width: `calc((100% - ${18 * (kol - 1)}px) / ${kol})`, display: 'flex', flexDirection: 'column' }}><Kotak r={r} /></div>)}</div>}
        </div>;
      })}
    </div>
    <div className="mk-bawah" style={{ padding: '26px 56px', justifyContent: 'center' }}><span>{NAMA_DKM}</span></div>
  </div>;
}

function UnduhBagan({ list }) {
  const a = useApp();
  const el = useRef();
  const unduh = async () => {
    await document.fonts?.ready;
    const opsi = { pixelRatio: 1, cacheBust: true, backgroundColor: '#f6eedf' };
    await toPng(el.current, opsi);              // render pertama: memanaskan font (Safari/iPhone)
    const url = await toPng(el.current, opsi);
    const x = document.createElement('a'); x.href = url; x.download = 'struktur-dkm.png'; x.click();
    a.toast('Bagan diunduh');
  };
  return <>
    <p className="kecil">Gambar bagan otomatis mengikuti nama di Struktur DKM. Jabatan yang belum diisi tampil titik-titik.</p>
    <Skala><Bagan ref={el} list={list} /></Skala>
    <div className="aksi"><Btn onClick={unduh}>Unduh Gambar</Btn></div>
  </>;
}
