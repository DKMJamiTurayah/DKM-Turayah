'use client';
import { useState } from 'react';
import { sb, rpc, q } from '@/lib/supabase';
import { NAMA_DKM, cetak, esc, hariIni, rp, tgl, unduhCSV } from '@/lib/util';
import { tambahHari } from '@/lib/jadwal';
import { Btn, Chips, Field, InputRp, Loading, useApp, useLoad } from './ui';

const KONDISI = { baik: ['Baik', 'b-hijau'], rusak_ringan: ['Rusak ringan', 'b-kuning'], rusak_berat: ['Rusak berat', 'b-merah'] };
const KATEGORI = ['Perlengkapan Ibadah', 'Elektronik & Sound', 'Furnitur', 'Perlengkapan Acara', 'Kebersihan', 'Bangunan', 'Kendaraan', 'Lainnya'];
const telat = p => p.status === 'dipinjam' && p.tgl_kembali < hariIni();
const waLink = (hp, teks) => 'https://wa.me/' + hp.replace(/\D/g, '').replace(/^0/, '62') + '?text=' + encodeURIComponent(teks);

export default function Inventaris() {
  const a = useApp();
  const tab = a.sub.inventaris || 'aset';
  const [kat, setKat] = useState('semua');
  const [cari, setCari] = useState('');
  const [riwayat, setRiwayat] = useState(false);
  const s = useLoad(async () => {
    const [aset, pinjam, warga] = await Promise.all([
      q(sb().from('inventaris').select('*').order('kategori').order('nama')),
      q(sb().from('pinjam').select('*, pinjam_item(qty, inventaris_id)').order('id', { ascending: false }).limit(200)),
      q(sb().from('warga').select('nama,alamat,no_hp').eq('aktif', true).order('nama'))
    ]);
    const dipinjam = {};
    pinjam.filter(p => p.status === 'dipinjam').forEach(p => p.pinjam_item.forEach(i => dipinjam[i.inventaris_id] = (dipinjam[i.inventaris_id] || 0) + i.qty));
    aset.forEach(x => { x.dipinjam = dipinjam[x.id] || 0; x.tersedia = x.jumlah - x.dipinjam; });
    return { aset, pinjam, warga };
  }, [a.refreshKey]);
  if (!s.data) return <><h2>Inventaris Masjid</h2><Loading s={s} /></>;

  const { aset, pinjam, warga } = s.data;
  const peta = {}; aset.forEach(x => peta[x.id] = x);
  const aktif = aset.filter(x => x.aktif);
  const katAda = [...new Set(aktif.map(x => x.kategori))];
  const daftar = aktif.filter(x => (kat === 'semua' || x.kategori === kat) && (!cari || (x.nama + ' ' + (x.lokasi || '')).toLowerCase().includes(cari.toLowerCase())));
  const sedang = pinjam.filter(p => p.status === 'dipinjam');
  const nTelat = sedang.filter(telat).length;
  const c = { aset, peta, warga };

  const excel = () => unduhCSV('inventaris-masjid.csv', [['Nama', 'Kategori', 'Jumlah', 'Satuan', 'Sedang Dipinjam', 'Kondisi', 'Lokasi', 'Bisa Dipinjam', 'Tgl Perolehan', 'Sumber', 'Nilai (Rp)', 'Catatan'],
    ...aktif.map(x => [x.nama, x.kategori, x.jumlah, x.satuan, x.dipinjam, KONDISI[x.kondisi][0], x.lokasi, x.bisa_dipinjam ? 'Ya' : 'Tidak', x.tgl_perolehan, x.sumber, x.nilai ? +x.nilai : '', x.catatan])]);
  const print = () => {
    const ok = cetak('Daftar Inventaris', `<h2>DAFTAR INVENTARIS MASJID</h2><div class="sub">${esc(NAMA_DKM)} · per ${tgl(hariIni())}</div>
      <table class="data"><tr><th>No</th><th>Nama Barang</th><th>Kategori</th><th>Jumlah</th><th>Kondisi</th><th>Lokasi</th><th>Keterangan</th></tr>
      ${aktif.map((x, i) => `<tr><td>${i + 1}</td><td>${esc(x.nama)}</td><td>${esc(x.kategori)}</td><td class="r">${x.jumlah} ${esc(x.satuan)}</td><td>${KONDISI[x.kondisi][0]}</td><td>${esc(x.lokasi || '')}</td><td>${x.dipinjam ? x.dipinjam + ' sedang dipinjam' : ''}${x.catatan ? ' ' + esc(x.catatan) : ''}</td></tr>`).join('')}</table>`);
    if (!ok) a.toast('Izinkan pop-up untuk mencetak', true);
  };

  return <>
    <h2>Inventaris Masjid</h2>
    <div className="ringkas">
      <div className="kartu"><span className="kecil">Jenis barang</span><b>{aktif.length}</b>
        <span className="kecil">{aktif.filter(x => x.kondisi !== 'baik').length} perlu perbaikan</span></div>
      <div className="kartu klik" onClick={() => a.setSub('inventaris', 'pinjam')}><span className="kecil">Sedang dipinjam</span><b>{sedang.length}</b>
        <span className={'kecil' + (nTelat ? ' keluar' : '')}>{nTelat ? nTelat + ' terlambat kembali' : 'tidak ada yang terlambat'}</span></div>
    </div>
    <Chips items={[['aset', 'Daftar Aset'], ['pinjam', 'Peminjaman' + (sedang.length ? ` (${sedang.length})` : '')]]} value={tab} onChange={k => a.setSub('inventaris', k)} />

    {tab === 'aset' ? <>
      <div className="aksi" style={{ marginTop: 0, marginBottom: 10 }}>
        <button className="btn" onClick={() => a.openModal('Tambah Aset', <FormAset />)}>+ Tambah Aset</button>
        <button className="btn sek" onClick={print} disabled={!aktif.length}>Cetak</button>
        <button className="btn sek" onClick={excel} disabled={!aktif.length}>Excel</button>
      </div>
      {katAda.length > 1 && <Chips items={[['semua', 'Semua'], ...katAda.map(k => [k, k])]} value={kat} onChange={setKat} />}
      {aktif.length > 6 && <input className="f" style={{ marginTop: 0 }} placeholder="Cari barang / lokasi…" value={cari} onChange={e => setCari(e.target.value)} />}
      {daftar.map(x => <div className="kartu klik" key={x.id} onClick={() => a.openModal('Ubah Aset', <FormAset x={x} />)}>
        <div className="baris-flex"><b className="spasi">{x.nama}</b><span className={'badge ' + KONDISI[x.kondisi][1]}>{KONDISI[x.kondisi][0]}</span></div>
        <div className="baris-flex" style={{ marginTop: 3 }}>
          <span className="kecil spasi">{x.kategori}{x.lokasi ? ' · ' + x.lokasi : ''}{x.bisa_dipinjam ? ' · bisa dipinjam' : ''}</span>
          <b>{x.jumlah} {x.satuan}</b></div>
        {x.dipinjam > 0 && <div className="kecil keluar">{x.dipinjam} {x.satuan} sedang dipinjam · tersedia {x.tersedia}</div>}
      </div>)}
      {!daftar.length && <div className="kartu kosong">{aktif.length ? 'Tidak ada yang cocok' : 'Belum ada data aset. Klik "+ Tambah Aset".'}</div>}
      {aset.some(x => !x.aktif) && <p className="kecil">{aset.filter(x => !x.aktif).length} aset nonaktif (rusak dibuang / hilang) disembunyikan.
        {' '}<a href="#" onClick={e => { e.preventDefault(); a.openModal('Aset Nonaktif', <>{aset.filter(x => !x.aktif).map(x =>
          <div className="kartu klik" key={x.id} onClick={() => a.openModal('Ubah Aset', <FormAset x={x} />)}><b>{x.nama}</b><div className="kecil">{x.catatan || '-'}</div></div>)}</>); }}>Lihat</a></p>}
    </> : <>
      <div className="aksi" style={{ marginTop: 0, marginBottom: 10 }}>
        <button className="btn" disabled={!aktif.some(x => x.bisa_dipinjam)} onClick={() => a.openModal('Catat Peminjaman', <FormPinjam c={c} />)}>+ Catat Peminjaman</button></div>
      {!aktif.some(x => x.bisa_dipinjam) && <p className="kecil">Belum ada aset yang ditandai &quot;bisa dipinjam&quot;. Ubah aset (mis. tenda, kursi) lalu centang &quot;Bisa dipinjam warga&quot;.</p>}
      {sedang.map(p => <KartuPinjam key={p.id} p={p} peta={peta} />)}
      {!sedang.length && <div className="kartu kosong">Tidak ada barang yang sedang dipinjam</div>}
      <div className="baris-flex klik" style={{ cursor: 'pointer', margin: '14px 0 8px' }} onClick={() => setRiwayat(!riwayat)}>
        <h3 className="spasi" style={{ margin: 0 }}>Riwayat pengembalian</h3><span>{riwayat ? '▲' : '▼'}</span></div>
      {riwayat && pinjam.filter(p => p.status === 'kembali').map(p => <KartuPinjam key={p.id} p={p} peta={peta} />)}
    </>}
  </>;
}

function KartuPinjam({ p, peta }) {
  const a = useApp();
  const barang = p.pinjam_item.map(i => `${peta[i.inventaris_id]?.nama || '?'} ${i.qty} ${peta[i.inventaris_id]?.satuan || ''}`).join(', ');
  const lambat = telat(p);
  const kembali = async () => {
    const cat = prompt(`Barang dari ${p.peminjam} sudah kembali?\nCatatan kondisi (kosongkan kalau semua baik):`, '');
    if (cat === null) return;
    await rpc('kembalikan_pinjam', { p_id: p.id, p_catatan: cat });
    a.toast('Pengembalian tercatat'); a.refresh();
  };
  const hapus = async () => {
    if (!confirm('Hapus catatan peminjaman ' + p.peminjam + '? (untuk salah input)')) return;
    await rpc('hapus_pinjam', { p_id: p.id }); a.toast('Dihapus'); a.refresh();
  };
  const ingatkan = `Assalamu'alaikum ${p.peminjam}, mengingatkan peminjaman inventaris masjid (${barang}) sejak ${tgl(p.tgl_pinjam)}, rencana kembali ${tgl(p.tgl_kembali)}. Mohon dikembalikan ke pengurus DKM. Jazakallah khairan.`;
  return <div className="kartu" style={lambat ? { borderColor: 'var(--merah)' } : {}}>
    <div className="baris-flex"><b className="spasi">{p.peminjam}</b>
      <span className={'badge ' + (p.status === 'kembali' ? 'b-abu' : lambat ? 'b-merah' : 'b-biru')}>{p.status === 'kembali' ? 'Sudah kembali' : lambat ? 'Terlambat' : 'Dipinjam'}</span></div>
    <div style={{ fontSize: 14, marginTop: 3 }}>{barang}</div>
    <div className="kecil">{tgl(p.tgl_pinjam)} s/d {tgl(p.tgl_kembali)}{p.keperluan ? ' · ' + p.keperluan : ''}{p.no_rumah ? ' · ' + p.no_rumah : ''}</div>
    <div className="kecil">Dicatat {a.nm(p.dicatat_by)}{p.kembali_at ? ` · diterima kembali ${a.nm(p.kembali_by)}, ${tgl(p.kembali_at.slice(0, 10))}` : ''}{p.kembali_catatan ? ' · ' + p.kembali_catatan : ''}</div>
    {p.status === 'dipinjam' && <div className="aksi" style={{ marginTop: 8 }}>
      {p.no_hp && <a className="btn sek kecil" href={waLink(p.no_hp, ingatkan)} target="_blank" rel="noreferrer">Ingatkan via WA</a>}
      <Btn className="btn kecil" onClick={kembali}>✓ Sudah Kembali</Btn></div>}
    {a.punya('admin', 'ketum') && <div style={{ textAlign: 'right' }}><Btn className="btn merah-sek kecil" style={{ marginTop: 6 }} onClick={hapus}>Hapus</Btn></div>}
  </div>;
}

function FormAset({ x }) {
  const a = useApp();
  const [f, setF] = useState({
    nama: x?.nama || '', kategori: x?.kategori || KATEGORI[0], jumlah: x?.jumlah ?? 1, satuan: x?.satuan || 'unit', kondisi: x?.kondisi || 'baik',
    lokasi: x?.lokasi || '', pinjam: !!x?.bisa_dipinjam, tgl: x?.tgl_perolehan || '', sumber: x?.sumber || '', nilai: x?.nilai || 0,
    catatan: x?.catatan || '', aktif: x ? x.aktif : true
  });
  const ubah = k => e => setF({ ...f, [k]: e.target.value });
  const simpan = async () => {
    if (!f.nama.trim()) return a.toast('Isi nama barang', true);
    const j = parseInt(f.jumlah);
    if (!(j >= 0)) return a.toast('Jumlah tidak valid', true);
    const row = { nama: f.nama.trim(), kategori: f.kategori, jumlah: j, satuan: f.satuan.trim() || 'unit', kondisi: f.kondisi,
      lokasi: f.lokasi.trim() || null, bisa_dipinjam: f.pinjam, tgl_perolehan: f.tgl || null, sumber: f.sumber.trim() || null,
      nilai: f.nilai || null, catatan: f.catatan.trim() || null, aktif: f.aktif };
    const { error } = x ? await sb().from('inventaris').update(row).eq('id', x.id) : await sb().from('inventaris').insert({ ...row, dibuat_by: a.me.id });
    if (error) throw error;
    a.closeModal(); a.toast('Tersimpan'); a.refresh();
  };
  const hapus = async () => {
    if (!confirm('Hapus permanen ' + x.nama + '? Kalau barang pernah dipinjam, lebih baik dinonaktifkan saja.')) return;
    const { error } = await sb().from('inventaris').delete().eq('id', x.id);
    if (error) throw new Error(/foreign key/.test(error.message) ? 'Barang ada di riwayat peminjaman, nonaktifkan saja' : error.message);
    a.closeModal(); a.toast('Dihapus'); a.refresh();
  };
  return <>
    <Field id="iNama" label="Nama barang" placeholder="contoh: Tenda 4x6, Kursi lipat, Sound portable" value={f.nama} onChange={ubah('nama')} />
    <label className="f" htmlFor="iKat">Kategori</label>
    <select className="f" id="iKat" value={f.kategori} onChange={ubah('kategori')}>{KATEGORI.map(k => <option key={k}>{k}</option>)}</select>
    <div className="baris-flex" style={{ gap: 8 }}>
      <div className="spasi"><Field id="iJml" label="Jumlah" type="number" min="0" inputMode="numeric" value={f.jumlah} onChange={ubah('jumlah')} /></div>
      <div className="spasi"><Field id="iSat" label="Satuan" placeholder="unit / buah / set / roll" value={f.satuan} onChange={ubah('satuan')} /></div>
    </div>
    <label className="f">Kondisi</label>
    <Chips items={Object.entries(KONDISI).map(([k, v]) => [k, v[0]])} value={f.kondisi} onChange={k => setF({ ...f, kondisi: k })} />
    <Field id="iLok" label="Lokasi penyimpanan (opsional)" placeholder="contoh: gudang belakang, ruang utama" value={f.lokasi} onChange={ubah('lokasi')} />
    <label className="f" style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12 }}>
      <input type="checkbox" checked={f.pinjam} onChange={e => setF({ ...f, pinjam: e.target.checked })} /> Bisa dipinjam warga</label>
    <Field id="iTgl" label="Tanggal perolehan (opsional)" type="date" value={f.tgl} onChange={ubah('tgl')} />
    <Field id="iSum" label="Sumber (opsional)" placeholder="beli / wakaf dari Bapak ... / hibah" value={f.sumber} onChange={ubah('sumber')} />
    <InputRp id="iNilai" label="Perkiraan nilai (Rp, opsional)" value={f.nilai} onChange={v => setF({ ...f, nilai: v })} />
    <label className="f" htmlFor="iCat">Catatan (opsional)</label>
    <textarea className="f" id="iCat" value={f.catatan} onChange={ubah('catatan')} />
    {x && <label className="f" style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12 }}>
      <input type="checkbox" checked={!f.aktif} onChange={e => setF({ ...f, aktif: !e.target.checked })} /> Nonaktifkan (sudah dibuang / hilang)</label>}
    <div className="aksi"><Btn onClick={simpan}>Simpan</Btn></div>
    {x && a.punya('admin', 'ketum') && <div className="aksi"><Btn className="btn merah-sek" onClick={hapus}>Hapus Permanen</Btn></div>}
  </>;
}

function FormPinjam({ c }) {
  const a = useApp();
  const bisa = c.aset.filter(x => x.aktif && x.bisa_dipinjam);
  const [f, setF] = useState({ nama: '', hp: '', rumah: '', perlu: '', dari: hariIni(), sampai: tambahHari(hariIni(), 2) });
  const [qty, setQty] = useState({});
  const ubah = k => e => setF({ ...f, [k]: e.target.value });
  const simpan = async () => {
    const items = Object.entries(qty).map(([id, n]) => ({ id: +id, qty: parseInt(n) || 0 })).filter(x => x.qty > 0);
    if (!f.nama.trim()) return a.toast('Isi nama peminjam', true);
    if (!items.length) return a.toast('Isi jumlah barang yang dipinjam', true);
    for (const it of items) if (it.qty > c.peta[it.id].tersedia) return a.toast(`${c.peta[it.id].nama} hanya tersedia ${c.peta[it.id].tersedia}`, true);
    await rpc('pinjamkan', { p_peminjam: f.nama, p_no_hp: f.hp, p_no_rumah: f.rumah, p_keperluan: f.perlu, p_tgl_pinjam: f.dari, p_tgl_kembali: f.sampai, p_items: items });
    a.closeModal(); a.toast('Peminjaman tercatat'); a.refresh();
  };
  return <>
    <Field id="pNama" label="Nama peminjam" list="pWarga" value={f.nama} onChange={e => {
      const w = c.warga.find(x => x.nama === e.target.value);
      setF({ ...f, nama: e.target.value, rumah: w?.alamat && !f.rumah ? w.alamat : f.rumah, hp: w?.no_hp && !f.hp ? w.no_hp : f.hp });
    }} />
    <datalist id="pWarga">{c.warga.map((w, i) => <option key={i} value={w.nama} />)}</datalist>
    <Field id="pHp" label="No. HP / WA (untuk pengingat)" inputMode="tel" value={f.hp} onChange={ubah('hp')} />
    <Field id="pRumah" label="No. rumah / alamat (opsional)" value={f.rumah} onChange={ubah('rumah')} />
    <Field id="pPerlu" label="Keperluan (opsional)" placeholder="contoh: hajatan, tahlilan" value={f.perlu} onChange={ubah('perlu')} />
    <div className="baris-flex" style={{ gap: 8 }}>
      <div className="spasi"><Field id="pDari" label="Tanggal pinjam" type="date" value={f.dari} onChange={ubah('dari')} /></div>
      <div className="spasi"><Field id="pSampai" label="Rencana kembali" type="date" value={f.sampai} onChange={ubah('sampai')} /></div>
    </div>
    <label className="f">Barang yang dipinjam (isi jumlahnya)</label>
    <div className="kartu" style={{ padding: '4px 12px' }}>{bisa.map(x => <div key={x.id} className="baris-flex" style={{ padding: '6px 0', borderBottom: '1px solid var(--garis)', gap: 8 }}>
      <span className="spasi">{x.nama}<div className="kecil">tersedia {x.tersedia} dari {x.jumlah} {x.satuan}</div></span>
      <input className="f" style={{ width: 80, margin: 0 }} type="number" min="0" max={x.tersedia} inputMode="numeric" placeholder="0" disabled={x.tersedia <= 0}
        value={qty[x.id] || ''} onChange={e => setQty({ ...qty, [x.id]: e.target.value })} aria-label={'Jumlah ' + x.nama} />
    </div>)}</div>
    <div className="aksi"><Btn onClick={simpan}>Simpan Peminjaman</Btn></div>
  </>;
}
