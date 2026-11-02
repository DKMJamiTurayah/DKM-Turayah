'use client';
import { useState } from 'react';
import { sb, rpc, q } from '@/lib/supabase';
import { ST_AJU, cetak, esc, hariIni, jam, pendek, rp, tgl, NAMA_DKM } from '@/lib/util';
import { Btn, Chips, Field, InputRp, Loading, useApp, useLoad } from './ui';

export const bukaFormPengajuan = a => a.openModal('Ajukan Anggaran — ' + pendek(a.bn(a.me.bidang_id)), <FormPengajuan />);

export default function Pengajuan() {
  const a = useApp();
  const f = a.sub.pengajuan || 'aktif';
  const s = useLoad(async () => {
    let x = sb().from('pengajuan').select('*').order('id', { ascending: false }).limit(300);
    if (f === 'aktif') x = x.in('status', ['diajukan', 'disetujui', 'dicairkan']);
    else if (f === 'saya') x = x.eq('bidang_id', a.me.bidang_id || -1);
    else if (f !== 'semua') x = x.eq('status', f);
    return q(x);
  }, [a.refreshKey, f]);
  const chips = [['aktif', 'Sedang Proses'], ['diajukan', 'Menunggu Ketum'], ['disetujui', 'Siap Dicairkan'], ['dicairkan', 'Tunggu Konfirmasi'], ['diterima', 'Selesai'], ['ditolak', 'Ditolak'], ['semua', 'Semua']];
  if (a.punya('ketua_bidang')) chips.unshift(['saya', 'Bidang Saya']);

  return <>
    <div className="baris-flex"><h2 className="spasi">Pengajuan Anggaran</h2>
      {a.punya('ketua_bidang') && <button className="btn kecil" onClick={() => bukaFormPengajuan(a)}>+ Ajukan</button>}</div>
    <Chips items={chips} value={f} onChange={k => a.setSub('pengajuan', k)} />
    {!s.data ? <Loading s={s} /> : s.data.length ? s.data.map(p => <KartuAju key={p.id} p={p} />)
      : <div className="kartu kosong">Tidak ada pengajuan</div>}
    <p className="kecil">Alur: Ketua Bidang ajukan → Ketua Umum approve → Bendahara cairkan → Ketua Bidang konfirmasi terima.</p>
  </>;
}

function Langkah({ s }) {
  const urut = ['diajukan', 'disetujui', 'dicairkan', 'diterima'];
  let cls;
  if (s === 'ditolak') cls = ['ok', 'x', '', ''];
  else if (s === 'dibatalkan') cls = ['x', '', '', ''];
  else { const n = urut.indexOf(s); cls = urut.map((_, i) => i <= n ? 'ok' : ''); }
  return <div className="langkah">{cls.map((c, i) => <i key={i} className={c} />)}</div>;
}

function KartuAju({ p }) {
  const a = useApp();
  const [lbl, cls] = ST_AJU[p.status];
  return <div className="kartu klik" onClick={() => a.openModal(p.nomor, <DetailAju id={p.id} />)}>
    <div className="baris-flex"><span className="kecil">{p.nomor} · {tgl(p.diajukan_at)}</span><span className="spasi" /><span className={'badge ' + cls}>{lbl}</span></div>
    <div className="tebal" style={{ marginTop: 4 }}>{p.judul}</div>
    <div className="baris-flex"><span className="kecil spasi">{a.bn(p.bidang_id)}</span>
      <span className="nominal">{rp(p.total_disetujui ?? p.total_diajukan)}</span></div>
    <Langkah s={p.status} />
  </div>;
}

const barisKosong = () => ({ uraian: '', qty: '1', satuan: '', harga: 0 });
const num = v => parseFloat(String(v).replace(',', '.')) || 0;

export function FormPengajuan() {
  const a = useApp();
  const [judul, setJudul] = useState(''), [tglB, setTgl] = useState(''), [ket, setKet] = useState('');
  const [items, setItems] = useState([barisKosong()]);
  const ubah = (i, k, v) => setItems(items.map((it, j) => j === i ? { ...it, [k]: v } : it));
  const total = items.reduce((x, it) => x + num(it.qty) * (+it.harga || 0), 0);

  const kirim = async () => {
    const isi = items.filter(it => it.uraian.trim()).map(it => ({ uraian: it.uraian.trim(), qty: num(it.qty) || 1, satuan: it.satuan.trim(), harga: +it.harga || 0 }));
    await rpc('ajukan_pengajuan', { p_judul: judul, p_keterangan: ket.trim() || null, p_kebutuhan: tglB || null, p_items: isi });
    a.closeModal(); a.toast('Pengajuan terkirim ke Ketua Umum'); a.go('pengajuan', 'saya'); a.refresh();
  };

  return <>
    <Field id="aJudul" label="Judul / keperluan" value={judul} onChange={e => setJudul(e.target.value)} placeholder="contoh: Konsumsi Maulid Nabi" />
    <Field id="aTgl" label="Dana dibutuhkan tanggal" type="date" value={tglB} onChange={e => setTgl(e.target.value)} />
    <label className="f">Rincian kebutuhan</label>
    <div className="kecil item-head" style={{ display: 'grid', gridTemplateColumns: '1fr 64px 70px 110px 30px', gap: 6 }}><span>Uraian</span><span>Qty</span><span>Satuan</span><span>Harga satuan</span><span /></div>
    <div id="aItems">{items.map((it, i) => (
      <div className="item-row" key={i}>
        <input placeholder="Uraian" value={it.uraian} onChange={e => ubah(i, 'uraian', e.target.value)} />
        <input inputMode="decimal" placeholder="Qty" value={it.qty} onChange={e => ubah(i, 'qty', e.target.value)} />
        <input placeholder="Satuan" value={it.satuan} onChange={e => ubah(i, 'satuan', e.target.value)} />
        <input inputMode="numeric" placeholder="Harga" value={it.harga ? Number(it.harga).toLocaleString('id-ID') : ''}
          onChange={e => ubah(i, 'harga', Number(e.target.value.replace(/[^\d]/g, '')) || 0)} />
        <button aria-label="Hapus" onClick={() => setItems(items.length > 1 ? items.filter((_, j) => j !== i) : [barisKosong()])}>✕</button>
      </div>))}</div>
    <button className="btn sek kecil" onClick={() => setItems([...items, barisKosong()])}>+ Tambah baris</button>
    <div className="total-box"><span>Total diajukan</span><span>{rp(Math.round(total))}</span></div>
    <label className="f" htmlFor="aKet">Keterangan (opsional)</label>
    <textarea className="f" id="aKet" value={ket} onChange={e => setKet(e.target.value)} placeholder="Tujuan kegiatan, peserta, dll" />
    <div className="aksi"><Btn onClick={kirim}>Kirim ke Ketua Umum</Btn></div>
  </>;
}

function DetailAju({ id }) {
  const a = useApp();
  const [kNom, setKNom] = useState(null), [kCat, setKCat] = useState('');
  const [cMet, setCMet] = useState('Tunai'), [cCat, setCCat] = useState(''), [tCat, setTCat] = useState(''), [cPos, setCPos] = useState('');
  const s = useLoad(async () => {
    const [p, items, log, pos] = await Promise.all([
      q(sb().from('pengajuan').select('*').eq('id', id).single()),
      q(sb().from('pengajuan_item').select('*').eq('pengajuan_id', id).order('id')),
      q(sb().from('log_aktivitas').select('*').eq('modul', 'pengajuan').eq('ref_id', id).order('id')),
      a.punya('bendahara') ? rpc('laporan_pos', { p_tgl: hariIni() }) : []
    ]);
    return { p, items, log, pos };
  }, [id]);
  if (!s.data) return <Loading s={s} />;
  const { p, items, log, pos } = s.data;
  const posCair = cPos || String(pos[0]?.pos_id || '');
  const me = a.me;
  const [lbl, cls] = ST_AJU[p.status];
  const bisaKetum = a.punya('ketum') && p.status === 'diajukan';
  const bisaCair = a.punya('bendahara') && p.status === 'disetujui';
  const bisaTerima = p.status === 'dicairkan' && (me.id === p.diajukan_by || (me.role === 'ketua_bidang' && me.bidang_id === p.bidang_id));
  const bisaBatal = p.status === 'diajukan' && me.id === p.diajukan_by;
  const selesai = msg => { a.closeModal(); a.toast(msg); a.refresh(); };

  const putus = async setuju => {
    if (!setuju && !kCat.trim()) return a.toast('Isi alasan penolakan', true);
    if (!confirm(setuju ? 'Approve pengajuan ini?' : 'Tolak pengajuan ini?')) return;
    await rpc('ketum_putuskan', { p_id: id, p_setuju: setuju, p_nominal: setuju ? (kNom ?? p.total_diajukan) : null, p_catatan: kCat.trim() || null });
    selesai(setuju ? 'Pengajuan di-approve' : 'Pengajuan ditolak');
  };
  const cairkan = async () => {
    const nPos = pos.find(x => x.pos_id === +posCair)?.nama;
    if (!confirm(`Cairkan dana sekarang dari pos ${nPos}? Saldo pos akan berkurang.`)) return;
    await rpc('bendahara_cairkan', { p_id: id, p_metode: cMet, p_catatan: cCat.trim() || null, p_pos: +posCair || null });
    selesai('Dana dicairkan, menunggu konfirmasi Ketua Bidang');
  };
  const terima = async () => {
    await rpc('konfirmasi_terima', { p_id: id, p_catatan: tCat.trim() || null });
    selesai('Terima kasih, penerimaan dana tercatat');
  };
  const batal = async () => {
    if (!confirm('Batalkan pengajuan ini?')) return;
    await rpc('batal_pengajuan', { p_id: id }); selesai('Pengajuan dibatalkan');
  };

  return <>
    <div className="baris-flex"><span className={'badge ' + cls}>{lbl}</span><span className="spasi" />
      <button className="btn sek kecil" onClick={() => { if (!cetakAju(p, items, a)) a.toast('Izinkan pop-up untuk mencetak', true); }}>Cetak</button></div>
    <div className="tebal" style={{ fontSize: 17, marginTop: 8 }}>{p.judul}</div>
    <div className="kecil">{a.bn(p.bidang_id)} · diajukan {a.nm(p.diajukan_by)}{p.kebutuhan_tgl ? ' · dibutuhkan ' + tgl(p.kebutuhan_tgl) : ''}</div>
    {p.keterangan && <p style={{ margin: '8px 0' }}>{p.keterangan}</p>}
    <Langkah s={p.status} />
    <div className="scroll-x" style={{ marginTop: 10 }}><table className="t"><tbody>
      <tr><th>Uraian</th><th className="r">Qty</th><th className="r">Harga</th><th className="r">Subtotal</th></tr>
      {items.map(it => <tr key={it.id}><td>{it.uraian}</td><td className="r">{+it.qty} {it.satuan || ''}</td><td className="r">{rp(it.harga)}</td><td className="r">{rp(it.subtotal)}</td></tr>)}
      <tr><td colSpan={3} className="r tebal">Total diajukan</td><td className="r tebal">{rp(p.total_diajukan)}</td></tr>
      {p.total_disetujui != null && <tr><td colSpan={3} className="r tebal masuk">Disetujui Ketum</td><td className="r tebal masuk">{rp(p.total_disetujui)}</td></tr>}
    </tbody></table></div>
    <h3>Riwayat</h3>
    <div className="timeline">{log.map(l => <div key={l.id}><b>{l.aksi}</b> oleh {a.nm(l.oleh)}<br /><span className="kecil">{jam(l.waktu)}{l.catatan ? ' · ' + l.catatan : ''}</span></div>)}</div>

    {bisaKetum && <>
      <h3>Keputusan Ketua Umum</h3>
      <InputRp id="kNom" label="Nominal disetujui (boleh dikurangi)" value={kNom ?? p.total_diajukan} onChange={setKNom} />
      <label className="f" htmlFor="kCat">Catatan</label>
      <textarea className="f" id="kCat" value={kCat} onChange={e => setKCat(e.target.value)} placeholder="Wajib diisi jika ditolak" />
      <div className="aksi"><Btn className="btn merah-sek" onClick={() => putus(false)}>Tolak</Btn><Btn onClick={() => putus(true)}>Approve</Btn></div>
    </>}
    {bisaCair && <>
      <h3>Pencairan oleh Bendahara</h3>
      <div className="kecil">Nominal dicairkan: <b>{rp(p.total_disetujui)}</b> (otomatis tercatat sebagai pengeluaran kas)</div>
      <label className="f" htmlFor="cPos">Diambil dari pos dana</label>
      <select className="f" id="cPos" value={posCair} onChange={e => setCPos(e.target.value)}>
        {pos.map(x => <option key={x.pos_id} value={x.pos_id}>{x.nama} (saldo {rp(x.total)})</option>)}</select>
      <label className="f" htmlFor="cMet">Metode</label>
      <select className="f" id="cMet" value={cMet} onChange={e => setCMet(e.target.value)}><option>Tunai</option><option>Transfer</option></select>
      <Field id="cCat" label="Catatan (opsional)" value={cCat} onChange={e => setCCat(e.target.value)} placeholder="contoh: diserahkan di sekretariat" />
      <div className="aksi"><Btn className="btn emas" onClick={cairkan}>Cairkan Dana</Btn></div>
    </>}
    {bisaTerima && <>
      <h3>Konfirmasi Penerimaan</h3>
      <div className="kecil">Klik setelah uang <b>{rp(p.total_disetujui)}</b> benar-benar sudah Anda terima.</div>
      <Field id="tCat" label="Catatan (opsional)" value={tCat} onChange={e => setTCat(e.target.value)} />
      <div className="aksi"><Btn onClick={terima}>✓ Sudah Diterima</Btn></div>
    </>}
    {bisaBatal && <div className="aksi"><Btn className="btn merah-sek" onClick={batal}>Batalkan Pengajuan</Btn></div>}
  </>;
}

function cetakAju(p, items, a) {
  const ttd = (j, n, w) => `<td><div>${j}</div><div class="ttd">${w ? '✓ ' + jam(w) : ''}</div><b>${esc(n && n !== '—' ? n : '..................')}</b></td>`;
  return cetak(`Pengajuan ${p.nomor}`, `
    <h2>FORM PENGAJUAN ANGGARAN</h2><div class="sub">${esc(NAMA_DKM)}</div>
    <table class="info"><tr><td>Nomor</td><td>: ${esc(p.nomor)}</td><td>Status</td><td>: ${ST_AJU[p.status][0]}</td></tr>
    <tr><td>Bidang</td><td>: ${esc(a.bn(p.bidang_id))}</td><td>Tgl diajukan</td><td>: ${tgl(p.diajukan_at)}</td></tr>
    <tr><td>Keperluan</td><td colspan="3">: ${esc(p.judul)}</td></tr>
    ${p.keterangan ? `<tr><td>Keterangan</td><td colspan="3">: ${esc(p.keterangan)}</td></tr>` : ''}</table>
    <table class="data"><tr><th>No</th><th>Uraian</th><th>Qty</th><th>Satuan</th><th>Harga</th><th>Jumlah</th></tr>
    ${items.map((it, i) => `<tr><td>${i + 1}</td><td>${esc(it.uraian)}</td><td class="r">${+it.qty}</td><td>${esc(it.satuan || '')}</td><td class="r">${rp(it.harga)}</td><td class="r">${rp(it.subtotal)}</td></tr>`).join('')}
    <tr><td colspan="5" class="r"><b>Total diajukan</b></td><td class="r"><b>${rp(p.total_diajukan)}</b></td></tr>
    ${p.total_disetujui != null ? `<tr><td colspan="5" class="r"><b>Disetujui</b></td><td class="r"><b>${rp(p.total_disetujui)}</b></td></tr>` : ''}</table>
    ${p.ketum_catatan ? `<p>Catatan Ketua Umum: ${esc(p.ketum_catatan)}</p>` : ''}
    <table class="ttdt"><tr>${ttd('Diajukan,<br>Ketua Bidang', a.nm(p.diajukan_by), p.diajukan_at)}${ttd('Disetujui,<br>Ketua Umum', a.nm(p.ketum_by), p.status !== 'ditolak' ? p.ketum_at : null)}${ttd('Dicairkan,<br>Bendahara', a.nm(p.cair_by), p.cair_at)}${ttd('Diterima,<br>Ketua Bidang', a.nm(p.terima_by), p.terima_at)}</tr></table>`);
}
