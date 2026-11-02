'use client';
import { sb, rpc, q } from '@/lib/supabase';
import { BULAN_P, bulanIni, jam, rp } from '@/lib/util';
import { Loading, useApp, useLoad } from './ui';
import { bukaFormPengajuan } from './Pengajuan';
import { FormKeropak } from './Keropak';

const labelModul = m => ({ pengajuan: 'pengajuan', keropak: 'keropak Jumat', iuran: 'iuran warga', kas: 'kas', user: 'pengurus', maklumat: 'maklumat Jumat' }[m] || m);

export default function Beranda() {
  const a = useApp();
  const s = useLoad(async () => {
    const [saldo, kasBln, tugas, log] = await Promise.all([
      rpc('saldo_kas'),
      q(sb().from('kas').select('jenis,jumlah').gte('tanggal', bulanIni() + '-01')),
      a.tugasSaya(a.me),
      q(sb().from('log_aktivitas').select('*').order('id', { ascending: false }).limit(8))
    ]);
    const masuk = kasBln.filter(k => k.jenis === 'masuk').reduce((x, k) => x + +k.jumlah, 0);
    const keluar = kasBln.filter(k => k.jenis === 'keluar').reduce((x, k) => x + +k.jumlah, 0);
    return { saldo, masuk, keluar, tugas, log };
  }, [a.refreshKey]);
  if (!s.data) return <Loading s={s} />;
  const { saldo, masuk, keluar, tugas, log } = s.data;
  const bln = BULAN_P[+bulanIni().slice(5) - 1];

  return <>
    <div className="kartu saldo">
      <svg className="hiasan" width="150" height="150" viewBox="0 0 64 64"><path d="M32 8c-9 7-15 12-15 21h30c0-9-6-14-15-21z" fill="#fff" /><rect x="15" y="29" width="34" height="23" fill="#fff" /></svg>
      <div className="lbl">Saldo Kas DKM</div><div className="angka">{rp(saldo)}</div>
      <div className="baris"><div>Masuk {bln}<b>{rp(masuk)}</b></div><div>Keluar {bln}<b>{rp(keluar)}</b></div></div>
    </div>
    <h3>Tugas Saya</h3>
    {tugas.length ? tugas.map((t, i) => (
      <div key={i} className="tugas" onClick={() => a.go(t.ke, t.sub)}><div className="n">{t.n}</div><div>{t.teks}</div></div>
    )) : <div className="kartu kosong">Alhamdulillah, tidak ada tugas yang menunggu.</div>}
    <div className="aksi" style={{ marginTop: 4 }}>
      {a.punya('ketua_bidang') && <button className="btn" onClick={() => bukaFormPengajuan(a)}>+ Ajukan Anggaran</button>}
      <button className="btn sek" onClick={() => a.openModal('Setor Keropak Jumat', <FormKeropak />)}>Setor Keropak Jumat</button>
      <button className="btn sek" onClick={() => a.go('maklumat')}>Maklumat Jumat</button>
      {a.punya('petugas', 'bendahara', 'ketum', 'admin', 'sekretaris') &&
        <button className="btn sek" onClick={() => a.go('iuran', 'catat')}>Catat Iuran Warga</button>}
    </div>
    <h3>Aktivitas Terakhir</h3>
    <div className="kartu">{log.length ? <div className="timeline">{log.map(l => (
      <div key={l.id}><b>{a.nm(l.oleh)}</b> · {labelModul(l.modul)} {l.aksi}{l.catatan && <> — <span className="kecil">{l.catatan}</span></>}<br /><span className="kecil">{jam(l.waktu)}</span></div>
    ))}</div> : <div className="kosong">Belum ada aktivitas</div>}</div>
  </>;
}
