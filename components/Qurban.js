'use client';
import { useState } from 'react';
import { sb, q } from '@/lib/supabase';
import { NAMA_DKM, cetak, esc, hariIni, rp, tgl, unduhCSV } from '@/lib/util';
import { Btn, Chips, Field, InputRp, Loading, useApp, useLoad } from './ui';
import { tahunHijriah } from './Zakat';

const KAT = { shohibul: 'Shohibul Qurban', warga: 'Warga', dhuafa: 'Dhuafa', panitia: 'Panitia', lainnya: 'Lainnya' };
const jumlah = (rows, k) => rows.reduce((x, r) => x + +r[k], 0);
const CSS = `.qb-slot{display:flex;justify-content:space-between;gap:8px;padding:7px 0;border-bottom:1px dashed var(--garis);font-size:14px;cursor:pointer}
.qb-slot:last-child{border:0}.qb-slot.kosong{color:var(--redup);cursor:default;font-style:italic}
.qb-bar{height:6px;border-radius:4px;background:#eee;overflow:hidden;margin-top:6px}.qb-bar div{height:100%;background:var(--hijau)}
.qb-cek{display:flex;gap:10px;align-items:center;padding:8px 0;border-bottom:1px solid var(--garis)}.qb-cek input{width:22px;height:22px}`;

export default function Qurban() {
  const a = useApp();
  const [th, setTh] = useState(tahunHijriah());
  const tab = a.sub.qurban || 'peserta';
  const s = useLoad(async () => {
    const [set, peserta, bagi, warga] = await Promise.all([
      q(sb().from('qurban_setting').select('*').eq('tahun', th).maybeSingle()),
      q(sb().from('qurban_peserta').select('*, qurban_bayar(*)').eq('tahun', th).order('kelompok', { nullsFirst: false }).order('id')),
      q(sb().from('qurban_bagi').select('*').eq('tahun', th).order('id')),
      q(sb().from('warga').select('nama,alamat').eq('aktif', true).order('nama'))
    ]);
    peserta.forEach(p => { p.bayar = (p.qurban_bayar || []).sort((x, y) => x.id - y.id); p.sudah = jumlah(p.bayar, 'jumlah'); });
    return { set, peserta, bagi, warga };
  }, [a.refreshKey, th]);

  const atur = a.punya('admin', 'ketum');
  const head = <div className="baris-flex"><h2 className="spasi">Qurban</h2>
    <select className="f" style={{ width: 'auto', margin: 0 }} value={th} onChange={e => setTh(+e.target.value)} aria-label="Tahun">
      {[-2, -1, 0, 1].map(d => tahunHijriah() + d).map(t => <option key={t} value={t}>Idul Adha {t} H</option>)}</select></div>;
  if (!s.data) return <>{head}<Loading s={s} /></>;
  const { set, peserta, bagi, warga } = s.data;
  const c = { th, set, peserta, bagi, warga };

  const sapi = peserta.filter(p => p.jenis === 'sapi'), kambing = peserta.filter(p => p.jenis === 'kambing');
  const kelompok = [...new Set(sapi.map(p => p.kelompok))].sort((x, y) => x - y);
  const target = jumlah(peserta, 'target'), masuk = jumlah(peserta, 'sudah');
  const lunas = peserta.filter(p => p.sudah >= p.target).length;
  const bukaPeserta = p => a.openModal(p.nama, <DetailPeserta p={p} c={c} />);

  return <>
    <style>{CSS}</style>
    {head}
    {set ? <div className="kecil" style={{ marginBottom: 8 }}>Sapi {rp(set.harga_sapi)} (per orang {rp(Math.ceil(set.harga_sapi / 7))}) · Kambing {rp(set.harga_kambing)}
      {atur && <> · <a href="#" onClick={e => { e.preventDefault(); a.openModal('Harga Qurban ' + th + ' H', <FormHarga th={th} set={set} />); }}>ubah</a></>}</div>
      : <div className="kartu"><b>Harga hewan qurban {th} H belum diatur.</b>
        <div className="kecil">{atur ? 'Atur dulu harga sapi & kambing.' : 'Minta Admin / Ketua Umum mengatur harga.'}</div>
        {atur && <div className="aksi"><button className="btn" onClick={() => a.openModal('Harga Qurban ' + th + ' H', <FormHarga th={th} />)}>Atur Harga</button></div>}</div>}

    <div className="ringkas">
      <div className="kartu"><span className="kecil">Hewan</span><b>{kelompok.length} sapi · {kambing.length} kambing</b>
        <span className="kecil">{peserta.length} shohibul qurban</span></div>
      <div className="kartu"><span className="kecil">Terkumpul ({lunas}/{peserta.length} lunas)</span><b>{rp(masuk)}</b>
        <span className="kecil">dari {rp(target)}</span></div>
    </div>

    <Chips items={[['peserta', 'Peserta'], ['bagi', 'Penerima Daging'], ['laporan', 'Laporan']]} value={tab} onChange={k => a.setSub('qurban', k)} />

    {tab === 'peserta' && <>
      <div className="aksi" style={{ marginTop: 0, marginBottom: 10 }}>
        <button className="btn" disabled={!set} onClick={() => a.openModal('Daftar Qurban', <FormDaftar c={c} />)}>+ Daftar Shohibul Qurban</button></div>
      {kelompok.map(k => {
        const anggota = sapi.filter(p => p.kelompok === k), sdh = jumlah(anggota, 'sudah'), tgt = jumlah(anggota, 'target');
        return <div className="kartu" key={k}>
          <div className="baris-flex"><b className="spasi">🐄 Sapi Kelompok {k}</b>
            <span className={'badge ' + (anggota.length === 7 ? 'b-hijau' : 'b-kuning')}>{anggota.length}/7 orang</span></div>
          <div className="qb-bar"><div style={{ width: Math.min(100, tgt ? sdh / tgt * 100 : 0) + '%' }} /></div>
          <div className="kecil" style={{ marginBottom: 4 }}>{rp(sdh)} dari {rp(tgt)}</div>
          {anggota.map(p => <Slot key={p.id} p={p} onClick={() => bukaPeserta(p)} />)}
          {Array.from({ length: 7 - anggota.length }, (_, i) => <div key={'k' + i} className="qb-slot kosong">Slot kosong</div>)}
        </div>;
      })}
      {kambing.length > 0 && <div className="kartu">
        <b>🐐 Kambing / Domba ({kambing.length} ekor)</b>
        {kambing.map(p => <Slot key={p.id} p={p} onClick={() => bukaPeserta(p)} />)}
      </div>}
      {!peserta.length && <div className="kartu kosong">Belum ada pendaftar qurban</div>}
    </>}
    {tab === 'bagi' && <Penerima c={c} />}
    {tab === 'laporan' && <Laporan c={c} kelompok={kelompok} />}
  </>;
}

function Slot({ p, onClick }) {
  const lunas = p.sudah >= p.target;
  return <div className="qb-slot" onClick={onClick}>
    <span className="spasi">{p.nama}{p.atas_nama ? <span className="kecil"> (a.n. {p.atas_nama})</span> : null}{p.no_rumah ? <span className="kecil"> · {p.no_rumah}</span> : null}</span>
    <span className={'badge ' + (lunas ? 'b-hijau' : p.sudah ? 'b-biru' : 'b-merah')}>{lunas ? 'Lunas' : p.sudah ? 'Kurang ' + rp(p.target - p.sudah) : 'Belum bayar'}</span>
  </div>;
}

function FormHarga({ th, set }) {
  const a = useApp();
  const [f, setF] = useState({ s: set?.harga_sapi || 0, k: set?.harga_kambing || 0, cat: set?.catatan || '' });
  const simpan = async () => {
    if (!f.s && !f.k) return a.toast('Isi harga sapi / kambing', true);
    const { error } = await sb().from('qurban_setting').upsert({ tahun: th, harga_sapi: f.s, harga_kambing: f.k, catatan: f.cat.trim() || null, diubah_by: a.me.id, diubah_at: new Date().toISOString() });
    if (error) throw error;
    a.closeModal(); a.toast('Harga tersimpan'); a.refresh();
  };
  return <>
    <InputRp id="qS" label="Harga 1 ekor sapi (Rp) — dibagi 7 orang" value={f.s} onChange={v => setF({ ...f, s: v })} />
    {f.s > 0 && <div className="kecil">Per orang: {rp(Math.ceil(f.s / 7))}</div>}
    <InputRp id="qK" label="Harga 1 ekor kambing / domba (Rp)" value={f.k} onChange={v => setF({ ...f, k: v })} />
    <label className="f" htmlFor="qCat">Catatan (opsional)</label>
    <textarea className="f" id="qCat" placeholder="contoh: sudah termasuk biaya penyembelihan" value={f.cat} onChange={e => setF({ ...f, cat: e.target.value })} />
    <div className="aksi"><Btn onClick={simpan}>Simpan</Btn></div>
    <p className="kecil">Harga baru hanya berlaku untuk pendaftar berikutnya.</p>
  </>;
}

function FormDaftar({ c }) {
  const a = useApp();
  const sapi = c.peserta.filter(p => p.jenis === 'sapi');
  const isi = {}; sapi.forEach(p => isi[p.kelompok] = (isi[p.kelompok] || 0) + 1);
  const ada = Object.keys(isi).map(Number).sort((x, y) => x - y);
  const baru = (ada.length ? Math.max(...ada) : 0) + 1;
  const pilihan = [...ada.filter(k => isi[k] < 7), baru];
  const perSapi = Math.ceil(+c.set.harga_sapi / 7), perKambing = +c.set.harga_kambing;
  const [f, setF] = useState({ jenis: 'sapi', kel: pilihan[0], nama: '', an: '', rumah: '', hp: '', target: perSapi, dp: 0, metode: 'tunai', cat: '' });

  const simpan = async () => {
    if (!f.nama.trim()) return a.toast('Isi nama', true);
    if (!f.target) return a.toast('Isi harga yang harus dibayar', true);
    if (f.dp > f.target) return a.toast('Pembayaran awal melebihi harga', true);
    const { data, error } = await sb().from('qurban_peserta').insert({
      tahun: c.th, jenis: f.jenis, kelompok: f.jenis === 'sapi' ? +f.kel : null, nama: f.nama.trim(), atas_nama: f.an.trim() || null,
      no_rumah: f.rumah.trim() || null, no_hp: f.hp.trim() || null, target: f.target, catatan: f.cat.trim() || null, dicatat_by: a.me.id
    }).select('id').single();
    if (error) throw error;
    if (f.dp) {
      const r = await sb().from('qurban_bayar').insert({ peserta_id: data.id, jumlah: f.dp, metode: f.metode, tanggal: hariIni(), dicatat_by: a.me.id });
      if (r.error) throw r.error;
    }
    a.closeModal(); a.toast(f.nama.trim() + ' terdaftar'); a.refresh();
  };

  return <>
    <Chips items={[['sapi', 'Sapi (patungan 7)'], ['kambing', 'Kambing / Domba']]} value={f.jenis}
      onChange={k => setF({ ...f, jenis: k, target: k === 'sapi' ? perSapi : perKambing })} />
    {f.jenis === 'sapi' && <>
      <label className="f" htmlFor="qKel">Kelompok sapi</label>
      <select className="f" id="qKel" value={f.kel} onChange={e => setF({ ...f, kel: e.target.value })}>
        {pilihan.map(k => <option key={k} value={k}>{k === baru ? `Kelompok ${k} (baru)` : `Kelompok ${k} — ${isi[k]}/7, sisa ${7 - isi[k]} slot`}</option>)}</select></>}
    <Field id="qNama" label="Nama shohibul qurban" list="qWarga" value={f.nama} onChange={e => {
      const w = c.warga.find(x => x.nama === e.target.value);
      setF({ ...f, nama: e.target.value, rumah: w?.alamat && !f.rumah ? w.alamat : f.rumah });
    }} />
    <datalist id="qWarga">{c.warga.map((w, i) => <option key={i} value={w.nama} />)}</datalist>
    <Field id="qAn" label="Qurban atas nama (kalau beda, opsional)" placeholder="contoh: almarhum ayah" value={f.an} onChange={e => setF({ ...f, an: e.target.value })} />
    <Field id="qRumah" label="No. rumah / alamat (opsional)" value={f.rumah} onChange={e => setF({ ...f, rumah: e.target.value })} />
    <Field id="qHp" label="No. HP / WA (opsional)" inputMode="tel" value={f.hp} onChange={e => setF({ ...f, hp: e.target.value })} />
    <InputRp id="qTarget" label="Harga yang harus dibayar (Rp)" value={f.target} onChange={v => setF({ ...f, target: v })} />
    <InputRp id="qDp" label="Bayar sekarang / DP (opsional)" value={f.dp} onChange={v => setF({ ...f, dp: v })} />
    {f.dp > 0 && <Chips items={[['tunai', 'Tunai'], ['transfer', 'Transfer']]} value={f.metode} onChange={k => setF({ ...f, metode: k })} />}
    <label className="f" htmlFor="qCat2">Catatan (opsional)</label>
    <textarea className="f" id="qCat2" value={f.cat} onChange={e => setF({ ...f, cat: e.target.value })} />
    <div className="aksi"><Btn onClick={simpan}>Daftarkan</Btn></div>
  </>;
}

function DetailPeserta({ p, c }) {
  const a = useApp();
  const [f, setF] = useState({ jml: Math.max(0, p.target - p.sudah), metode: 'tunai' });
  const kurang = p.target - p.sudah;
  const boleh = x => x.dicatat_by === a.me.id || a.punya('admin', 'ketum', 'bendahara');
  const bayar = async () => {
    if (!f.jml) return a.toast('Isi jumlah', true);
    if (f.jml > kurang) return a.toast('Melebihi kekurangan ' + rp(kurang), true);
    const { error } = await sb().from('qurban_bayar').insert({ peserta_id: p.id, jumlah: f.jml, metode: f.metode, tanggal: hariIni(), dicatat_by: a.me.id });
    if (error) throw error;
    a.closeModal(); a.toast('Pembayaran ' + rp(f.jml) + ' tercatat'); a.refresh();
  };
  const hapusBayar = async b => {
    if (!confirm('Hapus pembayaran ' + rp(b.jumlah) + '?')) return;
    const { error } = await sb().from('qurban_bayar').delete().eq('id', b.id);
    if (error) throw error;
    a.closeModal(); a.toast('Pembayaran dihapus'); a.refresh();
  };
  const hapus = async () => {
    if (p.bayar.length) return a.toast('Hapus dulu semua pembayarannya', true);
    if (!confirm('Hapus pendaftaran ' + p.nama + '?')) return;
    const { error } = await sb().from('qurban_peserta').delete().eq('id', p.id);
    if (error) throw error;
    a.closeModal(); a.toast('Pendaftaran dihapus'); a.refresh();
  };
  const sapiLain = [...new Set(c.peserta.filter(x => x.jenis === 'sapi').map(x => x.kelompok))];
  const pindah = async () => {
    const k = parseInt(prompt('Pindah ke kelompok sapi nomor? (yang ada: ' + sapiLain.join(', ') + ')', p.kelompok));
    if (!k || k === p.kelompok) return;
    const { error } = await sb().from('qurban_peserta').update({ kelompok: k }).eq('id', p.id);
    if (error) throw error;
    a.closeModal(); a.toast('Dipindah ke kelompok ' + k); a.refresh();
  };

  return <>
    <div className="kecil">{p.jenis === 'sapi' ? 'Sapi kelompok ' + p.kelompok : 'Kambing / domba'}{p.atas_nama ? ' · atas nama ' + p.atas_nama : ''}
      {p.no_rumah ? ' · ' + p.no_rumah : ''}{p.no_hp ? <> · <a href={'https://wa.me/' + p.no_hp.replace(/\D/g, '').replace(/^0/, '62')} target="_blank" rel="noreferrer">{p.no_hp}</a></> : ''}</div>
    {p.catatan && <div className="kecil">Catatan: {p.catatan}</div>}
    <div className="total-box"><span>Dibayar {rp(p.sudah)} / {rp(p.target)}</span><span>{kurang > 0 ? 'Kurang ' + rp(kurang) : 'LUNAS'}</span></div>
    <h3>Riwayat pembayaran</h3>
    {p.bayar.length ? p.bayar.map((b, i) => <div className="baris-flex" key={b.id} style={{ padding: '6px 0', borderBottom: '1px solid var(--garis)' }}>
      <span className="spasi kecil">Cicilan {i + 1} · {tgl(b.tanggal)} · {b.metode} · {a.nm(b.dicatat_by)}</span>
      <b className="masuk">{rp(b.jumlah)}</b>
      {boleh(b) && <Btn className="btn merah-sek kecil" style={{ marginLeft: 6 }} onClick={() => hapusBayar(b)}>✕</Btn>}
    </div>) : <div className="kecil">Belum ada pembayaran</div>}
    {kurang > 0 && <>
      <InputRp id="qBayar" label="Terima pembayaran / cicilan (Rp)" value={f.jml} onChange={v => setF({ ...f, jml: v })} />
      <Chips items={[['tunai', 'Tunai'], ['transfer', 'Transfer']]} value={f.metode} onChange={k => setF({ ...f, metode: k })} />
      <div className="aksi"><Btn onClick={bayar}>Catat Pembayaran</Btn></div>
    </>}
    {boleh(p) && <div className="aksi">
      {p.jenis === 'sapi' && <Btn className="btn sek" onClick={pindah}>Pindah Kelompok</Btn>}
      <Btn className="btn merah-sek" onClick={hapus}>Hapus Pendaftaran</Btn></div>}
  </>;
}

function Penerima({ c }) {
  const a = useApp();
  const [cari, setCari] = useState('');
  const rows = c.bagi.filter(r => !cari || r.nama.toLowerCase().includes(cari.toLowerCase()));
  const kantong = jumlah(c.bagi, 'kantong'), diambil = c.bagi.filter(r => r.diambil).reduce((x, r) => x + r.kantong, 0);
  const tandai = async r => {
    const { error } = await sb().from('qurban_bagi').update({ diambil: !r.diambil }).eq('id', r.id);
    if (error) return a.toast(error.message, true);
    a.refresh();
  };
  const cetakKupon = () => {
    const ok = cetak('Daftar Penerima Daging Qurban ' + c.th + ' H', `<h2>DAFTAR PENERIMA DAGING QURBAN ${c.th} H</h2><div class="sub">${esc(NAMA_DKM)}</div>
      <table class="data"><tr><th>No</th><th>Nama</th><th>Kategori</th><th>Kantong</th><th style="width:30%">Paraf</th></tr>
      ${c.bagi.map((r, i) => `<tr><td>${i + 1}</td><td>${esc(r.nama)}</td><td>${KAT[r.kategori]}</td><td class="r">${r.kantong}</td><td></td></tr>`).join('')}
      <tr><th colspan="3">Total</th><th class="r">${kantong}</th><th></th></tr></table>`);
    if (!ok) a.toast('Izinkan pop-up untuk mencetak', true);
  };
  return <>
    <div className="kartu"><b>{c.bagi.length} penerima · {kantong} kantong</b>
      <div className="kecil">Sudah diambil: {diambil} kantong · belum: {kantong - diambil}</div>
      <div className="aksi">
        <button className="btn" onClick={() => a.openModal('Tambah Penerima', <FormPenerima c={c} />)}>+ Tambah Penerima</button>
        <button className="btn sek" onClick={cetakKupon} disabled={!c.bagi.length}>Cetak Daftar</button></div></div>
    {c.bagi.length > 5 && <input className="f" placeholder="Cari nama…" value={cari} onChange={e => setCari(e.target.value)} />}
    <div className="kartu">{rows.length ? rows.map(r => <label key={r.id} className="qb-cek">
      <input type="checkbox" checked={r.diambil} onChange={() => tandai(r)} />
      <span className="spasi" style={r.diambil ? { textDecoration: 'line-through', color: 'var(--redup)' } : {}}>{r.nama}
        <span className="kecil"> · {KAT[r.kategori]} · {r.kantong} kantong</span></span>
      {(r.dicatat_by === a.me.id || a.punya('admin', 'ketum')) && <button className="btn merah-sek kecil" onClick={async e => {
        e.preventDefault(); if (!confirm('Hapus ' + r.nama + '?')) return;
        const { error } = await sb().from('qurban_bagi').delete().eq('id', r.id);
        if (error) return a.toast(error.message, true); a.refresh();
      }}>✕</button>}
    </label>) : <div className="kosong">Belum ada penerima</div>}</div>
  </>;
}

function FormPenerima({ c }) {
  const a = useApp();
  const [f, setF] = useState({ teks: '', kat: 'warga', kantong: 1 });
  const ada = new Set(c.bagi.map(r => r.nama.trim().toLowerCase()));
  const isiDari = (nama, kat) => {
    const baru = [...new Set(nama)].filter(n => n && !ada.has(n.trim().toLowerCase()));
    setF({ ...f, kat, teks: baru.join('\n') });
    if (!baru.length) a.toast('Semua nama sudah ada di daftar');
  };
  const simpan = async () => {
    const nama = [...new Set(f.teks.split('\n').map(x => x.trim()).filter(Boolean))].filter(n => !ada.has(n.toLowerCase()));
    if (!nama.length) return a.toast('Tulis minimal 1 nama baru', true);
    const k = Math.max(1, parseInt(f.kantong) || 1);
    const { error } = await sb().from('qurban_bagi').insert(nama.map(n => ({ tahun: c.th, nama: n, kategori: f.kat, kantong: k, dicatat_by: a.me.id })));
    if (error) throw error;
    a.closeModal(); a.toast(nama.length + ' penerima ditambahkan'); a.refresh();
  };
  return <>
    <div className="aksi" style={{ marginTop: 0 }}>
      <button className="btn sek kecil" onClick={() => isiDari(c.peserta.map(p => p.nama), 'shohibul')}>Ambil semua shohibul qurban</button>
      <button className="btn sek kecil" onClick={() => isiDari(c.warga.map(w => w.nama), 'warga')}>Ambil semua data warga</button></div>
    <label className="f" htmlFor="pgT">Nama penerima (satu per baris)</label>
    <textarea className="f" id="pgT" rows={8} value={f.teks} onChange={e => setF({ ...f, teks: e.target.value })} />
    <label className="f" htmlFor="pgK">Kategori</label>
    <select className="f" id="pgK" value={f.kat} onChange={e => setF({ ...f, kat: e.target.value })}>
      {Object.entries(KAT).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
    <Field id="pgN" label="Jumlah kantong per orang" type="number" min="1" value={f.kantong} onChange={e => setF({ ...f, kantong: e.target.value })} />
    <div className="aksi"><Btn onClick={simpan}>Tambahkan</Btn></div>
    <p className="kecil">Nama yang sudah ada di daftar otomatis dilewati.</p>
  </>;
}

function Laporan({ c, kelompok }) {
  const a = useApp();
  const { th, peserta } = c;
  const sapi = peserta.filter(p => p.jenis === 'sapi'), kambing = peserta.filter(p => p.jenis === 'kambing');
  const st = p => p.sudah >= p.target ? '✅' : `(kurang ${rp(p.target - p.sudah)})`;
  const nm = p => p.nama + (p.atas_nama ? ` a.n. ${p.atas_nama}` : '');
  const teks = [`*DAFTAR SHOHIBUL QURBAN ${th} H*`, `*${NAMA_DKM}*`, '',
    ...kelompok.flatMap(k => { const g = sapi.filter(p => p.kelompok === k); return [`*Sapi Kelompok ${k}* (${g.length}/7)`, ...g.map((p, i) => `${i + 1}. ${nm(p)} ${st(p)}`), '']; }),
    ...(kambing.length ? ['*Kambing / Domba*', ...kambing.map((p, i) => `${i + 1}. ${nm(p)} ${st(p)}`), ''] : []),
    `Total: ${kelompok.length} sapi, ${kambing.length} kambing, ${peserta.length} shohibul qurban`,
    `Terkumpul ${rp(jumlah(peserta, 'sudah'))} dari ${rp(jumlah(peserta, 'target'))}`,
    ...(kelompok.some(k => sapi.filter(p => p.kelompok === k).length < 7) ? ['', 'Masih ada slot kosong di kelompok sapi, silakan hubungi panitia.'] : [])
  ].join('\n');
  const excel = () => unduhCSV(`qurban-${th}H.csv`, [['Jenis', 'Kelompok', 'Nama', 'Atas Nama', 'No Rumah', 'No HP', 'Harga', 'Dibayar', 'Kurang', 'Status'],
    ...peserta.map(p => [p.jenis, p.kelompok || '', p.nama, p.atas_nama, p.no_rumah, p.no_hp, +p.target, p.sudah, p.target - p.sudah, p.sudah >= p.target ? 'Lunas' : 'Belum lunas'])]);
  return <>
    <div className="kartu"><pre style={{ whiteSpace: 'pre-wrap', margin: 0, font: 'inherit', fontSize: 13.5 }}>{teks.replace(/\*/g, '')}</pre></div>
    <div className="aksi">
      <a className="btn" href={'https://wa.me/?text=' + encodeURIComponent(teks)} target="_blank" rel="noreferrer">Bagikan ke WA</a>
      <Btn className="btn sek" onClick={async () => { await navigator.clipboard.writeText(teks); a.toast('Teks disalin'); }}>Salin Teks</Btn>
      <button className="btn sek" onClick={excel}>Unduh Excel</button>
    </div>
  </>;
}
