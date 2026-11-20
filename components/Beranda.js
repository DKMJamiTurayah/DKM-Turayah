'use client';
import { sb, rpc, q } from '@/lib/supabase';
import { BULAN_P, bulanIni, jam, rp } from '@/lib/util';
import { Loading, useApp, useLoad } from './ui';
import { bukaFormPengajuan } from './Pengajuan';
import { FormKeropak } from './Keropak';
import { KartuJadwal } from './Jadwal';
import Struktur from './Struktur';

const WA_ADMIN = '6282113609810'; // +62 821-1360-9810
const labelModul = m => ({ pengajuan: 'pengajuan', keropak: 'keropak Jumat', iuran: 'iuran warga', kas: 'kas', user: 'pengurus', maklumat: 'maklumat Jumat', intransit: 'intransit kembalian', ambulans: 'ambulans', zakat: 'zakat', takjil: 'takjil', qurban: 'qurban', inventaris: 'inventaris' }[m] || m);

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
    <KartuJadwal />
    <h3>Tugas Saya</h3>
    {tugas.length ? tugas.map((t, i) => (
      <div key={i} className="tugas" onClick={() => a.go(t.ke, t.sub)}><div className="n">{t.n}</div><div>{t.teks}</div></div>
    )) : <div className="kartu kosong">Alhamdulillah, tidak ada tugas yang menunggu.</div>}
    <div className="aksi" style={{ marginTop: 4 }}>
      {a.punya('ketua_bidang') && <button className="btn" onClick={() => bukaFormPengajuan(a)}>+ Ajukan Anggaran</button>}
      <button className="btn sek" onClick={() => a.openModal('Setor Keropak Jumat', <FormKeropak />)}>Setor Keropak Jumat</button>
      <button className="btn sek" onClick={() => a.go('maklumat')}>Maklumat Jumat</button>
      <button className="btn sek" onClick={() => a.go('zakat', 'terima')}>Zakat Fitrah &amp; Fidyah</button>
      <a className="btn sek" href={'https://wa.me/?text=' + encodeURIComponent('Info jadwal shalat, maklumat Jumat & laporan keuangan masjid bisa dilihat di sini (tanpa login):\n' + window.location.origin + '/jamaah')} target="_blank" rel="noreferrer">Sebar Link Halaman Jamaah</a>
      {a.punya('petugas', 'bendahara', 'ketum', 'admin', 'sekretaris') &&
        <button className="btn sek" onClick={() => a.go('iuran', 'catat')}>Catat Iuran Warga</button>}
    </div>
    <Struktur />
    <h3>Aktivitas Terakhir</h3>
    <div className="kartu">{log.length ? <div className="timeline">{log.map(l => (
      <div key={l.id}><b>{l.oleh ? a.nm(l.oleh) : 'Warga'}</b> · {labelModul(l.modul)} {l.aksi}{l.catatan && <> — <span className="kecil">{l.catatan}</span></>}<br /><span className="kecil">{jam(l.waktu)}</span></div>
    ))}</div> : <div className="kosong">Belum ada aktivitas</div>}</div>
    <div className="kartu" style={{ marginTop: 16, padding: 16 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <div style={{ flex: 'none', width: 46, height: 46, borderRadius: 14, background: 'var(--hijau-muda)', color: 'var(--hijau)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4 4h11a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H9l-4 3v-3H4a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3z" opacity=".85" /><path d="M20 9a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3v2l-3.5-2H11a3 3 0 0 1-2.6-1.5H15a4 4 0 0 0 4-4V9z" /></svg>
        </div>
        <div><b style={{ fontSize: 16 }}>Request to Admin</b><div className="kecil">Punya masukan atau permintaan untuk pengelolaan kas atau kegiatan masjid? Sampaikan langsung ke Admin melalui WhatsApp.</div></div>
      </div>
      <a className="btn penuh" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 12, textDecoration: 'none', padding: '12px 14px' }} href={'https://wa.me/' + WA_ADMIN + '?text=' + encodeURIComponent('Assalamualaikum Admin, saya ingin mengajukan request:\n\n')} target="_blank" rel="noreferrer">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12.04 2a9.9 9.9 0 0 0-8.5 14.9L2 22l5.25-1.5A9.9 9.9 0 1 0 12.04 2zm0 18.1a8.2 8.2 0 0 1-4.2-1.15l-.3-.18-3.1.89.9-3.02-.2-.31a8.2 8.2 0 1 1 6.9 3.77zm4.5-6.15c-.25-.12-1.46-.72-1.69-.8-.22-.08-.39-.12-.55.12-.16.25-.63.8-.78.96-.14.17-.29.18-.53.06a6.7 6.7 0 0 1-3.3-2.88c-.25-.43.25-.4.72-1.33.08-.16.04-.3-.02-.42-.06-.12-.55-1.33-.76-1.82-.2-.48-.4-.41-.55-.42h-.47c-.16 0-.43.06-.65.3-.22.25-.86.84-.86 2.05s.88 2.38 1 2.55c.12.16 1.73 2.64 4.2 3.7 1.55.67 2.16.73 2.94.61.47-.07 1.46-.6 1.66-1.17.2-.58.2-1.07.14-1.18-.06-.1-.22-.16-.47-.28z" /></svg>
        Request to Admin
      </a>
    </div>
  </>;
}
