'use client';
import { IK, useApp } from './ui';
import { IK_LAPORAN } from './Laporan';

const WARNA = { keropak: 'c1', maklumat: 'c2', zakat: 'c1', iuran: 'c3', pengajuan: 'c4', ambulans: 'c2', laporan: 'c3', kas: 'c1', jadwal: 'c1', intransit: 'c3', qurban: 'c4', inventaris: 'c3', kelola: 'c4' };
const LABEL = { keropak: 'Keropak', maklumat: 'Maklumat', zakat: 'Zakat', iuran: 'Iuran', pengajuan: 'Pengajuan', ambulans: 'Ambulans', laporan: 'Laporan', kas: 'Kas', jadwal: 'Jadwal', intransit: 'Intransit', qurban: 'Qurban', inventaris: 'Inventaris', kelola: 'Kelola' };

export function Ikon({ k }) {
  if (k === 'maklumat') return <span className="emo">📒</span>;
  return <span dangerouslySetInnerHTML={{ __html: k === 'laporan' ? IK_LAPORAN : IK[k] }} style={{ display: 'contents' }} />;
}

function Tile({ k, label, onClick, badge }) {
  return (
    <button className="mn" onClick={onClick}>
      <span className={'ic ' + (WARNA[k] || 'c1')}><Ikon k={k} /></span>
      {label || LABEL[k]}
      {badge ? <span className="dot">{badge}</span> : null}
    </button>
  );
}

export function SemuaMenu() {
  const a = useApp();
  const ada = k => a.menu.some(m => m[0] === k);
  const grup = [
    ['Keuangan', ['kas', 'pengajuan', 'intransit', 'laporan', 'keropak', 'iuran', 'zakat', 'ambulans']],
    ['Kegiatan & Info', ['maklumat', 'jadwal', 'qurban', 'inventaris']],
    ['Admin', ['kelola']]
  ];
  const buka = k => { a.closeModal(); a.go(k); };
  return <>{grup.map(([t, ks]) => ks.some(ada) && (
    <div key={t}><h4 className="mn-judul">{t}</h4>
      <div className="mn-grid">{ks.filter(ada).map(k => <Tile key={k} k={k} badge={a.badge[k]} onClick={() => buka(k)} />)}</div></div>
  ))}</>;
}

export default function GridMenu() {
  const a = useApp();
  const ada = k => a.menu.some(m => m[0] === k);
  const utama = ['keropak', 'maklumat', 'zakat', 'iuran', 'pengajuan', 'ambulans', 'laporan'].filter(k => k === 'keropak' || k === 'zakat' || ada(k));
  const aksi = {
    keropak: () => a.go('keropak'),
    zakat: () => a.go('zakat', 'terima')
  };
  return (
    <div className="mn-grid">
      {utama.map(k => <Tile key={k} k={k} badge={a.badge[k]} onClick={aksi[k] || (() => a.go(k))} />)}
      <button className="mn" onClick={() => a.openModal('Semua Menu', <SemuaMenu />)}>
        <span className="ic abu"><svg viewBox="0 0 24 24" fill="currentColor"><circle cx="7" cy="7" r="2" /><circle cx="17" cy="7" r="2" /><circle cx="7" cy="17" r="2" /><circle cx="17" cy="17" r="2" /></svg></span>Lihat semua
      </button>
    </div>
  );
}
