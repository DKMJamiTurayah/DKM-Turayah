'use client';
import { useState } from 'react';
import { sb, q } from '@/lib/supabase';
import { Btn, Loading, useApp, useLoad } from './ui';

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
