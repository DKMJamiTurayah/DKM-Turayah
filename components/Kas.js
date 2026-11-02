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
      {a.punya('bendahara') && <button className="btn kecil" onClick={() => a.openModal('Transaksi Kas Lain-lain', <FormKas pos={posList.filter(p => p.aktif)} />)}>+ Transaksi</button>}</div>
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
      <button className="btn sek" onClick={csv}>Unduh CSV</button><button className="btn sek" onClick={print}>Cetak Laporan</button></div>
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
