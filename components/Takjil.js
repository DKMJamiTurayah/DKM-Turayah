'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { sb, rpc, q } from '@/lib/supabase';
import { HARI, BULAN, NAMA_DKM, hariIni, pesanError } from '@/lib/util';
import { hitungJadwal, ramadhanTerdekat } from '@/lib/jadwal';
import { AppCtx, Btn, Field, Loading, LogoMasjid, useApp, useLoad } from './ui';

const tglPendek = t => { const d = new Date(t + 'T00:00:00Z'); return `${HARI[d.getUTCDay()].slice(0, 3)}, ${d.getUTCDate()} ${BULAN[d.getUTCMonth()]}`; };
const hijriDari = t => { try { return +new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { year: 'numeric', timeZone: 'UTC' }).format(new Date(t + 'T12:00:00Z')).replace(/\D/g, ''); } catch { return 0; } };

// 30 hari Ramadhan terdekat + jam buka puasa
export function hariTakjil() {
  const r = ramadhanTerdekat(hariIni());
  if (!r.hari.length) return { tahun: 0, hari: [] };
  return { tahun: hijriDari(r.hari[0].tanggal), hari: r.hari.map(h => ({ tanggal: h.tanggal, ke: h.ke, buka: hitungJadwal(h.tanggal).maghrib })) };
}
export const linkPublik = () => (typeof window !== 'undefined' ? window.location.origin : '') + '/takjil';
const kelompok = rows => { const m = {}; rows.forEach(r => (m[r.tanggal] = m[r.tanggal] || []).push(r)); return m; };
const label = r => r.nama + (r.no_rumah ? ' (' + r.no_rumah + ')' : '');

const CSS = `.tk-hari{display:flex;gap:10px;align-items:flex-start}
.tk-ke{flex:none;width:44px;height:44px;border-radius:12px;background:var(--hijau-muda);color:var(--hijau);display:flex;flex-direction:column;align-items:center;justify-content:center;font-weight:800;font-size:17px;line-height:1}
.tk-ke span{font-size:9.5px;font-weight:600}
.tk-kosong .tk-ke{background:#fdf1d6;color:#9a6b00}.tk-penuh .tk-ke{background:#eee;color:#777}
.tk-lewat{opacity:.55}.tk-nama{font-size:13.5px;margin-top:3px}.tk-nama div{margin-top:2px}
.tk-head{background:var(--hijau);color:#fff;padding:18px 16px 16px;display:flex;gap:12px;align-items:center}
.tk-head b{font-size:18px;display:block}.tk-head span{font-size:13px;opacity:.9}
.tk-wrap{max-width:640px;margin:0 auto;padding:12px 12px 40px}`;

// ======================= HALAMAN PUBLIK /takjil (tanpa login) =======================
export function TakjilPublik() {
  const [toastS, setToastS] = useState(null);
  const [modal, setModal] = useState(null);
  const timer = useRef();
  const toast = useCallback((msg, err) => {
    setToastS({ msg, err }); clearTimeout(timer.current);
    timer.current = setTimeout(() => setToastS(null), err ? 5000 : 3000);
  }, []);
  const ctx = { toast, openModal: (judul, isi) => setModal({ judul, isi }), closeModal: () => setModal(null) };
  return <AppCtx.Provider value={ctx}>
    <style>{CSS}</style>
    <IsiPublik />
    {modal && <div className="modal" onClick={e => { if (e.target === e.currentTarget) setModal(null); }}>
      <div className="sheet"><div className="sheet-h"><b>{modal.judul}</b><button onClick={() => setModal(null)} aria-label="Tutup">✕</button></div>{modal.isi}</div></div>}
    <div id="toast" className={toastS ? 'on' + (toastS.err ? ' err' : '') : ''}>{toastS?.msg}</div>
  </AppCtx.Provider>;
}

function IsiPublik() {
  const a = useApp();
  const { tahun, hari } = hariTakjil();
  const [rk, setRk] = useState(0);
  const [s, setS] = useState({ loading: true });
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !tahun) return setS({ err: 'Jadwal belum tersedia' });
    rpc('takjil_publik', { p_tahun: tahun }).then(d => setS({ data: d }), e => setS({ err: pesanError(e) }));
  }, [tahun, rk]);

  const head = <div className="tk-head"><div className="logo"><LogoMasjid size={44} /></div>
    <div><b>Jadwal Takjil Ramadhan {tahun || ''} H</b><span>{NAMA_DKM}</span></div></div>;
  if (!s.data) return <>{head}<div className="tk-wrap"><Loading s={s} /></div></>;

  const { kuota, buka, catatan, daftar } = s.data;
  const per = kelompok(daftar), hi = hariIni();
  const kosong = hari.filter(h => !per[h.tanggal] && h.tanggal >= hi).length;

  const pilih = h => a.openModal(`Ramadhan ke-${h.ke} · ${tglPendek(h.tanggal)}`,
    <FormDaftar tahun={tahun} h={h} publik onOk={() => setRk(k => k + 1)} />);

  return <>{head}<div className="tk-wrap">
    <div className="kartu">
      <b>Mari berbagi takjil buka puasa 🤲</b>
      <div className="kecil" style={{ marginTop: 4 }}>Pilih tanggal yang masih tersedia, lalu isi nama dan nomor rumah. Setiap hari maksimal <b>{kuota} donatur</b>.
        {kosong > 0 && <> Masih ada <b>{kosong} hari kosong</b>.</>}</div>
      {catatan && <div className="kecil" style={{ marginTop: 6, whiteSpace: 'pre-wrap' }}>📌 {catatan}</div>}
    </div>
    {!buka && <div className="kartu" style={{ background: '#fdf1d6' }}><b>Pendaftaran sedang ditutup.</b><div className="kecil">Silakan hubungi pengurus DKM.</div></div>}
    {hari.map(h => <BarisHari key={h.tanggal} h={h} rows={per[h.tanggal] || []} kuota={kuota} hi={hi}
      aksi={buka && h.tanggal >= hi && (per[h.tanggal] || []).length < kuota ? () => pilih(h) : null} />)}
    <p className="kecil" style={{ textAlign: 'center' }}>Ingin membatalkan / mengubah? Hubungi pengurus DKM.</p>
  </div></>;
}

function BarisHari({ h, rows, kuota, hi, aksi, children }) {
  const n = rows.length, penuh = n >= kuota;
  return <div className={'kartu tk-hari' + (h.tanggal < hi ? ' tk-lewat' : !n ? ' tk-kosong' : penuh ? ' tk-penuh' : '')}>
    <div className="tk-ke"><span>KE</span>{h.ke}</div>
    <div className="spasi" style={{ minWidth: 0 }}>
      <div className="baris-flex"><b className="spasi">{tglPendek(h.tanggal)}</b>
        <span className={'badge ' + (!n ? 'b-kuning' : penuh ? 'b-abu' : 'b-hijau')}>{!n ? 'Kosong' : penuh ? 'Penuh' : `${n}/${kuota}`}</span></div>
      <div className="kecil">Buka puasa {h.buka}</div>
      {children || (n > 0 && <div className="tk-nama">{rows.map((r, i) => <div key={i}>• {label(r)}{r.isi ? <span className="kecil"> — {r.isi}</span> : null}</div>)}</div>)}
      {aksi && <div className="aksi" style={{ marginTop: 8 }}><button className="btn kecil" onClick={aksi}>Saya ikut di tanggal ini</button></div>}
    </div>
  </div>;
}

function FormDaftar({ tahun, h, publik, onOk }) {
  const a = useApp();
  const [f, setF] = useState({ nama: '', rumah: '', hp: '', isi: '', porsi: '' });
  const ubah = k => e => setF({ ...f, [k]: e.target.value });
  const kirim = async () => {
    if (f.nama.trim().length < 2) return a.toast('Isi nama', true);
    if (publik && !f.rumah.trim()) return a.toast('Isi nomor rumah', true);
    if (publik && f.hp.replace(/\D/g, '').length < 9) return a.toast('Isi nomor HP/WA yang benar', true);
    await rpc('daftar_takjil', { p_tahun: tahun, p_tanggal: h.tanggal, p_ke: h.ke, p_nama: f.nama, p_no_rumah: f.rumah,
      p_no_hp: f.hp, p_isi: f.isi, p_porsi: parseInt(f.porsi) || null });
    a.closeModal();
    a.toast(publik ? `Jazakallah khairan, ${f.nama.trim()} terdaftar di Ramadhan ke-${h.ke}` : 'Donatur ditambahkan');
    onOk();
  };
  return <>
    <div className="kecil">Buka puasa ± {h.buka} WIB</div>
    <Field id="dNama" label={publik ? 'Nama (yang ditampilkan)' : 'Nama donatur'} placeholder="contoh: Keluarga Pak Ahmad" value={f.nama} onChange={ubah('nama')} autoComplete="name" />
    <Field id="dRumah" label={'Nomor rumah' + (publik ? '' : ' (opsional)')} placeholder="contoh: B2 No. 15" value={f.rumah} onChange={ubah('rumah')} />
    <Field id="dHp" label={'No. HP / WA' + (publik ? ' (tidak ditampilkan)' : ' (opsional)')} inputMode="tel" value={f.hp} onChange={ubah('hp')} autoComplete="tel" />
    <Field id="dIsi" label="Rencana takjil (opsional)" placeholder="contoh: kolak, gorengan, nasi kotak" value={f.isi} onChange={ubah('isi')} />
    <Field id="dPorsi" label="Perkiraan porsi (opsional)" type="number" inputMode="numeric" value={f.porsi} onChange={ubah('porsi')} />
    <div className="aksi"><Btn onClick={kirim}>{publik ? 'Daftar' : 'Tambahkan'}</Btn></div>
    {publik && <p className="kecil">Nomor HP hanya dilihat pengurus untuk koordinasi.</p>}
  </>;
}

// ======================= TAB PENGURUS (di menu Jadwal) =======================
export default function TakjilPengurus() {
  const a = useApp();
  const { tahun, hari } = hariTakjil();
  const kelola = a.punya('admin', 'ketum') || !!a.me?.boleh_maklumat;
  const s = useLoad(async () => {
    const [set, rows] = await Promise.all([
      q(sb().from('takjil_setting').select('*').eq('tahun', tahun).maybeSingle()),
      q(sb().from('takjil').select('*').eq('tahun', tahun).order('id'))
    ]);
    return { set: set || { tahun, kuota: 2, buka: true, catatan: '' }, rows };
  }, [a.refreshKey, tahun]);
  if (!tahun) return <div className="kartu kosong">Jadwal Ramadhan belum tersedia.</div>;
  if (!s.data) return <Loading s={s} />;

  const { set, rows } = s.data, per = kelompok(rows), hi = hariIni();
  const terisi = hari.filter(h => per[h.tanggal]).length;
  const link = linkPublik();

  const ajak = `*Jadwal Takjil Ramadhan ${tahun} H*\n${NAMA_DKM}\n\nBapak/Ibu yang ingin berbagi takjil buka puasa, silakan pilih tanggalnya di link berikut (tanpa login):\n${link}\n\nSetiap hari maksimal ${set.kuota} donatur. Jazakumullahu khairan.`;
  const rekap = `*Jadwal Takjil Ramadhan ${tahun} H*\n${NAMA_DKM}\n\n` +
    hari.map(h => `${h.ke}. ${tglPendek(h.tanggal)}: ${per[h.tanggal] ? per[h.tanggal].map(label).join(', ') : '_(kosong)_'}`).join('\n') +
    `\n\nDaftar / lihat jadwal: ${link}`;
  const hapus = async r => {
    if (!confirm(`Hapus ${r.nama} dari Ramadhan ke-${r.ke}?`)) return;
    const { error } = await sb().from('takjil').delete().eq('id', r.id);
    if (error) throw error;
    a.toast('Dihapus'); a.refresh();
  };

  return <>
    <style>{CSS}</style>
    <div className="kartu">
      <b>Takjil Ramadhan {tahun} H</b>
      <div className="kecil">{terisi} dari {hari.length} hari sudah ada donatur · {rows.length} pendaftar · kuota {set.kuota}/hari · pendaftaran {set.buka ? 'DIBUKA' : 'DITUTUP'}</div>
      <div className="kecil" style={{ marginTop: 6, wordBreak: 'break-all' }}>Link warga: <a href={link} target="_blank" rel="noreferrer">{link}</a></div>
      <div className="aksi">
        <a className="btn" href={'https://wa.me/?text=' + encodeURIComponent(ajak)} target="_blank" rel="noreferrer">Sebar Link ke WA</a>
        <a className="btn sek" href={'https://wa.me/?text=' + encodeURIComponent(rekap)} target="_blank" rel="noreferrer">Rekap ke WA</a>
      </div>
      {kelola && <div className="aksi"><button className="btn sek" onClick={() => a.openModal('Pengaturan Takjil', <FormSetting set={set} tahun={tahun} />)}>Pengaturan (kuota, buka/tutup)</button></div>}
    </div>
    {hari.map(h => {
      const r = per[h.tanggal] || [];
      return <BarisHari key={h.tanggal} h={h} rows={r} kuota={set.kuota} hi={hi}>
        {r.map(x => <div key={x.id} className="tk-nama baris-flex" style={{ alignItems: 'flex-start' }}>
          <div className="spasi">• <b>{label(x)}</b>{x.isi ? ' — ' + x.isi : ''}{x.porsi ? ` (${x.porsi} porsi)` : ''}
            <div className="kecil">{x.no_hp ? <a href={'https://wa.me/' + x.no_hp.replace(/^0/, '62')} target="_blank" rel="noreferrer">{x.no_hp}</a> : 'tanpa HP'} · {x.sumber === 'warga' ? 'daftar sendiri' : 'dicatat ' + a.nm(x.dibuat_by)}</div></div>
          {kelola && <Btn className="btn merah-sek kecil" style={{ flex: 'none' }} onClick={() => hapus(x)}>Hapus</Btn>}
        </div>)}
        <div style={{ marginTop: 6 }}><button className="btn sek kecil" onClick={() => a.openModal(`Tambah Donatur · Ramadhan ke-${h.ke}`,
          <FormDaftar tahun={tahun} h={h} onOk={a.refresh} />)}>+ Tambah manual</button></div>
      </BarisHari>;
    })}
  </>;
}

function FormSetting({ set, tahun }) {
  const a = useApp();
  const [f, setF] = useState({ kuota: set.kuota, buka: set.buka, catatan: set.catatan || '' });
  const simpan = async () => {
    const k = parseInt(f.kuota);
    if (!(k >= 1 && k <= 20)) return a.toast('Kuota 1–20 donatur per hari', true);
    const { error } = await sb().from('takjil_setting').upsert({ tahun, kuota: k, buka: f.buka, catatan: f.catatan.trim() || null, diubah_by: a.me.id, diubah_at: new Date().toISOString() });
    if (error) throw error;
    a.closeModal(); a.toast('Pengaturan tersimpan'); a.refresh();
  };
  return <>
    <Field id="tsK" label="Maksimal donatur per hari" type="number" min="1" max="20" value={f.kuota} onChange={e => setF({ ...f, kuota: e.target.value })} />
    <label className="f" style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12 }}>
      <input type="checkbox" checked={f.buka} onChange={e => setF({ ...f, buka: e.target.checked })} /> Pendaftaran warga dibuka</label>
    <label className="f" htmlFor="tsC">Catatan untuk warga (opsional)</label>
    <textarea className="f" id="tsC" placeholder="contoh: Takjil diantar ke masjid paling lambat ba'da Ashar" value={f.catatan} onChange={e => setF({ ...f, catatan: e.target.value })} />
    <div className="aksi"><Btn onClick={simpan}>Simpan</Btn></div>
    <p className="kecil">Pengurus tetap bisa menambah manual walaupun kuota penuh atau pendaftaran ditutup.</p>
  </>;
}
