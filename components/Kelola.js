'use client';
import { useEffect, useState } from 'react';
import { sb, rpc, q } from '@/lib/supabase';
import { ROLE, jam } from '@/lib/util';
import { Btn, Chips, Field, Loading, useApp, useLoad } from './ui';

export default function Kelola() {
  const a = useApp();
  const tab = a.sub.kelola || 'pengurus';
  const s = useLoad(async () => {
    const profs = await q(sb().from('profiles').select('*').order('created_at'));
    const m = {}; profs.forEach(p => m[p.id] = p); a.setProf(m);
    return profs;
  }, [a.refreshKey]);

  return <>
    <h2>Kelola</h2>
    <Chips items={[['pengurus', 'Pengurus'], ['bidang', 'Bidang'], ['aktivitas', 'Aktivitas']]} value={tab} onChange={k => a.setSub('kelola', k)} />
    {tab === 'aktivitas' ? <Aktivitas /> : !s.data ? <Loading s={s} /> : tab === 'pengurus' ? <>
      <p className="kecil">Pengurus mendaftar sendiri lewat halaman login (&quot;Daftar Pengurus&quot;), lalu jabatannya diatur di sini.</p>
      {s.data.slice().sort((x, y) => (x.role === 'pending' ? 0 : 1) - (y.role === 'pending' ? 0 : 1)).map(p => (
        <div className="kartu klik" key={p.id} onClick={() => a.openModal('Atur Pengurus', <FormUser p={p} />)}>
          <div className="baris-flex"><div className="spasi"><b>{p.nama}</b><div className="kecil">@{p.username}{p.no_rumah ? ' · Rumah ' + p.no_rumah : ''}{p.no_hp ? ' · ' + p.no_hp : ''}</div></div>
            <span className={'badge ' + (p.role === 'pending' ? 'b-kuning' : p.aktif ? 'b-hijau' : 'b-abu')}>{ROLE[p.role]}{p.aktif ? '' : ' (nonaktif)'}</span></div>
          {p.role === 'ketua_bidang' && <div className="kecil">{a.bn(p.bidang_id)}</div>}
          {p.jabatan && <div className="kecil">{p.jabatan}</div>}
          {p.boleh_maklumat && !['admin', 'ketum'].includes(p.role) && <div className="kecil masuk">✓ Pembuat maklumat</div>}
        </div>))}
    </> : <>
      <div className="aksi" style={{ marginTop: 0, marginBottom: 10 }}>
        <button className="btn" onClick={() => a.openModal('Tambah Bidang', <FormBidang />)}>+ Tambah Bidang</button></div>
      {Object.values(a.bid).map(b => {
        const kb = s.data.filter(p => p.role === 'ketua_bidang' && p.bidang_id === b.id && p.aktif);
        return <div className="kartu klik" key={b.id} style={b.aktif ? {} : { opacity: .5 }} onClick={() => a.openModal('Ubah Bidang', <FormBidang b={b} />)}>
          <b>{b.nama}</b><div className="kecil">Ketua: {kb.length ? kb.map(p => p.nama).join(', ') : <i>belum ada</i>}{b.aktif ? '' : ' · nonaktif'}</div></div>;
      })}
    </>}
  </>;
}

function FormUser({ p }) {
  const a = useApp();
  const bidAktif = Object.values(a.bid).filter(b => b.aktif);
  const [f, setF] = useState({ role: p.role, bidang: p.bidang_id || bidAktif[0]?.id || null, jabatan: p.jabatan || '', aktif: p.aktif, mk: !!p.boleh_maklumat });
  const simpan = async () => {
    await rpc('set_user', { p_id: p.id, p_role: f.role, p_bidang: f.role === 'ketua_bidang' ? +f.bidang : null, p_jabatan: f.jabatan.trim() || null, p_aktif: f.aktif });
    if (f.mk !== !!p.boleh_maklumat) await rpc('set_akses_maklumat', { p_id: p.id, p_boleh: f.mk });
    a.closeModal(); a.toast('Tersimpan');
    if (p.id === a.me.id) return a.muatSaya(a.me.id);
    a.refresh();
  };
  return <>
    <b>{p.nama}</b> <span className="kecil">@{p.username}{p.no_rumah ? ' · Rumah ' + p.no_rumah : ''}</span>
    <label className="f" htmlFor="uRole">Peran di sistem</label>
    <select className="f" id="uRole" value={f.role} onChange={e => setF({ ...f, role: e.target.value })}>
      {Object.entries(ROLE).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
    {f.role === 'ketua_bidang' && <>
      <label className="f" htmlFor="uBid">Bidang</label>
      <select className="f" id="uBid" value={f.bidang || ''} onChange={e => setF({ ...f, bidang: e.target.value })}>
        {bidAktif.map(b => <option key={b.id} value={b.id}>{b.nama}</option>)}</select></>}
    <Field id="uJab" label="Jabatan (tampil di aplikasi, opsional)" placeholder="contoh: Wakil Bendahara" value={f.jabatan} onChange={e => setF({ ...f, jabatan: e.target.value })} />
    <label className="f"><input type="checkbox" checked={f.aktif} onChange={e => setF({ ...f, aktif: e.target.checked })} /> Akun aktif</label>
    {!['admin', 'ketum'].includes(f.role) && <label className="f"><input type="checkbox" checked={f.mk} onChange={e => setF({ ...f, mk: e.target.checked })} /> Boleh membuat &amp; mengubah Maklumat Jumat</label>}
    <div className="kecil" style={{ marginTop: 8 }}><b>Hak akses:</b> Ketua Umum = approve pengajuan & kelola pengurus · Bendahara = cairkan dana, terima keropak & iuran, transaksi kas · Ketua Bidang = ajukan anggaran & konfirmasi terima · Petugas/Sekretaris = setor keropak & catat iuran · Admin = kelola pengurus. Maklumat Jumat dibuat oleh Admin, Ketum, dan pengurus yang dicentang. Semua pengurus bisa melihat laporan.</div>
    <div className="aksi"><Btn onClick={simpan}>Simpan</Btn></div>
  </>;
}

function FormBidang({ b }) {
  const a = useApp();
  const [f, setF] = useState({ nama: b?.nama || '', aktif: b ? b.aktif : true });
  const simpan = async () => {
    const d = { nama: f.nama.trim(), aktif: f.aktif };
    if (!d.nama) return a.toast('Nama wajib diisi', true);
    await q(b ? sb().from('bidang').update(d).eq('id', b.id) : sb().from('bidang').insert(d));
    await a.muatBidang(); a.closeModal(); a.toast('Tersimpan'); a.refresh();
  };
  return <>
    <Field id="bNama" label="Nama bidang" value={f.nama} onChange={e => setF({ ...f, nama: e.target.value })} />
    <label className="f"><input type="checkbox" checked={f.aktif} onChange={e => setF({ ...f, aktif: e.target.checked })} /> Aktif</label>
    <div className="aksi"><Btn onClick={simpan}>Simpan</Btn></div>
  </>;
}

const NAMA_HAL = { beranda: 'Beranda', pengajuan: 'Pengajuan', keropak: 'Keropak', iuran: 'Iuran', kas: 'Kas', intransit: 'Intransit', maklumat: 'Maklumat', kelola: 'Kelola' };
const ONLINE_MS = 150000; // dianggap online kalau ping terakhir < 2,5 menit lalu (ping tiap 1 menit saat layar terbuka)

function lalu(t) {
  const d = Math.max(0, Math.round((Date.now() - new Date(t)) / 1000));
  if (d < 60) return 'baru saja';
  if (d < 3600) return Math.round(d / 60) + ' menit lalu';
  if (d < 86400) return Math.round(d / 3600) + ' jam lalu';
  return Math.round(d / 86400) + ' hari lalu';
}
function durasi(a, b) {
  const m = Math.max(0, Math.round((new Date(b) - new Date(a)) / 60000));
  return m < 60 ? m + ' mnt' : Math.floor(m / 60) + ' jam ' + (m % 60) + ' mnt';
}

function Aktivitas() {
  const a = useApp();
  const [tick, setTick] = useState(0);
  useEffect(() => { const iv = setInterval(() => setTick(t => t + 1), 30000); return () => clearInterval(iv); }, []);
  const s = useLoad(() => q(sb().from('sesi_aplikasi').select('*').order('terakhir_aktif', { ascending: false }).limit(100)), [tick, a.refreshKey]);
  if (!s.data) return <Loading s={s} />;
  const sekarang = Date.now();
  const online = s.data.filter(x => sekarang - new Date(x.terakhir_aktif) < ONLINE_MS);
  const orang = id => { const p = a.prof[id]; return (p?.nama || '—') + (p?.no_rumah ? ' · Rumah ' + p.no_rumah : ''); };
  return <>
    <p className="kecil">Tercatat otomatis setiap kali ada yang membuka aplikasi setelah login. Layar yang sedang terbuka dihitung online; diperbarui tiap 30 detik. Pengunjung yang belum login tidak tercatat.</p>
    <div className="baris-flex"><h3 className="spasi">Sedang online ({online.length})</h3>
      <button className="btn sek kecil" onClick={() => setTick(t => t + 1)}>Muat ulang</button></div>
    {online.length ? online.map(x => <div className="kartu" key={x.id}>
      <b>{orang(x.user_id)}</b>
      <div className="kecil">Sedang buka: {NAMA_HAL[x.halaman] || x.halaman || '—'} · aktif {lalu(x.terakhir_aktif)}</div></div>)
      : <div className="kartu kosong">Tidak ada yang online saat ini</div>}
    <h3>Riwayat kunjungan terakhir</h3>
    {s.data.length ? s.data.map(x => <div className="kartu" key={x.id}>
      <div className="baris-flex"><b className="spasi">{orang(x.user_id)}</b><span className="kecil">{durasi(x.mulai, x.terakhir_aktif)}</span></div>
      <div className="kecil">Masuk {jam(x.mulai)} · halaman terakhir: {NAMA_HAL[x.halaman] || x.halaman || '—'}</div></div>)
      : <div className="kartu kosong">Belum ada kunjungan tercatat</div>}
  </>;
}
