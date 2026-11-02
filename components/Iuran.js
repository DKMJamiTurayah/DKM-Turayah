'use client';
import { useState } from 'react';
import { sb, rpc, q } from '@/lib/supabase';
import { BULAN, BULAN_P, angka, hariIni, jam, periode, rp, tgl, unduhCSV } from '@/lib/util';
import { Btn, Chips, Field, InputRp, Loading, useApp, useLoad } from './ui';

const PENCATAT = ['petugas', 'bendahara', 'ketum', 'admin', 'sekretaris'];

export default function Iuran() {
  const a = useApp();
  const bisaCatat = a.punya(...PENCATAT);
  const tab = a.sub.iuran || (bisaCatat ? 'catat' : 'rekap');
  const [th, setTh] = useState(+hariIni().slice(0, 4));
  const s = useLoad(() => q(sb().from('warga').select('*').order('nama')), [a.refreshKey]);
  const tabs = [['rekap', 'Rekap'], ['setoran', 'Setoran'], ['warga', 'Data Warga']];
  if (bisaCatat) tabs.unshift(['catat', 'Catat Bayar']);

  return <>
    <h2>Iuran Bulanan Warga</h2>
    <Chips items={tabs} value={tab} onChange={k => a.setSub('iuran', k)} />
    {!s.data ? <Loading s={s} /> :
      tab === 'catat' ? <Catat warga={s.data} th={th} setTh={setTh} /> :
      tab === 'rekap' ? <Rekap warga={s.data} th={th} setTh={setTh} /> :
      tab === 'setoran' ? <Setoran warga={s.data} /> : <DataWarga warga={s.data} />}
  </>;
}

function PilihTahun({ th, setTh, children }) {
  return <div className="baris-flex">
    <button className="btn sek kecil" onClick={() => setTh(th - 1)}>‹</button><b>{children}{th}</b>
    <button className="btn sek kecil" onClick={() => setTh(th + 1)}>›</button>
  </div>;
}

function Catat({ warga, th, setTh }) {
  const a = useApp();
  const aktif = warga.filter(w => w.aktif);
  const [cari, setCari] = useState('');
  const [wid, setWid] = useState(null);
  if (!aktif.length) return <div className="kartu kosong">Belum ada data warga.<br />
    <button className="btn" style={{ marginTop: 10 }} onClick={() => a.setSub('iuran', 'warga')}>Tambah Data Warga</button></div>;
  const daftar = aktif.filter(w => (w.nama + ' ' + (w.alamat || '')).toLowerCase().includes(cari.toLowerCase()));
  const w = aktif.find(x => x.id === wid);
  return <div className="kartu">
    <Field id="cariW" label="Cari warga" placeholder="ketik nama / alamat" value={cari} onChange={e => setCari(e.target.value)} />
    <select className="f" id="pilihW" size={5} style={{ marginTop: 6 }} value={wid ?? ''} onChange={e => setWid(+e.target.value)}>
      {daftar.map(x => <option key={x.id} value={x.id}>{x.nama}{x.alamat ? ' — ' + x.alamat : ''}</option>)}
    </select>
    {w && <BayarWarga key={w.id + '-' + th} w={w} th={th} setTh={setTh} />}
  </div>;
}

function BayarWarga({ w, th, setTh }) {
  const a = useApp();
  const [pilih, setPilih] = useState([]);
  const [jml, setJml] = useState(+w.iuran_bulanan || 0);
  const [met, setMet] = useState('Tunai');
  const [rk, setRk] = useState(0);
  const s = useLoad(async () => {
    const d = await q(sb().from('iuran').select('periode,status').eq('warga_id', w.id).like('periode', th + '-%'));
    const m = {}; d.forEach(x => m[x.periode] = x.status); return m;
  }, [w.id, th, rk]);
  const simpan = async () => {
    if (!pilih.length) return a.toast('Pilih bulan yang dibayar', true);
    if (!jml) return a.toast('Isi nominal iuran', true);
    await rpc('catat_iuran', { p_warga: w.id, p_periode: [...pilih].sort(), p_jumlah: jml, p_metode: met });
    a.toast(a.punya('bendahara') ? 'Iuran tercatat & masuk kas' : 'Iuran tercatat. Jangan lupa setor ke Bendahara');
    setPilih([]); setRk(k => k + 1); a.refresh();
  };
  return <div id="bayarW">
    <hr style={{ border: 0, borderTop: '1px solid var(--garis)', margin: '14px 0' }} />
    <div className="baris-flex"><b className="spasi">{w.nama}</b><PilihTahun th={th} setTh={setTh} /></div>
    <div className="kecil">Hijau = lunas · kuning = sudah bayar, belum disetor ke bendahara. Ketuk bulan yang mau dibayar.</div>
    {!s.data ? <Loading s={s} /> : <div className="bulan-grid">{BULAN.map((b, i) => {
      const per = periode(th, i), st = s.data[per], on = pilih.includes(per);
      if (st) return <label key={per} className={st === 'diterima' ? 'lunas' : 'pegang'}>{b} ✓</label>;
      return <label key={per} className={on ? 'pilih' : ''} onClick={() => setPilih(on ? pilih.filter(x => x !== per) : [...pilih, per])}>{b}</label>;
    })}</div>}
    <InputRp id="bJml" label="Iuran per bulan" value={jml} onChange={setJml} />
    <label className="f" htmlFor="bMet">Metode</label>
    <select className="f" id="bMet" value={met} onChange={e => setMet(e.target.value)}><option>Tunai</option><option>Transfer</option></select>
    <div className="total-box"><span>{pilih.length} bulan</span><span>{rp(pilih.length * jml)}</span></div>
    <div className="aksi"><Btn onClick={simpan}>Simpan Pembayaran</Btn></div>
  </div>;
}

function Rekap({ warga, th, setTh }) {
  const a = useApp();
  const s = useLoad(() => q(sb().from('iuran').select('warga_id,periode,status,jumlah').like('periode', th + '-%')), [th, a.refreshKey]);
  if (!s.data) return <Loading s={s} />;
  const m = {}; s.data.forEach(d => (m[d.warga_id] ||= {})[d.periode] = d.status);
  const perBln = BULAN.map((_, i) => s.data.filter(d => d.periode === periode(th, i)).reduce((x, d) => x + +d.jumlah, 0));
  const thNow = +hariIni().slice(0, 4);
  const batas = th < thNow ? 12 : th > thNow ? 0 : +hariIni().slice(5, 7);
  const aktif = warga.filter(w => w.aktif);
  const csv = () => unduhCSV(`rekap-iuran-${th}.csv`, [['Nama', 'Alamat', ...BULAN.map(b => b + ' ' + th)],
    ...aktif.map(w => [w.nama, w.alamat || '', ...BULAN.map((_, i) => { const st = (m[w.id] || {})[periode(th, i)]; return st === 'diterima' ? 'Lunas' : st ? 'Bayar (blm setor)' : ''; })])]);
  return <div className="kartu">
    <div className="baris-flex"><PilihTahun th={th} setTh={setTh}>Tahun </PilihTahun><span className="spasi" />
      <button className="btn sek kecil" onClick={csv}>Unduh CSV</button></div>
    <div className="kecil" style={{ margin: '6px 0' }}><span className="ck">✓</span> lunas · <span className="ck-p">✓</span> belum disetor ke bendahara · <span className="tg">○</span> belum bayar</div>
    <div className="scroll-x"><table className="t rekap"><tbody>
      <tr><th>Warga</th>{BULAN.map(b => <th key={b}>{b}</th>)}<th>Tunggak</th></tr>
      {aktif.map(w => {
        const r = m[w.id] || {}; let tg = 0;
        const sel = BULAN.map((_, i) => { const st = r[periode(th, i)]; if (!st && i < batas) tg++;
          return <td key={i}>{st === 'diterima' ? <span className="ck">✓</span> : st ? <span className="ck-p">✓</span> : <span className="tg">○</span>}</td>; });
        return <tr key={w.id}><td>{w.nama}<div className="kecil">{w.alamat || ''}</div></td>{sel}<td className={tg ? 'keluar tebal' : ''}>{tg || '-'}</td></tr>;
      })}
      <tr><th>Total</th>{perBln.map((v, i) => <th key={i} style={{ fontSize: 10.5 }}>{v ? (v / 1000).toLocaleString('id-ID') + 'rb' : '-'}</th>)}<th /></tr>
    </tbody></table></div>
    <div className="kecil" style={{ marginTop: 6 }}>Total {th}: <b>{rp(perBln.reduce((x, y) => x + y, 0))}</b></div>
  </div>;
}

function Setoran({ warga }) {
  const a = useApp();
  const bend = a.punya('bendahara');
  const [lepas, setLepas] = useState([]);   // id yang TIDAK dicentang
  const s = useLoad(async () => {
    let x = sb().from('iuran').select('*').eq('status', 'belum_setor').order('dicatat_at');
    if (!bend) x = x.eq('dicatat_by', a.me.id);
    const [rows, riwayat] = await Promise.all([q(x),
      q(sb().from('log_aktivitas').select('*').eq('modul', 'iuran').eq('aksi', 'setoran diterima Bendahara').order('id', { ascending: false }).limit(10))]);
    return { rows, riwayat };
  }, [a.refreshKey]);
  if (!s.data) return <Loading s={s} />;
  const { rows, riwayat } = s.data;
  const wn = id => warga.find(w => w.id === id)?.nama || '—';
  const grup = {}; rows.forEach(r => (grup[r.dicatat_by] ||= []).push(r));
  const total = rows.reduce((x, r) => x + +r.jumlah, 0);
  const dipilih = rows.filter(r => !lepas.includes(r.id));
  const toggle = ids => { const semua = ids.every(i => !lepas.includes(i)); setLepas(semua ? [...lepas, ...ids] : lepas.filter(i => !ids.includes(i))); };

  const terima = async () => {
    if (!confirm('Uangnya sudah Anda terima dan jumlahnya cocok?')) return;
    const t = await rpc('terima_setoran_iuran', { p_ids: dipilih.map(r => r.id) });
    a.toast('Setoran ' + rp(t) + ' masuk kas'); setLepas([]); a.refresh();
  };
  const hapus = async id => {
    if (!confirm('Hapus catatan iuran ini (salah input)?')) return;
    await rpc('batal_iuran', { p_id: id }); a.toast('Dihapus'); a.refresh();
  };

  return <>
    <div className="kartu"><div className="baris-flex"><span className="spasi">{bend ? 'Iuran yang masih dipegang petugas' : 'Uang iuran yang Anda pegang'}</span><b className="nominal">{rp(total)}</b></div>
      {!bend && <div className="kecil">Serahkan ke Bendahara. Status berubah lunas setelah Bendahara klik &quot;Terima&quot;.</div>}</div>
    {rows.length ? Object.entries(grup).map(([uid, list]) => (
      <div className="kartu" key={uid}>
        <div className="baris-flex">
          {bend && <input type="checkbox" checked={list.every(r => !lepas.includes(r.id))} onChange={() => toggle(list.map(r => r.id))} />}
          <b className="spasi">{a.nm(uid)}</b><span className="nominal">{rp(list.reduce((x, r) => x + +r.jumlah, 0))}</span></div>
        <table className="t" style={{ marginTop: 6 }}><tbody>{list.map(r => <tr key={r.id}>
          {bend && <td style={{ width: 24 }}><input type="checkbox" checked={!lepas.includes(r.id)} onChange={() => toggle([r.id])} /></td>}
          <td>{wn(r.warga_id)}<div className="kecil">{BULAN_P[+r.periode.slice(5) - 1]} {r.periode.slice(0, 4)} · {r.metode || ''} · {tgl(r.tgl_bayar)}</div></td>
          <td className="r">{rp(r.jumlah)}</td>
          <td style={{ width: 30 }}>{(r.dicatat_by === a.me.id || bend) && <Btn className="btn merah-sek kecil" title="Hapus (salah input)" onClick={() => hapus(r.id)}>✕</Btn>}</td>
        </tr>)}</tbody></table>
      </div>)) : <div className="kartu kosong">Tidak ada iuran yang belum disetor</div>}
    {bend && rows.length > 0 && <div className="aksi">
      <Btn id="btnSetor" disabled={!dipilih.length} onClick={terima}>Terima Setoran {rp(dipilih.reduce((x, r) => x + +r.jumlah, 0))} ({dipilih.length})</Btn></div>}
    {riwayat.length > 0 && <><h3>Setoran diterima terakhir</h3><div className="kartu"><div className="timeline">
      {riwayat.map(l => <div key={l.id}>{l.catatan}<br /><span className="kecil">{a.nm(l.oleh)} · {jam(l.waktu)}</span></div>)}</div></div></>}
  </>;
}

function DataWarga({ warga }) {
  const a = useApp();
  const bisa = a.punya('admin', 'ketum', 'bendahara', 'sekretaris', 'petugas');
  return <>
    {bisa && <div className="aksi" style={{ marginTop: 0, marginBottom: 10 }}>
      <button className="btn" onClick={() => a.openModal('Tambah Warga', <FormWarga />)}>+ Tambah Warga</button>
      <button className="btn sek" onClick={() => a.openModal('Tambah Banyak Warga', <FormMassal />)}>Tambah Banyak</button></div>}
    <div className="kartu"><div className="kecil" style={{ marginBottom: 6 }}>{warga.filter(w => w.aktif).length} warga aktif</div>
      <table className="t"><tbody>{warga.length ? warga.map(w => <tr key={w.id} style={w.aktif ? {} : { opacity: .5 }}>
        <td>{w.nama}<div className="kecil">{w.alamat || ''}{w.no_hp ? ' · ' + w.no_hp : ''}</div></td>
        <td className="r">{rp(w.iuran_bulanan)}/bln{!w.aktif && <div className="kecil">nonaktif</div>}</td>
        <td style={{ width: 50 }}>{bisa && <button className="btn sek kecil" onClick={() => a.openModal('Ubah Data Warga', <FormWarga w={w} />)}>Ubah</button>}</td>
      </tr>) : <tr><td className="kosong">Belum ada data</td></tr>}</tbody></table></div>
  </>;
}

function FormWarga({ w }) {
  const a = useApp();
  const [f, setF] = useState(w ? { ...w } : { nama: '', alamat: '', no_hp: '', iuran_bulanan: 0, aktif: true });
  const simpan = async () => {
    const d = { nama: f.nama.trim(), alamat: (f.alamat || '').trim() || null, no_hp: (f.no_hp || '').trim() || null, iuran_bulanan: +f.iuran_bulanan || 0, aktif: f.aktif };
    if (!d.nama) return a.toast('Nama wajib diisi', true);
    await q(w ? sb().from('warga').update(d).eq('id', w.id) : sb().from('warga').insert(d));
    a.closeModal(); a.toast('Data warga tersimpan'); a.refresh();
  };
  return <>
    <Field id="wNama" label="Nama kepala keluarga" value={f.nama} onChange={e => setF({ ...f, nama: e.target.value })} />
    <Field id="wAl" label="Alamat / Blok" value={f.alamat || ''} onChange={e => setF({ ...f, alamat: e.target.value })} />
    <Field id="wHp" label="No. HP" inputMode="tel" value={f.no_hp || ''} onChange={e => setF({ ...f, no_hp: e.target.value })} />
    <InputRp id="wIur" label="Iuran per bulan" value={f.iuran_bulanan} onChange={v => setF({ ...f, iuran_bulanan: v })} />
    <label className="f"><input type="checkbox" checked={f.aktif} onChange={e => setF({ ...f, aktif: e.target.checked })} /> Aktif</label>
    <div className="aksi"><Btn onClick={simpan}>Simpan</Btn></div>
  </>;
}

function FormMassal() {
  const a = useApp();
  const [teks, setTeks] = useState('');
  const simpan = async () => {
    const rows = teks.split('\n').map(l => l.split(/[;\t]/).map(x => x.trim())).filter(x => x[0])
      .map(x => ({ nama: x[0], alamat: x[1] || null, iuran_bulanan: angka(x[2]), aktif: true }));
    if (!rows.length) return a.toast('Belum ada data', true);
    await q(sb().from('warga').insert(rows));
    a.closeModal(); a.toast(rows.length + ' warga ditambahkan'); a.refresh();
  };
  return <>
    <p className="kecil">Satu baris satu warga. Format: <b>Nama ; Alamat ; Iuran</b><br />Contoh:<br />Bpk Ahmad ; Blok A1 No 2 ; 20000<br />Bpk Budi ; Blok A1 No 3 ; 20000</p>
    <textarea className="f" id="wMassal" style={{ minHeight: 180 }} value={teks} onChange={e => setTeks(e.target.value)} />
    <div className="aksi"><Btn onClick={simpan}>Simpan Semua</Btn></div>
  </>;
}
