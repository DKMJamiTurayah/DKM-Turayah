'use client';
import { useState } from 'react';
import { sb } from '@/lib/supabase';
import { NAMA_DKM, keEmail } from '@/lib/util';
import { Btn, Field, LogoMasjid, useApp } from './ui';

export default function Login() {
  const a = useApp();
  const [mode, setMode] = useState('masuk');
  const [f, setF] = useState({ nama: '', hp: '', user: '', pass: '' });
  const ubah = k => e => setF({ ...f, [k]: e.target.value });

  const masuk = async () => {
    if (!f.user || !f.pass) return a.toast('Isi username & password', true);
    const { data, error } = await sb().auth.signInWithPassword({ email: keEmail(f.user), password: f.pass });
    if (error) throw error;
    await a.muatSaya(data.user.id);
  };
  const daftar = async () => {
    const u = f.user.trim();
    if (!f.nama.trim() || !u || !f.pass) return a.toast('Nama, username, password wajib diisi', true);
    if (!/^[a-zA-Z0-9._-]{3,}$/.test(u)) return a.toast('Username min. 3 huruf, tanpa spasi', true);
    const { data, error } = await sb().auth.signUp({
      email: keEmail(u), password: f.pass,
      options: { data: { nama: f.nama.trim(), username: u.toLowerCase(), no_hp: f.hp.trim() } }
    });
    if (error) throw error;
    if (!data.session) { a.toast('Pendaftaran berhasil. Matikan "Confirm email" di Supabase lalu login.'); return setMode('masuk'); }
    await a.muatSaya(data.user.id);
  };

  return (
    <div className="login"><div className="box">
      <div className="kepala"><div className="logo-bulat"><LogoMasjid size={44} /></div>
        <b>{NAMA_DKM}</b><span className="kecil">Sistem Keuangan & Pengajuan Anggaran</span></div>
      <div className="tab2">
        <button className={mode === 'masuk' ? 'on' : ''} onClick={() => setMode('masuk')}>Masuk</button>
        <button className={mode === 'daftar' ? 'on' : ''} onClick={() => setMode('daftar')}>Daftar Pengurus</button>
      </div>
      {mode === 'daftar' && <>
        <Field id="rNama" label="Nama lengkap" value={f.nama} onChange={ubah('nama')} autoComplete="name" />
        <Field id="rHp" label="No. HP (opsional)" value={f.hp} onChange={ubah('hp')} inputMode="tel" />
      </>}
      <Field id="lUser" label="Username" value={f.user} onChange={ubah('user')} autoComplete="username" autoCapitalize="none" placeholder="contoh: ahmad" />
      <form onSubmit={e => e.preventDefault()}>
        <Field id="lPass" label="Password" type="password" value={f.pass} onChange={ubah('pass')}
          autoComplete={mode === 'daftar' ? 'new-password' : 'current-password'}
          onKeyDown={e => { if (e.key === 'Enter') document.getElementById('lBtn')?.click(); }} />
      </form>
      <Btn id="lBtn" className="btn penuh" style={{ marginTop: 16 }} onClick={mode === 'daftar' ? daftar : masuk}>
        {mode === 'daftar' ? 'Daftar' : 'Masuk'}</Btn>
      {mode === 'daftar' && <p className="kecil" style={{ marginBottom: 0 }}>Setelah daftar, Admin / Ketua Umum akan mengatur jabatan Anda.</p>}
    </div></div>
  );
}
