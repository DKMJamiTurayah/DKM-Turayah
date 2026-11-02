'use client';
import { useState } from 'react';
import { sb, rpc } from '@/lib/supabase';
import { ROLE } from '@/lib/util';
import { Btn, Field, useApp } from './ui';

export default function Akun() {
  const a = useApp();
  const [nama, setNama] = useState(a.me.nama), [hp, setHp] = useState(a.me.no_hp || ''), [pass, setPass] = useState('');
  const simpan = async () => {
    await rpc('ubah_profil_saya', { p_nama: nama, p_no_hp: hp.trim() || null });
    a.closeModal(); a.toast('Tersimpan'); await a.muatSaya(a.me.id);
  };
  const ganti = async () => {
    if (pass.length < 6) return a.toast('Minimal 6 karakter', true);
    const { error } = await sb().auth.updateUser({ password: pass });
    if (error) throw error;
    a.closeModal(); a.toast('Password diganti');
  };
  return <>
    <div className="kecil">@{a.me.username} · {ROLE[a.me.role]}</div>
    <Field id="pNama" label="Nama" value={nama} onChange={e => setNama(e.target.value)} />
    <Field id="pHp" label="No. HP" value={hp} onChange={e => setHp(e.target.value)} />
    <div className="aksi"><Btn onClick={simpan}>Simpan</Btn></div>
    <h3>Ganti Password</h3>
    <Field id="pPass" label="Password baru" type="password" autoComplete="new-password" value={pass} onChange={e => setPass(e.target.value)} />
    <div className="aksi"><Btn className="btn sek" onClick={ganti}>Ganti Password</Btn></div>
    <div className="aksi"><button className="btn merah-sek" onClick={() => { a.closeModal(); a.keluar(); }}>Keluar</button></div>
  </>;
}
