'use client';
import { useState } from 'react';
import { sb, rpc, q } from '@/lib/supabase';
import { bulanIni, hariIni, jam, jumatTerakhir, rp } from '@/lib/util';
import { Btn, Field, InputRp, Loading, useApp, useLoad } from './ui';

const ST = { menunggu: ['Menunggu Bendahara', 'b-kuning'], diterima: ['Diterima Bendahara', 'b-hijau'], ditolak: ['Ditolak · hitung ulang', 'b-merah'] };

export default function Keropak() {
  const a = useApp();
  const s = useLoad(() => q(sb().from('keropak_jumat').select('*').order('tanggal', { ascending: false }).order('id', { ascending: false }).limit(120)), [a.refreshKey]);
  if (!s.data) return <Loading s={s} />;
  const rows = s.data, th = hariIni().slice(0, 4), bl = bulanIni();
  const ok = rows.filter(r => r.status === 'diterima');
  const sumBl = ok.filter(r => r.tanggal.startsWith(bl)).reduce((x, r) => x + +r.jumlah, 0);
  const sumTh = ok.filter(r => r.tanggal.startsWith(th)).reduce((x, r) => x + +r.jumlah, 0);

  const verif = async (id, terima) => {
    let cat = null;
    if (!terima) { cat = prompt('Alasan penolakan (misal: jumlah tidak cocok):'); if (!cat) return; }
    else if (!confirm('Uang sudah Anda terima dan jumlahnya cocok?')) return;
    await rpc('verifikasi_keropak', { p_id: id, p_terima: terima, p_catatan: cat });
    a.toast(terima ? 'Keropak masuk kas' : 'Setoran ditolak'); a.refresh();
  };

  return <>
    <div className="baris-flex"><h2 className="spasi">Keropak Jumat</h2>
      <button className="btn kecil" onClick={() => a.openModal('Setor Keropak Jumat', <FormKeropak />)}>+ Setor</button></div>
    <div className="ringkas">
      <div className="kartu"><span className="kecil">Bulan ini</span><b>{rp(sumBl)}</b></div>
      <div className="kartu"><span className="kecil">Tahun {th}</span><b>{rp(sumTh)}</b></div>
    </div>
    {rows.length ? rows.map(r => (
      <div className="kartu" key={r.id}>
        <div className="baris-flex"><b>{new Date(r.tanggal + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</b>
          <span className="spasi" /><span className={'badge ' + ST[r.status][1]}>{ST[r.status][0]}</span></div>
        <div className="baris-flex" style={{ marginTop: 4 }}>
          <span className="kecil spasi">Disetor {a.nm(r.disetor_by)} · saksi: {[r.saksi1, r.saksi2].filter(Boolean).join(', ')}</span>
          <span className="nominal masuk">{rp(r.jumlah)}</span></div>
        {r.catatan && <div className="kecil">Catatan: {r.catatan}</div>}
        {r.verif_at && <div className="kecil">{r.status === 'diterima' ? 'Diterima' : 'Ditolak'} {a.nm(r.verif_by)} · {jam(r.verif_at)}{r.verif_catatan ? ' · ' + r.verif_catatan : ''}</div>}
        {r.status === 'menunggu' && a.punya('bendahara') && <div className="aksi">
          <Btn className="btn merah-sek kecil" onClick={() => verif(r.id, false)}>Tolak</Btn>
          <Btn className="btn kecil" onClick={() => verif(r.id, true)}>✓ Terima {rp(r.jumlah)}</Btn></div>}
      </div>)) : <div className="kartu kosong">Belum ada setoran keropak</div>}
  </>;
}

export function FormKeropak() {
  const a = useApp();
  const [f, setF] = useState({ tgl: jumatTerakhir(), jml: 0, s1: '', s2: '', cat: '' });
  const kirim = async () => {
    if (!f.jml) return a.toast('Isi jumlah uang', true);
    if (!confirm(`Setor keropak ${rp(f.jml)}?`)) return;
    await rpc('setor_keropak', { p_tanggal: f.tgl, p_jumlah: f.jml, p_saksi1: f.s1, p_saksi2: f.s2, p_catatan: f.cat.trim() || null });
    a.closeModal(); a.toast('Setoran tercatat, menunggu Bendahara'); a.go('keropak'); a.refresh();
  };
  return <>
    <Field id="kTgl" label="Tanggal Jumat" type="date" value={f.tgl} onChange={e => setF({ ...f, tgl: e.target.value })} />
    <InputRp id="kJml" label="Jumlah uang hasil hitung (Rp)" value={f.jml} onChange={v => setF({ ...f, jml: v })} />
    <Field id="kS1" label="Saksi penghitungan 1" placeholder="Nama saksi" value={f.s1} onChange={e => setF({ ...f, s1: e.target.value })} />
    <Field id="kS2" label="Saksi penghitungan 2 (opsional)" placeholder="Nama saksi" value={f.s2} onChange={e => setF({ ...f, s2: e.target.value })} />
    <label className="f" htmlFor="kCat2">Catatan (opsional)</label>
    <textarea className="f" id="kCat2" placeholder="contoh: ada uang asing / rusak" value={f.cat} onChange={e => setF({ ...f, cat: e.target.value })} />
    <div className="aksi"><Btn onClick={kirim}>Setor ke Bendahara</Btn></div>
    <p className="kecil">Uang diserahkan ke Bendahara. Masuk kas setelah Bendahara klik &quot;Terima&quot;.</p>
  </>;
}
