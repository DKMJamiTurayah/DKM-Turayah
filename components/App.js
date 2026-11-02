'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { sb, q } from '@/lib/supabase';
import { NAMA_DKM, ROLE, pendek, pesanError } from '@/lib/util';
import { AppCtx, IK, LogoMasjid } from './ui';
import Login from './Login';
import Beranda from './Beranda';
import Pengajuan from './Pengajuan';
import Keropak from './Keropak';
import Iuran from './Iuran';
import Kas from './Kas';
import Kelola from './Kelola';
import Maklumat from './Maklumat';
import Akun from './Akun';

const HALAMAN = { beranda: Beranda, pengajuan: Pengajuan, keropak: Keropak, iuran: Iuran, kas: Kas, maklumat: Maklumat, kelola: Kelola };

// daftar tugas yang menunggu tindakan user ini (dipakai di beranda & badge menu)
export async function tugasSaya(me) {
  const t = [], punya = (...r) => r.includes(me.role);
  const hit = async (tabel, f) => {
    const { count } = await f(sb().from(tabel).select('id', { count: 'exact', head: true }));
    return count || 0;
  };
  if (punya('ketum')) {
    const n = await hit('pengajuan', x => x.eq('status', 'diajukan'));
    if (n) t.push({ n, teks: 'Pengajuan anggaran menunggu approval Anda', ke: 'pengajuan', sub: 'diajukan' });
  }
  if (punya('bendahara')) {
    const a = await hit('pengajuan', x => x.eq('status', 'disetujui'));
    if (a) t.push({ n: a, teks: 'Pengajuan sudah di-approve Ketum, siap dicairkan', ke: 'pengajuan', sub: 'disetujui' });
    const b = await hit('keropak_jumat', x => x.eq('status', 'menunggu'));
    if (b) t.push({ n: b, teks: 'Setoran keropak Jumat menunggu diterima', ke: 'keropak' });
    const c = await hit('iuran', x => x.eq('status', 'belum_setor'));
    if (c) t.push({ n: c, teks: 'Pembayaran iuran warga belum disetor ke Anda', ke: 'iuran', sub: 'setoran' });
  }
  if (punya('ketua_bidang')) {
    const n = await hit('pengajuan', x => x.eq('status', 'dicairkan').eq('bidang_id', me.bidang_id));
    if (n) t.push({ n, teks: 'Dana sudah dicairkan — klik "Sudah Diterima"', ke: 'pengajuan', sub: 'dicairkan' });
  }
  if (!punya('bendahara')) {
    const n = await hit('iuran', x => x.eq('status', 'belum_setor').eq('dicatat_by', me.id));
    if (n) t.push({ n, teks: 'Iuran warga yang Anda pegang belum disetor ke Bendahara', ke: 'iuran', sub: 'setoran' });
  }
  return t;
}

export default function App() {
  const [status, setStatus] = useState('loading');   // loading | config | login | pending | ok
  const [me, setMe] = useState(null);
  const [prof, setProf] = useState({});
  const [bid, setBid] = useState({});
  const [hal, setHal] = useState('beranda');
  const [sub, setSubS] = useState({});
  const [refreshKey, setRK] = useState(0);
  const [modal, setModal] = useState(null);
  const [toastS, setToastS] = useState(null);
  const [badge, setBadge] = useState({});
  const timer = useRef();

  const toast = useCallback((msg, err) => {
    setToastS({ msg, err });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToastS(null), err ? 4500 : 2500);
  }, []);

  const muatBidang = useCallback(async () => {
    const bids = await q(sb().from('bidang').select('*').order('id'));
    const m = {}; bids.forEach(b => m[b.id] = b); setBid(m);
  }, []);

  const muatSaya = useCallback(async uid => {
    const [profs] = await Promise.all([q(sb().from('profiles').select('*')), muatBidang()]);
    const m = {}; profs.forEach(p => m[p.id] = p); setProf(m);
    const saya = m[uid];
    if (!saya) throw new Error('Profil tidak ditemukan. Pastikan migration sudah dijalankan.');
    setMe(saya);
    setStatus(saya.role === 'pending' || !saya.aktif ? 'pending' : 'ok');
  }, [muatBidang]);

  useEffect(() => {
    (async () => {
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return setStatus('config');
      try {
        const T = window.__DKM_TEST__;
        if (T) return await muatSaya(T.uid);
        const { data: { session } } = await sb().auth.getSession();
        if (!session) return setStatus('login');
        await muatSaya(session.user.id);
      } catch (e) { toast(pesanError(e), true); setStatus('login'); }
    })();
    const { data } = sb().auth.onAuthStateChange(ev => { if (ev === 'SIGNED_OUT') setStatus('login'); });
    return () => data.subscription.unsubscribe();
  }, [muatSaya, toast]);

  useEffect(() => {
    if (status !== 'ok' || !me) return;
    tugasSaya(me).then(t => { const per = {}; t.forEach(x => per[x.ke] = (per[x.ke] || 0) + x.n); setBadge(per); }).catch(() => {});
  }, [status, me, refreshKey]);

  const punya = (...r) => !!me && r.includes(me.role);
  const keluar = async () => { if (!window.__DKM_TEST__) await sb().auth.signOut(); setMe(null); setStatus('login'); };
  const menu = [['beranda', 'Beranda'], ['pengajuan', 'Pengajuan'], ['keropak', 'Keropak'], ['iuran', 'Iuran'], ['kas', 'Kas'], ['maklumat', 'Maklumat']];
  if (punya('admin', 'ketum')) menu.push(['kelola', 'Kelola']);

  const ctx = {
    me, prof, bid, punya, toast, refreshKey, sub, muatSaya, muatBidang, keluar, tugasSaya,
    setProf,
    nm: id => id ? (prof[id]?.nama || '—') : '—',
    bn: id => bid[id]?.nama || '—',
    openModal: (judul, isi) => setModal({ judul, isi }),
    closeModal: () => setModal(null),
    refresh: () => setRK(k => k + 1),
    setSub: (h, v) => setSubS(x => ({ ...x, [h]: v })),
    go: (h, s) => { if (s !== undefined) setSubS(x => ({ ...x, [h]: s })); setHal(h); window.scrollTo(0, 0); }
  };

  let isi;
  if (status === 'loading') isi = <div className="loading">Memuat…</div>;
  else if (status === 'config') isi = <div className="kartu kosong" style={{ margin: 20 }}>Isi dulu Environment Variables NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY (lihat PANDUAN_SETUP.md)</div>;
  else if (status === 'login') isi = <Login />;
  else if (status === 'pending') isi = (
    <div className="login"><div className="box" style={{ textAlign: 'center' }}>
      <div className="logo-bulat"><LogoMasjid size={44} /></div>
      <h2>Assalamu&apos;alaikum, {me.nama}</h2>
      <p>{me.aktif ? <>Akun Anda sudah terdaftar dan <b>menunggu Admin / Ketua Umum</b> mengatur jabatan.</> : <>Akun Anda <b>dinonaktifkan</b>. Hubungi Admin.</>}</p>
      <button className="btn penuh" onClick={() => muatSaya(me.id).catch(e => toast(pesanError(e), true))}>Cek lagi</button>
      <button className="btn sek penuh" style={{ marginTop: 8 }} onClick={keluar}>Keluar</button>
    </div></div>);
  else {
    const h = menu.some(m => m[0] === hal) ? hal : 'beranda';
    const Hal = HALAMAN[h];
    isi = <>
      <header className="top">
        <div className="logo"><LogoMasjid /></div>
        <div className="judul"><b>{NAMA_DKM}</b>
          <span>{me.nama} · {me.jabatan || ROLE[me.role]}{me.role === 'ketua_bidang' ? ' · ' + pendek(ctx.bn(me.bidang_id)) : ''}</span></div>
        <button onClick={() => ctx.openModal('Akun Saya', <Akun />)}>Akun</button>
      </header>
      <main id="hal"><Hal key={h} /></main>
      <nav className="bawah"><div className="in">
        {menu.map(([k, l]) => (
          <button key={k} id={'nav-' + k} className={h === k ? 'on' : ''} onClick={() => ctx.go(k)}>
            <span dangerouslySetInnerHTML={{ __html: IK[k] }} style={{ display: 'contents' }} />
            <span>{l}</span>{badge[k] ? <span className="dot">{badge[k]}</span> : null}
          </button>))}
      </div></nav>
    </>;
  }

  return (
    <AppCtx.Provider value={ctx}>
      {isi}
      {modal && (
        <div id="modal" className="modal" onClick={e => { if (e.target === e.currentTarget) setModal(null); }}>
          <div className="sheet">
            <div className="sheet-h"><b>{modal.judul}</b><button onClick={() => setModal(null)} aria-label="Tutup">✕</button></div>
            <div id="mIsi">{modal.isi}</div>
          </div>
        </div>)}
      <div id="toast" className={toastS ? 'on' + (toastS.err ? ' err' : '') : ''}>{toastS?.msg}</div>
    </AppCtx.Provider>
  );
}
