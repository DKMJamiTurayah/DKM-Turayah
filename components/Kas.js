'use client';
import { useState } from 'react';
import { sb, rpc, q } from '@/lib/supabase';
import { BULAN_P, NAMA_DKM, bulanIni, cetak, esc, hariIni, rp, tgl, unduhCSV } from '@/lib/util';
import { Btn, Chips, Field, InputRp, Loading, useApp, useLoad } from './ui';

export const muatPos = () => q(sb().from('pos_dana').select('*').order('urutan').order('id'));

export default function Kas() {
  const a = useApp();
  const [bln, setBln] = useState(bulanIni());
  const [pos, setPos] = useState('semua');
  const [th, bl] = bln.split('-').map(Number);
  const sp = useLoad(async () => {
    const [list, saldo] = await Promise.all([muatPos(), rpc('laporan_pos', { p_tgl: hariIni() })]);
    return { list, saldo };
  }, [a.refreshKey]);
  const s = useLoad(async () => {
    const awal = bln + '-01', akhir = new Date(Date.UTC(th, bl, 1)).toISOString().slice(0, 10);
    const f = x => pos === 'semua' ? x : x.eq('pos_id', +pos);
    const [sebelum, rows] = await Promise.all([
      q(f(sb().from('kas').select('jenis,jumlah').lt('tanggal', awal))),
      q(f(sb().from('kas').select('*').gte('tanggal', awal).lt('tanggal', akhir).order('tanggal').order('id')))
    ]);
    const saldoAwal = sebelum.reduce((x, k) => x + (k.jenis === 'masuk' ? +k.jumlah : -k.jumlah), 0);
    let sal = saldoAwal;
    const baris = rows.map(r => { sal += r.jenis === 'masuk' ? +r.jumlah : -r.jumlah; return { ...r, saldo: sal }; });
    const tot = j => rows.filter(r => r.jenis === j).reduce((x, r) => x + +r.jumlah, 0);
    const perKat = {}; rows.forEach(r => { const k = r.jenis + '|' + r.kategori; perKat[k] = (perKat[k] || 0) + +r.jumlah; });
    return { saldoAwal, baris, perKat, masuk: tot('masuk'), keluar: tot('keluar'), akhir: sal };
  }, [bln, pos, a.refreshKey]);

  const geser = d => { let t = th, b = bl + d; if (b < 1) { b = 12; t--; } if (b > 12) { b = 1; t++; } setBln(t + '-' + String(b).padStart(2, '0')); };
  const posList = sp.data?.list || [];
  const namaPos = id => posList.find(p => p.id === id)?.nama || '—';
  const judul = BULAN_P[bl - 1] + ' ' + th + (pos === 'semua' ? '' : ' · ' + namaPos(+pos));

  return <>
      <div className="baris-flex"><h2 className="spasi">Buku Kas</h2>
  {a.punya('bendahara', 'admin') && <button className="btn sek kecil" onClick={() => a.openModal('Impor dari PDF', <ImporPDF pos={posList.filter(p => p.aktif)} />)}>Impor PDF</button>}
  {a.punya('bendahara', 'admin') && <button className="btn kecil" onClick={() => a.openModal('Transaksi Kas Lain-lain', <FormKas pos={posList.filter(p => p.aktif)} />)}>+ Transaksi</button>}</div>
  {sp.data && <div className="kartu">
      <div className="baris-flex"><b className="spasi">Saldo per pos dana</b>
        {a.punya('bendahara') && <button className="btn sek kecil" onClick={() => a.openModal('Pindah Dana Antar Pos', <FormPindah pos={posList.filter(p => p.aktif)} saldo={sp.data.saldo} />)}>Pindah</button>}
        {a.punya('bendahara', 'admin', 'ketum') && <button className="btn sek kecil" onClick={() => a.openModal('Atur Pos Dana', <AturPos list={posList} />)}>Atur</button>}</div>
      <table className="t" style={{ marginTop: 6 }}><tbody>
        {sp.data.saldo.map(r => <tr key={r.pos_id}><td>{r.nama}</td><td className="r tebal">{rp(r.total)}</td></tr>)}
        <tr><td className="tebal">Total</td><td className="r tebal masuk">{rp(sp.data.saldo.reduce((x, r) => x + +r.total, 0))}</td></tr>
      </tbody></table></div>}
    <Chips items={[['semua', 'Semua pos'], ...posList.map(p => [String(p.id), p.nama])]} value={pos} onChange={setPos} />
    <div className="kartu baris-flex"><button className="btn sek kecil" onClick={() => geser(-1)}>‹</button>
      <b className="spasi" style={{ textAlign: 'center' }}>{judul}</b><button className="btn sek kecil" onClick={() => geser(1)}>›</button></div>
    {!s.data ? <Loading s={s} /> : <Isi k={s.data} judul={judul} bln={bln} namaPos={namaPos} />}
  </>;
}

function Isi({ k, judul, bln, namaPos }) {
  const a = useApp();
  const csv = () => unduhCSV(`buku-kas-${bln}.csv`, [['Tanggal', 'Jenis', 'Pos', 'Kategori', 'Keterangan', 'Masuk', 'Keluar', 'Saldo', 'Dicatat'], ['', '', '', '', 'Saldo awal', '', '', k.saldoAwal, ''],
    ...k.baris.map(r => [r.tanggal, r.jenis, namaPos(r.pos_id), r.kategori, r.keterangan, r.jenis === 'masuk' ? r.jumlah : '', r.jenis === 'keluar' ? r.jumlah : '', r.saldo, a.nm(r.created_by)])]);
  const print = () => {
    const pk = j => Object.entries(k.perKat).filter(([x]) => x.startsWith(j)).map(([x, v]) => `<tr><td>${esc(x.split('|')[1])}</td><td class="r">${rp(v)}</td></tr>`).join('') || '<tr><td colspan="2">-</td></tr>';
    const ok = cetak('Laporan Kas ' + judul, `<h2>LAPORAN KEUANGAN BULANAN</h2><div class="sub">${esc(NAMA_DKM)} — ${judul}</div>
      <table class="data"><tr><td>Saldo awal</td><td class="r">${rp(k.saldoAwal)}</td></tr><tr><td>Total pemasukan</td><td class="r">${rp(k.masuk)}</td></tr>
      <tr><td>Total pengeluaran</td><td class="r">${rp(k.keluar)}</td></tr><tr><th>Saldo akhir</th><th class="r">${rp(k.akhir)}</th></tr></table>
      <table style="width:100%"><tr><td style="width:50%;vertical-align:top;padding-right:6px"><b>Rincian pemasukan</b><table class="data">${pk('masuk')}</table></td>
      <td style="vertical-align:top;padding-left:6px"><b>Rincian pengeluaran</b><table class="data">${pk('keluar')}</table></td></tr></table>
      <b>Detail transaksi</b><table class="data"><tr><th>Tanggal</th><th>Pos</th><th>Kategori</th><th>Keterangan</th><th>Masuk</th><th>Keluar</th><th>Saldo</th></tr>
      ${k.baris.map(r => `<tr><td>${tgl(r.tanggal)}</td><td>${esc(namaPos(r.pos_id))}</td><td>${esc(r.kategori)}</td><td>${esc(r.keterangan || '')}</td><td class="r">${r.jenis === 'masuk' ? rp(r.jumlah) : ''}</td><td class="r">${r.jenis === 'keluar' ? rp(r.jumlah) : ''}</td><td class="r">${rp(r.saldo)}</td></tr>`).join('')}</table>
      <table class="ttdt"><tr><td style="width:50%">Mengetahui,<br>Ketua Umum<div class="ttd"></div><b>..................</b></td><td style="width:50%">Dibuat oleh,<br>Bendahara<div class="ttd"></div><b>..................</b></td></tr></table>`);
    if (!ok) a.toast('Izinkan pop-up untuk mencetak', true);
  };
  const kat = Object.entries(k.perKat).sort();
  return <>
    <div className="ringkas">
      <div className="kartu"><span className="kecil">Saldo awal</span><b>{rp(k.saldoAwal)}</b></div>
      <div className="kartu"><span className="kecil">Saldo akhir</span><b>{rp(k.akhir)}</b></div>
      <div className="kartu"><span className="kecil">Pemasukan</span><b className="masuk">{rp(k.masuk)}</b></div>
      <div className="kartu"><span className="kecil">Pengeluaran</span><b className="keluar">{rp(k.keluar)}</b></div>
    </div>
    <div className="kartu">{kat.length ? <table className="t"><tbody>{kat.map(([key, v]) => { const [j, nama] = key.split('|');
      return <tr key={key}><td>{nama}</td><td className={'r ' + j}>{j === 'masuk' ? '+' : '−'} {rp(v)}</td></tr>; })}</tbody></table>
      : <div className="kosong">Tidak ada transaksi bulan ini</div>}</div>
    <div className="aksi" style={{ marginTop: 0, marginBottom: 10 }}>
      <button className="btn sek" onClick={csv}>Unduh Excel</button><button className="btn sek" onClick={print}>Cetak Laporan</button></div>
    {k.baris.slice().reverse().map(r => <div className="kartu" key={r.id}>
      <div className="baris-flex"><span className="kecil">{tgl(r.tanggal)} · {namaPos(r.pos_id)} · {r.kategori}</span><span className="spasi" />
        <span className={'nominal ' + r.jenis}>{r.jenis === 'masuk' ? '+' : '−'} {rp(r.jumlah)}</span></div>
      <div className="baris-flex"><span className="spasi">{r.keterangan || ''}</span><span className="kecil">saldo {rp(r.saldo)}</span></div>
      <div className="kecil">dicatat {a.nm(r.created_by)}</div>
    </div>)}
  </>;
}

const KATEGORI = {
  masuk: ['Infaq Umum', 'Sedekah', 'Zakat', 'Wakaf', 'Donatur Tetap', 'Kotak Amal Harian', 'Saldo Awal', 'Koreksi'],
  keluar: ['Listrik & Air', 'Kebersihan', 'Honor Imam/Khatib', 'Honor Marbot', 'Perbaikan', 'ATK', 'Sosial', 'Koreksi']
};

function FormKas({ pos }) {
  const a = useApp();
  const [f, setF] = useState({ jenis: 'masuk', tgl: hariIni(), pos: (pos.find(p => p.utama) || pos[0])?.id, kat: '', jml: 0, ket: '' });
  const simpan = async () => {
    if (!f.jml || !f.kat.trim()) return a.toast('Kategori & jumlah wajib diisi', true);
    const nPos = pos.find(p => p.id === +f.pos)?.nama;
    if (!confirm(`Simpan ${f.jenis === 'masuk' ? 'pemasukan' : 'pengeluaran'} ${rp(f.jml)} pos ${nPos}? Tidak bisa dihapus.`)) return;
    await rpc('kas_manual', { p_tanggal: f.tgl, p_jenis: f.jenis, p_pos: +f.pos, p_kategori: f.kat.trim(), p_jumlah: f.jml, p_keterangan: f.ket.trim() || null });
    a.closeModal(); a.toast('Transaksi tersimpan'); a.refresh();
  };
  return <>
    <label className="f" htmlFor="xJen">Jenis</label>
    <select className="f" id="xJen" value={f.jenis} onChange={e => setF({ ...f, jenis: e.target.value })}><option value="masuk">Pemasukan</option><option value="keluar">Pengeluaran</option></select>
    <Field id="xTgl" label="Tanggal" type="date" value={f.tgl} onChange={e => setF({ ...f, tgl: e.target.value })} />
    <label className="f" htmlFor="xPos">Pos dana</label>
    <select className="f" id="xPos" value={f.pos || ''} onChange={e => setF({ ...f, pos: e.target.value })}>
      {pos.map(p => <option key={p.id} value={p.id}>{p.nama}</option>)}</select>
    <Field id="xKat" label="Kategori" list="dlKat" value={f.kat} onChange={e => setF({ ...f, kat: e.target.value })} />
    <datalist id="dlKat">{KATEGORI[f.jenis].map(x => <option key={x} value={x} />)}</datalist>
    <InputRp id="xJml" label="Jumlah" value={f.jml} onChange={v => setF({ ...f, jml: v })} />
    <Field id="xKet" label="Keterangan" placeholder="contoh: infaq Hamba Allah / bayar listrik Oktober" value={f.ket} onChange={e => setF({ ...f, ket: e.target.value })} />
    <div className="aksi"><Btn onClick={simpan}>Simpan</Btn></div>
    <p className="kecil">Keropak Jumat dan iuran warga otomatis masuk pos utama ({pos.find(p => p.utama)?.nama}); pencairan bidang diambil dari pos yang dipilih Bendahara. Semuanya sudah otomatis masuk kas — tidak perlu dicatat di sini. Transaksi kas tidak bisa dihapus; jika salah, buat transaksi koreksi kebalikannya.</p>
  </>;
}

function FormPindah({ pos, saldo }) {
  const a = useApp();
  const [f, setF] = useState({ tgl: hariIni(), dari: pos[0]?.id, ke: pos[1]?.id, jml: 0, ket: '' });
  const sDari = saldo.find(r => r.pos_id === +f.dari)?.total || 0;
  const simpan = async () => {
    if (!f.jml) return a.toast('Isi jumlah', true);
    if (+f.dari === +f.ke) return a.toast('Pos asal dan tujuan harus beda', true);
    const n = id => pos.find(p => p.id === +id)?.nama;
    if (!confirm(`Pindahkan ${rp(f.jml)} dari ${n(f.dari)} ke ${n(f.ke)}?`)) return;
    await rpc('kas_pindah_pos', { p_tanggal: f.tgl, p_dari: +f.dari, p_ke: +f.ke, p_jumlah: f.jml, p_keterangan: f.ket.trim() || null });
    a.closeModal(); a.toast('Dana dipindahkan'); a.refresh();
  };
  const pilih = (id, k) => <>
    <label className="f" htmlFor={id}>{k === 'dari' ? 'Dari pos' : 'Ke pos'}</label>
    <select className="f" id={id} value={f[k] || ''} onChange={e => setF({ ...f, [k]: e.target.value })}>
      {pos.map(p => <option key={p.id} value={p.id}>{p.nama}</option>)}</select></>;
  return <>
    <Field id="pTgl" label="Tanggal" type="date" value={f.tgl} onChange={e => setF({ ...f, tgl: e.target.value })} />
    {pilih('pDari', 'dari')}<div className="kecil">Saldo saat ini: {rp(sDari)}</div>
    {pilih('pKe', 'ke')}
    <InputRp id="pJml" label="Jumlah" value={f.jml} onChange={v => setF({ ...f, jml: v })} />
    <Field id="pKet" label="Keterangan (opsional)" placeholder="contoh: dana awal panitia Maulid" value={f.ket} onChange={e => setF({ ...f, ket: e.target.value })} />
    <div className="aksi"><Btn onClick={simpan}>Pindahkan</Btn></div>
    <p className="kecil">Total kas tidak berubah, hanya pindah kantong. Tercatat sebagai keluar di pos asal dan masuk di pos tujuan.</p>
  </>;
}

function AturPos({ list }) {
  const a = useApp();
  const [rows, setRows] = useState(list.map(p => ({ ...p })));
  const [baru, setBaru] = useState('');
  const ubah = (i, k, v) => setRows(r => r.map((x, j) => j === i ? { ...x, [k]: v } : x));
  const simpan = async () => {
    for (const p of rows) {
      const asal = list.find(x => x.id === p.id);
      if (!p.nama.trim()) return a.toast('Nama pos tidak boleh kosong', true);
      if (asal.nama !== p.nama.trim() || asal.aktif !== p.aktif || asal.urutan !== +p.urutan)
        await q(sb().from('pos_dana').update({ nama: p.nama.trim(), aktif: p.aktif, urutan: +p.urutan || 0 }).eq('id', p.id));
    }
    if (baru.trim()) await q(sb().from('pos_dana').insert({ nama: baru.trim(), urutan: Math.max(0, ...rows.map(r => +r.urutan || 0)) + 1 }));
    a.closeModal(); a.toast('Pos dana tersimpan'); a.refresh();
  };
  return <>
    <p className="kecil">Urutan menentukan posisi di Buku Kas dan Maklumat. Pos nonaktif tidak bisa dipakai transaksi baru dan tidak tampil di maklumat (kecuali masih ada saldonya).</p>
    {rows.map((p, i) => <div key={p.id} className="baris-flex" style={{ marginBottom: 6 }}>
      <input className="f" style={{ width: 56 }} inputMode="numeric" value={p.urutan} onChange={e => ubah(i, 'urutan', e.target.value.replace(/\D/g, ''))} aria-label="Urutan" />
      <input className="f spasi" value={p.nama} onChange={e => ubah(i, 'nama', e.target.value)} aria-label="Nama pos" />
      {p.utama ? <span className="badge b-hijau">utama</span>
        : <label className="kecil" style={{ whiteSpace: 'nowrap' }}><input type="checkbox" checked={p.aktif} onChange={e => ubah(i, 'aktif', e.target.checked)} /> aktif</label>}
    </div>)}
    <Field id="posBaru" label="Tambah pos baru (opsional)" placeholder="contoh: Santunan Yatim" value={baru} onChange={e => setBaru(e.target.value)} />
    <div className="aksi"><Btn onClick={simpan}>Simpan</Btn></div>
  </>;
}
const BLN = { jan: 1, feb: 2, mar: 3, apr: 4, mei: 5, may: 5, jun: 6, jul: 7, agu: 8, agt: 8, ags: 8, aug: 8, sep: 9, okt: 10, oct: 10, nov: 11, des: 12, dec: 12 };
const RE_TGL = /^(\d{1,2})-([A-Za-z]{3,4})-(\d{4})$/, RE_NUM = /^-?\d{1,3}(\.\d{3})*$/;
const nom = s => +s.replace(/\./g, '');
function kelompokBaris(items) {
  const it = items.filter(i => i.s.trim()).sort((a, b) => b.y - a.y || a.x - b.x);
  const baris = [];
  it.forEach(i => { const b = baris.find(r => Math.abs(r.y - i.y) < 7); if (b) b.t.push(i); else baris.push({ y: i.y, t: [i] }); });
  return baris.map(b => {
    b.t.sort((p, q) => p.x - q.x);
    let s = '';
    b.t.forEach((i, k) => { const gap = k ? i.x - (b.t[k - 1].x + b.t[k - 1].w) : 0; s += (k && gap > 1.5 ? ' ' : '') + i.s.trim(); });
    return s;
  });
}
function urai(baris) {
  const rows = [], luar = [];
  baris.forEach(line => {
    const t = line.replace(/(\d{1,2})\s*-\s*([A-Za-z]{3,4})\s*-\s*(\d{4})/g, '$1-$2-$3').split(/\s+/).filter(Boolean);
    const di = t.map((x, i) => RE_TGL.test(x) ? i : -1).filter(i => i >= 0);
    const akhir = t[t.length - 1] || '';
    if (di.length === 1) {
      const m = t[di[0]].match(RE_TGL), bl = BLN[m[2].toLowerCase()];
      const ni = t.map((x, i) => i > di[0] && RE_NUM.test(x) ? i : -1).filter(i => i >= 0);
      if (!bl || !ni.length) return;
      const pakai = ni.slice(-2);
      rows.push({
        tgl: m[3] + '-' + String(bl).padStart(2, '0') + '-' + m[1].padStart(2, '0'),
        ket: t.filter((x, i) => i !== di[0] && !pakai.includes(i) && !(i === 0 && /^\d+$/.test(x))).join(' '),
        saldo: nom(t[pakai[pakai.length - 1]]), amt: pakai.length > 1 ? nom(t[pakai[0]]) : null
      });
      
    } else if (!di.length && RE_NUM.test(akhir) && (akhir.includes('.') || akhir[0] === '-')) luar.push({ n: nom(akhir), sesudah: rows.length > 0 });
  });
  const awal = (luar.find(x => !x.sesudah) || {}).n;
  const tot = luar.filter(x => x.sesudah).map(x => x.n);
  let prev = awal ?? 0;
  rows.forEach(r => { const d = r.saldo - prev; r.jenis = d >= 0 ? 'masuk' : 'keluar'; r.jml = Math.abs(d); r.beda = r.amt !== null && r.amt !== r.jml; prev = r.saldo; });
  const tm = rows.filter(r => r.jenis === 'masuk').reduce((x, r) => x + r.jml, 0), tk = rows.filter(r => r.jenis === 'keluar').reduce((x, r) => x + r.jml, 0);
  return { rows, awal, akhir: rows.length ? rows[rows.length - 1].saldo : null, tm, tk, cocok: tot.length >= 2 ? tm === tot[0] && tk === tot[1] : null, awalHilang: awal === undefined };
}

const PDFJS = ['https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf', 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf'];
function muatPdfJs() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  const coba = i => new Promise((ok, gagal) => {
    const s = document.createElement('script');
    s.src = PDFJS[i] + '.min.js';
    s.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS[i] + '.worker.min.js'; ok(window.pdfjsLib); };
    s.onerror = () => gagal(new Error('Gagal memuat pembaca PDF, cek internet'));
    document.head.appendChild(s);
  });
  return coba(0).catch(() => coba(1));
}
async function bacaPdf(file) {
  const lib = await muatPdfJs();
  const doc = await lib.getDocument({ data: await file.arrayBuffer() }).promise;
  const baris = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const tc = await (await doc.getPage(p)).getTextContent();
        baris.push(...kelompokBaris(tc.items.map(i => ({ s: i.str, x: i.transform[4], y: i.transform[5], w: i.width }))));
  }
  return urai(baris);
}

function ImporPDF({ pos }) {
  const a = useApp();
  const [h, setH] = useState(null);
  const [posId, setPosId] = useState((pos.find(p => p.utama) || pos[0])?.id);
  const [sibuk, setSibuk] = useState(false);
  const kero = r => /keropak|iuran/i.test(r.ket);
  const ubah = (i, k, v) => setH(d => ({ ...d, rows: d.rows.map((r, j) => j === i ? { ...r, [k]: v } : r) }));
  const pilih = async e => {
    const f = e.target.files[0];
    if (!f) return;
    setSibuk(true); setH(null);
    try {
      const x = await bacaPdf(f);
      if (!x.rows.length) throw new Error('Tidak ada transaksi terbaca. Pastikan PDF berisi teks, bukan foto/scan.');
      const t = x.rows.map(r => r.tgl).sort();
      const ada = await q(sb().from('kas').select('tanggal,jenis,jumlah').gte('tanggal', t[0]).lte('tanggal', t[t.length - 1]));
      x.rows.forEach(r => { r.dobel = ada.some(k => k.tanggal === r.tgl && k.jenis === r.jenis && +k.jumlah === r.jml); r.pilih = !r.dobel; r.kat = ''; });
      setH(x);
    } catch (err) { a.toast(err.message || 'Gagal membaca PDF', true); }
    setSibuk(false);
  };
  const simpan = async () => {
    const pil = h.rows.filter(r => r.pilih && !r.sudah && !kero(r));
    if (!pil.length) return a.toast('Tidak ada baris yang dicentang', true);
    if (pil.some(r => !r.kat.trim())) return a.toast('Isi kategori di semua baris yang dicentang', true);
    const nPos = pos.find(p => p.id === +posId)?.nama;
    if (!confirm(`Simpan ${pil.length} transaksi ke pos ${nPos}? Tidak bisa dihapus.`)) return;
    setSibuk(true);
    let ok = 0;
    try {
      for (const r of pil) {
                await rpc('kas_manual', { p_tanggal: r.tgl, p_jenis: r.jenis, p_pos: +posId, p_kategori: r.kat.trim(), p_jumlah: r.jml, p_keterangan: r.ket.trim() || null });
        ok++;
        setH(d => ({ ...d, rows: d.rows.map(x => x === r ? { ...x, sudah: true, pilih: false } : x) }));
      }
      a.closeModal();
    } catch (err) { a.toast(`Berhenti: ${err.message}. Tersimpan ${ok} dari ${pil.length}`, true); }
    if (ok) { a.toast(ok + ' transaksi tersimpan'); a.refresh(); }
    setSibuk(false);
  };
  return <>
    <p className="kecil">Pilih PDF laporan (yang berisi teks, bukan foto). Isi keterangan dan kategori, hilangkan centang baris yang sudah tercatat. Transaksi kas tidak bisa dihapus.</p>
    <input className="f" type="file" accept="application/pdf" onChange={pilih} disabled={sibuk} aria-label="File PDF" />
    {sibuk && !h && <p className="kecil">Membaca PDF…</p>}
    {h && <>
      <div className="kartu kecil">Saldo PDF: {rp(h.awal || 0)} → {rp(h.akhir)}<br />Masuk {rp(h.tm)} · Keluar {rp(h.tk)}<br />
        {h.cocok === true ? '✓ Total cocok dengan PDF' : h.cocok === false ? '⚠ Total TIDAK cocok dengan PDF, periksa lagi' : 'Total di PDF tidak terbaca, cek manual'}
        {h.awalHilang ? ' · saldo awal tidak terbaca (dianggap 0)' : ''}</div>
      <label className="f" htmlFor="impPos">Pos dana tujuan</label>
      <select className="f" id="impPos" value={posId || ''} onChange={e => setPosId(e.target.value)}>
        {pos.map(p => <option key={p.id} value={p.id}>{p.nama}</option>)}</select>
      <datalist id="dlK_masuk">{KATEGORI.masuk.map(x => <option key={x} value={x} />)}</datalist>
      <datalist id="dlK_keluar">{KATEGORI.keluar.map(x => <option key={x} value={x} />)}</datalist>
                                                         {h.rows.map((r, i) => <div className="kartu" key={i} style={{ opacity: kero(r) || r.sudah ? 0.5 : 1 }}>
        <div className="baris-flex"><label className="kecil"><input type="checkbox" checked={r.pilih && !kero(r) && !r.sudah} disabled={kero(r) || r.sudah} onChange={e => ubah(i, 'pilih', e.target.checked)} /> {tgl(r.tgl)}</label><span className="spasi" />
          <span className={'nominal ' + r.jenis}>{r.jenis === 'masuk' ? '+' : '−'} {rp(r.jml)}</span></div>
        <input className="f" placeholder="Keterangan" value={r.ket} onChange={e => ubah(i, 'ket', e.target.value)} aria-label="Keterangan" />
        <input className="f" list={'dlK_' + r.jenis} placeholder="Kategori" value={r.kat} onChange={e => ubah(i, 'kat', e.target.value)} aria-label="Kategori" />
        {r.sudah ? <div className="kecil">✓ Tersimpan</div> : kero(r) ? <div className="kecil">Keropak/iuran: catat lewat menu Keropak/Iuran, tidak diimpor.</div>
          : r.dobel ? <div className="kecil">⚠ Mirip transaksi yang sudah ada, centang kalau memang beda.</div>
          : r.beda ? <div className="kecil">⚠ Angka di PDF tidak cocok dengan perubahan saldo.</div> : null}
      </div>)}
      <div className="aksi"><Btn onClick={simpan}>Simpan yang dicentang</Btn></div>
    </>}
  </>;
        }  
