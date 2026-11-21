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
import Intransit from './Intransit';
import Ambulans from './Ambulans';
import Kelola from './Kelola';
import Maklumat from './Maklumat';
import Akun from './Akun';
import Jadwal from './Jadwal';
import Zakat from './Zakat';
import Qurban from './Qurban';
import Inventaris from './Inventaris';
import InfoBerjalan from './InfoBerjalan';
import { SemuaMenu } from './MenuGrid';
import Laporan, { IK_LAPORAN } from './Laporan';

const HALAMAN = { beranda: Beranda, jadwal: Jadwal, pengajuan: Pengajuan, keropak: Keropak, iuran: Iuran, kas: Kas, laporan: Laporan, intransit: Intransit, ambulans: Ambulans, maklumat: Maklumat, zakat: Zakat, qurban: Qurban, inventaris: Inventaris, kelola: Kelola };

// daftar tugas yang menunggu tindakan user ini (dipakai di beranda & badge menu)
// auto logout: keluar sendiri kalau tidak ada aktivitas selama 15 menit
const BATAS_DIAM = 15 * 60 * 1000;
const KUNCI_AKTIF = 'dkm_terakhir_aktif';
const bacaAktif = () => { try { return +localStorage.getItem(KUNCI_AKTIF) || 0; } catch { return 0; } };
const tulisAktif = t => { try { localStorage.setItem(KUNCI_AKTIF, String(t)); } catch {} };
const hapusAktif = () => { try { localStorage.removeItem(KUNCI_AKTIF); } catch {} };

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
  if (punya('ketum', 'admin')) {
    const amb = await hit('ambulans_tahap', x => x.eq('status', 'diajukan'));
    if (amb) t.push({ n: amb, teks: 'Pengajuan Ambulans menunggu approval Anda', ke: 'ambulans' });
  }
  if (punya('bendahara')) {
    const dana = await hit('ambulans_tahap', x => x.eq('status', 'menunggu_dana'));
    if (dana) t.push({ n: dana, teks: 'Saldo pos Ambulans kurang, perlu dana dari Bendahara', ke: 'ambulans' });
  }
  if (punya('bendahara')) {
    const a = await hit('pengajuan', x => x.eq('status', 'disetujui'));
    if (a) t.push({ n: a, teks: 'Pengajuan sudah di-approve Ketum, siap dicairkan', ke: 'pengajuan', sub: 'disetujui' });
    const b = await hit('keropak_jumat', x => x.eq('status', 'menunggu'));
    if (b) t.push({ n: b, teks: 'Setoran keropak Jumat menunggu diterima', ke: 'keropak' });
    const c = await hit('iuran', x => x.eq('status', 'belum_setor'));
    if (c) t.push({ n: c, teks: 'Pembayaran iuran warga belum disetor ke Anda', ke: 'iuran', sub: 'setoran' });
  }
  if (punya('bendahara')) {
    const d = await hit('intransit', x => x.eq('status', 'diserahkan'));
    if (d) t.push({ n: d, teks: 'Uang kembalian sudah diserahkan — klik \"Terima\" setelah uang di tangan Anda', ke: 'intransit' });
  }
  {
    const d = await hit('intransit', x => x.eq('status', 'menunggu').eq('dicatat_by', me.id));
    if (d) t.push({ n: d, teks: 'Uang kembalian siap diserahkan ke Bendahara — klik \"Sudah Saya Serahkan\"', ke: 'intransit' });
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
  const [akses, setAkses] = useState(null);   // null = belum dimuat / belum ada tabel akses (jangan menyembunyikan apa pun)
  const timer = useRef();
  const sesiRef = useRef(null);
  const halRef = useRef('beranda');

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
        const last = bacaAktif();
        if (last && Date.now() - last > BATAS_DIAM) {
          await sb().auth.signOut(); hapusAktif();
          toast('Sesi berakhir karena tidak aktif lebih dari 15 menit. Silakan masuk lagi.', true);
          return setStatus('login');
        }
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

  // pos dana yang boleh dilihat user ini (Admin/Ketum/Bendahara = semua)
  useEffect(() => {
    if (status !== 'ok' || !me) return;
    if (['admin', 'ketum', 'bendahara'].includes(me.role)) return setAkses({ penuh: true, nama: [] });
    Promise.all([q(sb().from('akses_pos').select('pos_id').eq('user_id', me.id)), q(sb().from('pos_dana').select('id,nama'))])
      .then(([a, p]) => { const ids = new Set(a.map(x => x.pos_id)); setAkses({ penuh: false, nama: p.filter(x => ids.has(x.id)).map(x => (x.nama || '').toLowerCase()) }); })
      .catch(() => setAkses(null));
  }, [status, me, refreshKey]);
  const keluar = async () => { if (!window.__DKM_TEST__) await sb().auth.signOut(); hapusAktif(); setModal(null); setMe(null); setStatus('login'); };
  const autoKeluar = useCallback(async () => {
    try { await sb().auth.signOut(); } catch {}
    hapusAktif(); setModal(null); setMe(null); setStatus('login');
    toast('Anda otomatis keluar karena tidak aktif 15 menit. Silakan masuk lagi.', true);
  }, [toast]);

  // pantau aktivitas; ping hanya dihitung dari sentuhan/ketikan user, bukan dari proses otomatis
  useEffect(() => {
    if ((status !== 'ok' && status !== 'pending') || window.__DKM_TEST__) return;
    let last = Date.now(), tulis = 0;
    tulisAktif(last);
    const aktif = () => { last = Date.now(); if (last - tulis > 10000) { tulis = last; tulisAktif(last); } };
    const cek = () => { if (Date.now() - Math.max(last, bacaAktif()) > BATAS_DIAM) autoKeluar(); };
    const lihat = () => { if (document.visibilityState === 'visible') cek(); };
    const ev = ['pointerdown', 'keydown', 'scroll', 'touchstart', 'mousemove'];
    ev.forEach(e => window.addEventListener(e, aktif, { passive: true }));
    document.addEventListener('visibilitychange', lihat);
    const iv = setInterval(cek, 15000);
    return () => { ev.forEach(e => window.removeEventListener(e, aktif)); document.removeEventListener('visibilitychange', lihat); clearInterval(iv); };
  }, [status, autoKeluar]);

  // rekam sesi: siapa yang membuka aplikasi, halaman terakhir, dan kapan terakhir aktif
  const kirimPing = useCallback(() => {
    if (!sesiRef.current || document.visibilityState !== 'visible') return;
    sb().rpc('ping_sesi', { p_id: sesiRef.current, p_halaman: halRef.current }).then(() => {}, () => {});
  }, []);
  useEffect(() => {
    if ((status !== 'ok' && status !== 'pending') || !me?.id || window.__DKM_TEST__) return;
    let hidup = true;
    sb().rpc('mulai_sesi', { p_perangkat: navigator.userAgent }).then(({ data, error }) => {
      if (!hidup || error) return;      // kalau migration 003 belum dijalankan, diam saja
      sesiRef.current = data; kirimPing();
    }, () => {});
    const iv = setInterval(kirimPing, 60000);
    return () => { hidup = false; sesiRef.current = null; clearInterval(iv); };
  }, [status, me?.id, kirimPing]);
  useEffect(() => { halRef.current = hal; kirimPing(); }, [hal, kirimPing]);
  const UTAMA = ['beranda', 'kas', 'iuran', 'laporan'];
  const menu = [['beranda', 'Beranda'], ['jadwal', 'Jadwal'], ['pengajuan', 'Pengajuan'], ['keropak', 'Keropak'], ['iuran', 'Iuran'], ['kas', 'Kas'], ['laporan', 'Laporan'], ['intransit', 'Intransit'], ['ambulans', 'Ambulans'], ['maklumat', 'Maklumat'], ['zakat', 'Zakat'], ['qurban', 'Qurban'], ['inventaris', 'Inventaris']];
  if (punya('admin', 'ketum')) menu.push(['kelola', 'Kelola']);
  // menu Ambulans hanya untuk yang punya akses pos Ambulans
  if (akses && !akses.penuh && !akses.nama.some(n => n.includes('ambulans'))) { const i = menu.findIndex(m => m[0] === 'ambulans'); if (i >= 0) menu.splice(i, 1); }

  const ctx = {
    me, prof, bid, punya, akses, toast, menu, badge, refreshKey, sub, muatSaya, muatBidang, keluar, tugasSaya,
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
      <InfoBerjalan muatUlang={refreshKey} />
      <main id="hal"><Hal key={h} /></main>
      <nav className="bawah"><div className="in">
        {menu.filter(([k]) => UTAMA.includes(k)).map(([k, l]) => (
          <button key={k} id={'nav-' + k} className={h === k ? 'on' : ''} onClick={() => ctx.go(k)}>
            <span dangerouslySetInnerHTML={{ __html: k === 'laporan' ? IK_LAPORAN : IK[k] }} style={{ display: 'contents' }} />
            <span>{l}</span>{badge[k] ? <span className="dot">{badge[k]}</span> : null}
          </button>))}
        <button id="nav-menu" className={!UTAMA.includes(h) ? 'on' : ''} onClick={() => ctx.openModal('Semua Menu', <SemuaMenu />)}>
          <svg viewBox="0 0 24 24" fill="currentColor"><circle cx="6" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="18" cy="12" r="1.8" /></svg>
          <span>Menu</span>{menu.filter(([k]) => !UTAMA.includes(k)).reduce((n, [k]) => n + (badge[k] || 0), 0) ? <span className="dot">!</span> : null}
        </button>
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