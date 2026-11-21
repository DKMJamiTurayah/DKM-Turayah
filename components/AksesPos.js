'use client';
import { useEffect, useState } from 'react';
import { sb, rpc, q } from '@/lib/supabase';
import { ROLE } from '@/lib/util';
import { Btn, useApp } from './ui';

const PENUH = ['admin', 'ketum', 'bendahara'];

// Admin/Ketum: centang pos apa saja yang boleh dilihat tiap pengurus
export default function AksesPos({ pos }) {
  const a = useApp();
  const orang = Object.values(a.prof).filter(p => p.aktif && p.role !== 'pending' && !PENUH.includes(p.role))
    .sort((x, y) => (x.nama || '').localeCompare(y.nama || ''));
  const [uid, setUid] = useState('');
  const [rows, setRows] = useState(null);
  const [pilih, setPilih] = useState(new Set());

  const muat = () => q(sb().from('akses_pos').select('user_id,pos_id')).then(setRows, e => a.toast(e.message, true));
  useEffect(() => { muat(); }, []);
  useEffect(() => { setPilih(new Set((rows || []).filter(r => r.user_id === uid).map(r => r.pos_id))); }, [uid, rows]);

  const toggle = id => setPilih(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const simpan = async () => {
    if (!uid) return a.toast('Pilih pengurus dulu', true);
    await rpc('set_akses_pos', { p_user: uid, p_pos: [...pilih] });
    await muat(); a.toast('Akses pos disimpan'); a.refresh();
  };

  return <>
    <p className="kecil">Admin, Ketum, dan Bendahara selalu melihat semua pos. Pengurus lain hanya melihat pos yang dicentang di sini.</p>
    <label className="f" htmlFor="apUser">Pengurus</label>
    <select className="f" id="apUser" value={uid} onChange={e => setUid(e.target.value)}>
      <option value="">— pilih —</option>
      {orang.map(p => <option key={p.id} value={p.id}>{p.nama} · {p.jabatan || ROLE[p.role]}</option>)}
    </select>
    {uid && <div style={{ marginTop: 8 }}>
      {pos.map(p => <label key={p.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 0' }}>
        <input type="checkbox" checked={pilih.has(p.id)} onChange={() => toggle(p.id)} /> {p.nama}
      </label>)}
      <div className="aksi"><Btn onClick={simpan}>Simpan</Btn></div>
    </div>}
  </>;
}
