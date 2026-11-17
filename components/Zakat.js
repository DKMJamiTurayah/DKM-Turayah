'use client';
import { useState } from 'react';
import { sb, q } from '@/lib/supabase';
import { NAMA_DKM, cetak, esc, hariIni, rp, tgl, unduhCSV } from '@/lib/util';
import { Btn, Chips, Field, InputRp, Loading, useApp, useLoad } from './ui';

export const ASNAF = {
  fakir: 'Fakir', miskin: 'Miskin', amil: 'Amil', mualaf: 'Mualaf',
  riqab: 'Riqab', gharim: 'Gharim', fisabilillah: 'Fisabilillah', ibnu_sabil: 'Ibnu Sabil'
};
const JENIS = { fitrah: 'Zakat Fitrah', fidyah: 'Fidyah' };

// tahun hijriah berjalan (mis. 1448)
export function tahunHijriah() {
  try {
    const s = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { year: 'numeric', timeZone: 'Asia/Jakarta' }).format(new Date());
    return parseInt(s.replace(/\D/g, ''), 10) || 1448;
  } catch { return 1448; }
}
const kgTeks = n => (+n || 0).toLocaleString('id-ID', { maximumFractionDigits: 2 }) + ' kg';
const desimal = v => { const n = parseFloat(String(v ?? '').replace(',', '.')); return isNaN(n) ? 0 : Math.round(n * 100) / 100; };
const isiTeks = r => [r.beras_kg > 0 && kgTeks(r.beras_kg), r.uang > 0 && rp(r.uang)].filter(Boolean).join(' + ');
const jumlah = (rows, k) => rows.reduce((x, r) => x + +r[k], 0);

export default function Zakat() {
  const a = useApp();
  const [th, setTh] = useState(tahunHijriah());
  const [cari, setCari] = useState('');
  const tab = a.sub.zakat || 'terima';
  const s = useLoad(async () => {
    const [set, terima, salur, warga] = await Promise.all([
      q(sb().from('zakat_tahun').select('*').eq('tahun', th).maybeSingle()),
      q(sb().from('zakat_terima').select('*').eq('tahun', th).order('id', { ascending: false })),
      q(sb().from('zakat_salur').select('*').eq('tahun', th).order('id', { ascending: false })),
      q(sb().from('warga').select('nama,alamat').eq('aktif', true).order('nama'))
    ]);
    return { set, terima, salur, warga };
  }, [a.refreshKey, th]);

  const atur = a.punya('admin', 'ketum');
  const head = <>
    <div className="baris-flex"><h2 className="spasi">Zakat Fitrah &amp; Fidyah</h2>
      <select className="f" style={{ width: 'auto', margin: 0 }} value={th} onChange={e => setTh(+e.target.value)} aria-label="Tahun">
        {[0, -1, -2].map(d => tahunHijriah() + d).concat(tahunHijriah() + 1).sort().map(t => <option key={t} value={t}>{t} H</option>)}
      </select></div>
  </>;
  if (!s.data) return <>{head}<Loading s={s} /></>;
  const { set, terima, salur, warga } = s.data;

  const tB = jumlah(terima, 'beras_kg'), tU = jumlah(terima, 'uang');
  const sB = jumlah(salur, 'beras_kg'), sU = jumlah(salur, 'uang');
  const jiwa = terima.filter(r => r.jenis === 'fitrah').reduce((x, r) => x + r.jiwa, 0);
  const ctx = { th, set, terima, salur, warga, sisaB: tB - sB, sisaU: tU - sU };

  const hapus = async (tabel, r) => {
    if (!confirm(`Hapus data ${r.nama} (${isiTeks(r)})?`)) return;
    const { error } = await sb().from(tabel).delete().eq('id', r.id);
    if (error) throw error;
    a.toast('Data dihapus'); a.refresh();
  };
  const bolehHapus = r => r.dicatat_by === a.me.id || atur;
  const cocok = r => !cari || (r.nama + ' ' + (r.no_rumah || r.alamat || '')).toLowerCase().includes(cari.toLowerCase());

  return <>
    {head}
    {set ? <div className="kecil" style={{ marginBottom: 8 }}>
      Fitrah: {kgTeks(set.beras_kg)} / {rp(set.uang_jiwa)} per jiwa · Fidyah: {kgTeks(set.fidyah_beras_kg)} / {rp(set.fidyah_uang)} per hari
      {atur && <> · <a href="#" onClick={e => { e.preventDefault(); a.openModal('Besaran Zakat ' + th + ' H', <FormBesaran th={th} set={set} />); }}>ubah</a></>}
    </div> : <div className="kartu" style={{ borderColor: 'var(--kuning, #e0a800)' }}>
      <b>Besaran zakat {th} H belum diatur.</b>
      <div className="kecil">{atur ? 'Atur dulu besaran per jiwa & fidyah per hari.' : 'Minta Admin / Ketua Umum mengatur besaran zakat tahun ini.'}</div>
      {atur && <div className="aksi"><button className="btn" onClick={() => a.openModal('Besaran Zakat ' + th + ' H', <FormBesaran th={th} />)}>Atur Besaran</button></div>}
    </div>}

    <div className="ringkas">
      <div className="kartu"><span className="kecil">Terkumpul</span><b>{kgTeks(tB)}</b><div><b>{rp(tU)}</b></div>
        <span className="kecil">{terima.length} muzakki · {jiwa} jiwa</span></div>
      <div className="kartu"><span className="kecil">Sisa belum disalurkan</span><b className={tB - sB > 0 ? 'keluar' : ''}>{kgTeks(tB - sB)}</b>
        <div><b className={tU - sU > 0 ? 'keluar' : ''}>{rp(tU - sU)}</b></div><span className="kecil">{salur.length} mustahik</span></div>
    </div>

    <Chips items={[['terima', 'Penerimaan'], ['salur', 'Penyaluran'], ['laporan', 'Laporan']]} value={tab} onChange={k => a.setSub('zakat', k)} />

    {tab === 'laporan' ? <Laporan c={ctx} /> : <>
      <div className="baris-flex" style={{ gap: 8, marginBottom: 8 }}>
        <input className="f spasi" style={{ margin: 0 }} placeholder="Cari nama / no rumah…" value={cari} onChange={e => setCari(e.target.value)} />
        {tab === 'terima'
          ? <button className="btn kecil" disabled={!set} onClick={() => a.openModal('Catat Penerimaan', <FormTerima c={ctx} />)}>+ Terima</button>
          : <button className="btn kecil" onClick={() => a.openModal('Catat Penyaluran', <FormSalur c={ctx} />)}>+ Salurkan</button>}
      </div>
      {(tab === 'terima' ? terima : salur).filter(cocok).map(r => (
        <div className="kartu" key={r.id}>
          <div className="baris-flex"><b className="spasi">{r.nama}</b>
            <span className={'badge ' + (tab === 'terima' ? (r.jenis === 'fitrah' ? 'b-hijau' : 'b-biru') : 'b-ungu')}>
              {tab === 'terima' ? JENIS[r.jenis] : ASNAF[r.asnaf]}</span></div>
          <div className="baris-flex" style={{ marginTop: 4 }}>
            <span className="kecil spasi">
              {tab === 'terima'
                ? <>{r.no_rumah ? 'Rumah ' + r.no_rumah + ' · ' : ''}{r.jenis === 'fitrah' ? r.jiwa + ' jiwa' : r.hari + ' hari'}</>
                : <>{r.alamat || 'Penerima'}</>}
              <br />dicatat {a.nm(r.dicatat_by)} · {tgl(r.tanggal)}{r.catatan ? ' · ' + r.catatan : ''}</span>
            <span className={'nominal ' + (tab === 'terima' ? 'masuk' : 'keluar')}>{isiTeks(r)}</span></div>
          {bolehHapus(r) && <div className="aksi" style={{ marginTop: 6 }}>
            <Btn className="btn merah-sek kecil" style={{ flex: 'none', minWidth: 0 }} onClick={() => hapus(tab === 'terima' ? 'zakat_terima' : 'zakat_salur', r)}>Hapus</Btn></div>}
        </div>))}
      {!(tab === 'terima' ? terima : salur).filter(cocok).length && <div className="kartu kosong">Belum ada data</div>}
    </>}
  </>;
}

function FormBesaran({ th, set }) {
  const a = useApp();
  const [f, setF] = useState({
    b: String(set?.beras_kg ?? 2.5).replace('.', ','), u: set?.uang_jiwa || 0,
    fb: String(set?.fidyah_beras_kg ?? 0.75).replace('.', ','), fu: set?.fidyah_uang || 0
  });
  const simpan = async () => {
    const row = { tahun: th, beras_kg: desimal(f.b), uang_jiwa: f.u, fidyah_beras_kg: desimal(f.fb), fidyah_uang: f.fu, diubah_by: a.me.id, diubah_at: new Date().toISOString() };
    if (!row.beras_kg || !row.uang_jiwa) return a.toast('Isi takaran beras dan uang per jiwa', true);
    const { error } = await sb().from('zakat_tahun').upsert(row);
    if (error) throw error;
    a.closeModal(); a.toast('Besaran tersimpan'); a.refresh();
  };
  return <>
    <p className="kecil">Sesuaikan dengan ketetapan BAZNAS / Kemenag daerah tahun {th} H.</p>
    <b>Zakat Fitrah per jiwa</b>
    <Field id="zB" label="Beras (kg)" inputMode="decimal" value={f.b} onChange={e => setF({ ...f, b: e.target.value })} />
    <InputRp id="zU" label="Atau uang (Rp)" value={f.u} onChange={v => setF({ ...f, u: v })} />
    <b style={{ display: 'block', marginTop: 12 }}>Fidyah per hari</b>
    <Field id="zFB" label="Beras (kg)" inputMode="decimal" value={f.fb} onChange={e => setF({ ...f, fb: e.target.value })} />
    <InputRp id="zFU" label="Atau uang (Rp)" value={f.fu} onChange={v => setF({ ...f, fu: v })} />
    <div className="aksi"><Btn onClick={simpan}>Simpan</Btn></div>
  </>;
}

function FormTerima({ c }) {
  const a = useApp();
  const [f, setF] = useState({ jenis: 'fitrah', bentuk: 'beras', nama: '', rumah: '', n: 1, kg: '', uang: 0, cat: '', ubah: false });
  const per = f.jenis === 'fitrah'
    ? { kg: +c.set.beras_kg, uang: +c.set.uang_jiwa }
    : { kg: +c.set.fidyah_beras_kg, uang: +c.set.fidyah_uang };
  const n = Math.max(0, parseInt(f.n) || 0);
  const kg = f.ubah ? desimal(f.kg) : Math.round(per.kg * n * 100) / 100;
  const uang = f.ubah ? f.uang : per.uang * n;

  const simpan = async (lagi) => {
    if (!f.nama.trim()) return a.toast('Isi nama muzakki', true);
    if (!n) return a.toast(f.jenis === 'fitrah' ? 'Isi jumlah jiwa' : 'Isi jumlah hari', true);
    const row = {
      tahun: c.th, tanggal: hariIni(), jenis: f.jenis, nama: f.nama.trim(), no_rumah: f.rumah.trim() || null,
      jiwa: f.jenis === 'fitrah' ? n : 0, hari: f.jenis === 'fidyah' ? n : 0, bentuk: f.bentuk,
      beras_kg: f.bentuk === 'beras' ? kg : 0, uang: f.bentuk === 'uang' ? uang : 0,
      catatan: f.cat.trim() || null, dicatat_by: a.me.id
    };
    if (!row.beras_kg && !row.uang) return a.toast('Jumlah belum terisi', true);
    const { error } = await sb().from('zakat_terima').insert(row);
    if (error) throw error;
    a.toast(`${JENIS[f.jenis]} ${row.nama} tercatat`); a.refresh();
    if (lagi) setF({ ...f, nama: '', rumah: '', n: 1, kg: '', uang: 0, cat: '', ubah: false });
    else a.closeModal();
  };

  return <>
    <Chips items={[['fitrah', 'Zakat Fitrah'], ['fidyah', 'Fidyah']]} value={f.jenis} onChange={k => setF({ ...f, jenis: k, ubah: false })} />
    <Field id="zNama" label={f.jenis === 'fitrah' ? 'Nama muzakki (kepala keluarga)' : 'Nama pembayar fidyah'} list="zWarga"
      value={f.nama} onChange={e => {
        const w = c.warga.find(x => x.nama === e.target.value);
        setF({ ...f, nama: e.target.value, rumah: w?.alamat && !f.rumah ? w.alamat : f.rumah });
      }} />
    <datalist id="zWarga">{c.warga.map((w, i) => <option key={i} value={w.nama} />)}</datalist>
    <Field id="zRumah" label="No. rumah / alamat (opsional)" value={f.rumah} onChange={e => setF({ ...f, rumah: e.target.value })} />
    <Field id="zN" label={f.jenis === 'fitrah' ? 'Jumlah jiwa' : 'Jumlah hari tidak berpuasa'} type="number" min="1" inputMode="numeric"
      value={f.n} onChange={e => setF({ ...f, n: e.target.value })} />
    <label className="f">Dibayar dalam bentuk</label>
    <Chips items={[['beras', 'Beras'], ['uang', 'Uang']]} value={f.bentuk} onChange={k => setF({ ...f, bentuk: k })} />
    {f.ubah
      ? (f.bentuk === 'beras'
        ? <Field id="zKg" label="Jumlah beras (kg)" inputMode="decimal" value={f.kg} onChange={e => setF({ ...f, kg: e.target.value })} />
        : <InputRp id="zUang" label="Jumlah uang (Rp)" value={f.uang} onChange={v => setF({ ...f, uang: v })} />)
      : <div className="kartu" style={{ marginTop: 6 }}>
          <span className="kecil">{n} × {f.bentuk === 'beras' ? kgTeks(per.kg) : rp(per.uang)} =</span>
          <div><b className="masuk" style={{ fontSize: 18 }}>{f.bentuk === 'beras' ? kgTeks(kg) : rp(uang)}</b></div>
          <a href="#" className="kecil" onClick={e => { e.preventDefault(); setF({ ...f, ubah: true, kg: String(kg).replace('.', ','), uang }); }}>
            Jumlah berbeda (mis. dilebihkan)? Ubah manual</a>
        </div>}
    <label className="f" htmlFor="zCat">Catatan (opsional)</label>
    <textarea className="f" id="zCat" value={f.cat} onChange={e => setF({ ...f, cat: e.target.value })} />
    <div className="aksi">
      <Btn className="btn sek" onClick={() => simpan(true)}>Simpan &amp; catat lagi</Btn>
      <Btn onClick={() => simpan(false)}>Simpan</Btn></div>
  </>;
}

function FormSalur({ c }) {
  const a = useApp();
  const [f, setF] = useState({ nama: '', alamat: '', asnaf: 'miskin', kg: '', uang: 0, cat: '' });
  const simpan = async (lagi) => {
    const kg = desimal(f.kg);
    if (!f.nama.trim()) return a.toast('Isi nama penerima', true);
    if (!kg && !f.uang) return a.toast('Isi jumlah beras atau uang', true);
    if (kg > c.sisaB + 1e-9) return a.toast('Beras melebihi sisa (' + kgTeks(c.sisaB) + ')', true);
    if (f.uang > c.sisaU) return a.toast('Uang melebihi sisa (' + rp(c.sisaU) + ')', true);
    const { error } = await sb().from('zakat_salur').insert({
      tahun: c.th, tanggal: hariIni(), nama: f.nama.trim(), alamat: f.alamat.trim() || null, asnaf: f.asnaf,
      beras_kg: kg, uang: f.uang, catatan: f.cat.trim() || null, dicatat_by: a.me.id
    });
    if (error) throw error;
    a.toast('Penyaluran ke ' + f.nama.trim() + ' tercatat'); a.refresh();
    if (lagi) { c.sisaB -= kg; c.sisaU -= f.uang; setF({ ...f, nama: '', alamat: '', kg: '', uang: 0, cat: '' }); }
    else a.closeModal();
  };
  return <>
    <div className="kecil">Sisa: <b>{kgTeks(c.sisaB)}</b> · <b>{rp(c.sisaU)}</b></div>
    <Field id="sNama" label="Nama penerima (mustahik)" list="sWarga" value={f.nama} onChange={e => {
      const w = c.warga.find(x => x.nama === e.target.value);
      setF({ ...f, nama: e.target.value, alamat: w?.alamat && !f.alamat ? w.alamat : f.alamat });
    }} />
    <datalist id="sWarga">{c.warga.map((w, i) => <option key={i} value={w.nama} />)}</datalist>
    <Field id="sAlamat" label="Alamat / no. rumah (opsional)" value={f.alamat} onChange={e => setF({ ...f, alamat: e.target.value })} />
    <label className="f" htmlFor="sAsnaf">Golongan (asnaf)</label>
    <select className="f" id="sAsnaf" value={f.asnaf} onChange={e => setF({ ...f, asnaf: e.target.value })}>
      {Object.entries(ASNAF).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
    <Field id="sKg" label="Beras (kg)" inputMode="decimal" placeholder="0" value={f.kg} onChange={e => setF({ ...f, kg: e.target.value })} />
    <InputRp id="sUang" label="Uang (Rp)" value={f.uang} onChange={v => setF({ ...f, uang: v })} />
    <label className="f" htmlFor="sCat">Catatan (opsional)</label>
    <textarea className="f" id="sCat" value={f.cat} onChange={e => setF({ ...f, cat: e.target.value })} />
    <div className="aksi">
      <Btn className="btn sek" onClick={() => simpan(true)}>Simpan &amp; catat lagi</Btn>
      <Btn onClick={() => simpan(false)}>Simpan</Btn></div>
  </>;
}

function Laporan({ c }) {
  const a = useApp();
  const { th, terima, salur } = c;
  const per = j => { const r = terima.filter(x => x.jenis === j); return { n: r.length, jiwa: r.reduce((x, y) => x + y.jiwa, 0), hari: r.reduce((x, y) => x + y.hari, 0), kg: jumlah(r, 'beras_kg'), uang: jumlah(r, 'uang') }; };
  const fi = per('fitrah'), fd = per('fidyah');
  const asnaf = Object.entries(ASNAF).map(([k, l]) => { const r = salur.filter(x => x.asnaf === k); return { l, n: r.length, kg: jumlah(r, 'beras_kg'), uang: jumlah(r, 'uang') }; }).filter(x => x.n);
  const tB = fi.kg + fd.kg, tU = fi.uang + fd.uang, sB = jumlah(salur, 'beras_kg'), sU = jumlah(salur, 'uang');

  const teks = [
    `*LAPORAN ZAKAT FITRAH & FIDYAH ${th} H*`, `*${NAMA_DKM}*`, '',
    '*PENERIMAAN*',
    `Zakat Fitrah: ${fi.n} KK / ${fi.jiwa} jiwa`, `  • Beras: ${kgTeks(fi.kg)}`, `  • Uang: ${rp(fi.uang)}`,
    `Fidyah: ${fd.n} orang / ${fd.hari} hari`, `  • Beras: ${kgTeks(fd.kg)}`, `  • Uang: ${rp(fd.uang)}`,
    `Total: ${kgTeks(tB)} + ${rp(tU)}`, '',
    '*PENYALURAN*',
    ...(asnaf.length ? asnaf.map(x => `${x.l}: ${x.n} orang · ${kgTeks(x.kg)} + ${rp(x.uang)}`) : ['(belum ada)']),
    `Total: ${salur.length} mustahik · ${kgTeks(sB)} + ${rp(sU)}`, '',
    `*SISA*: ${kgTeks(tB - sB)} + ${rp(tU - sU)}`, '',
    'Jazakumullahu khairan kepada seluruh muzakki. Semoga Allah menerima amal ibadah kita.'
  ].join('\n');

  const excel = (jenis) => jenis === 'terima'
    ? unduhCSV(`zakat-penerimaan-${th}H.csv`, [['Tanggal', 'Jenis', 'Nama', 'No Rumah', 'Jiwa', 'Hari', 'Bentuk', 'Beras (kg)', 'Uang (Rp)', 'Catatan', 'Dicatat oleh'],
      ...terima.slice().reverse().map(r => [r.tanggal, JENIS[r.jenis], r.nama, r.no_rumah, r.jiwa || '', r.hari || '', r.bentuk, +r.beras_kg, +r.uang, r.catatan, a.nm(r.dicatat_by)])])
    : unduhCSV(`zakat-penyaluran-${th}H.csv`, [['Tanggal', 'Nama', 'Alamat', 'Asnaf', 'Beras (kg)', 'Uang (Rp)', 'Catatan', 'Dicatat oleh'],
      ...salur.slice().reverse().map(r => [r.tanggal, r.nama, r.alamat, ASNAF[r.asnaf], +r.beras_kg, +r.uang, r.catatan, a.nm(r.dicatat_by)])]);

  const print = () => {
    const tb = (h, rows) => `<table class="data"><tr>${h.map(x => `<th>${x}</th>`).join('')}</tr>${rows.map(r => `<tr>${r.map((v, i) => `<td${i >= h.length - 2 ? ' class="r"' : ''}>${esc(v)}</td>`).join('')}</tr>`).join('')}</table>`;
    const ok = cetak('Laporan Zakat ' + th + ' H', `<h2>LAPORAN ZAKAT FITRAH &amp; FIDYAH ${th} H</h2><div class="sub">${esc(NAMA_DKM)}</div>
      <b>Ringkasan</b>${tb(['Uraian', 'Beras', 'Uang'], [
        [`Zakat Fitrah (${fi.n} KK / ${fi.jiwa} jiwa)`, kgTeks(fi.kg), rp(fi.uang)], [`Fidyah (${fd.n} orang / ${fd.hari} hari)`, kgTeks(fd.kg), rp(fd.uang)],
        ['Total diterima', kgTeks(tB), rp(tU)], [`Disalurkan (${salur.length} mustahik)`, kgTeks(sB), rp(sU)], ['Sisa', kgTeks(tB - sB), rp(tU - sU)]])}
      <b>Penerimaan</b>${tb(['No', 'Nama', 'Jenis', 'Jiwa/Hari', 'Beras', 'Uang'], terima.slice().reverse().map((r, i) => [i + 1, r.nama, JENIS[r.jenis], r.jenis === 'fitrah' ? r.jiwa + ' jiwa' : r.hari + ' hari', r.beras_kg > 0 ? kgTeks(r.beras_kg) : '-', r.uang > 0 ? rp(r.uang) : '-']))}
      <b>Penyaluran</b>${tb(['No', 'Nama', 'Alamat', 'Asnaf', 'Beras', 'Uang'], salur.slice().reverse().map((r, i) => [i + 1, r.nama, r.alamat || '-', ASNAF[r.asnaf], r.beras_kg > 0 ? kgTeks(r.beras_kg) : '-', r.uang > 0 ? rp(r.uang) : '-']))}`);
    if (!ok) a.toast('Izinkan pop-up untuk mencetak', true);
  };

  return <>
    <div className="kartu"><pre style={{ whiteSpace: 'pre-wrap', margin: 0, font: 'inherit', fontSize: 13.5 }}>{teks.replace(/\*/g, '')}</pre></div>
    <div className="aksi">
      <a className="btn" href={'https://wa.me/?text=' + encodeURIComponent(teks)} target="_blank" rel="noreferrer">Bagikan ke WA</a>
      <Btn className="btn sek" onClick={async () => { await navigator.clipboard.writeText(teks); a.toast('Teks laporan disalin'); }}>Salin Teks</Btn>
    </div>
    <div className="aksi">
      <button className="btn sek" onClick={print}>Cetak / PDF</button>
      <button className="btn sek" onClick={() => excel('terima')}>Excel Penerimaan</button>
      <button className="btn sek" onClick={() => excel('salur')}>Excel Penyaluran</button>
    </div>
  </>;
}
