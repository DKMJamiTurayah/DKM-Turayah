'use client';
import { useState } from 'react';
import { sb, rpc, q } from '@/lib/supabase';
import { jam, rp } from '@/lib/util';
import { Btn, Chips, Field, InputRp, Loading, useApp, useLoad } from './ui';

const URUT = ['pemakai', 'tujuan', 'km_awal', 'km_akhir', 'uang_jalan', 'uang_toll'];
const NAMA = {
  pemakai: 'Nama pemakai', tujuan: 'Tujuan & RS', km_awal: 'KM awal', km_akhir: 'KM akhir',
  uang_jalan: 'Uang jalan', uang_toll: 'Uang toll'
};
const ST = { diajukan: ['Menunggu Ketum', 'b-kuning'], disetujui: ['Disetujui', 'b-hijau'], ditolak: ['Ditolak', 'b-merah'] };
const ST_TRIP = { berjalan: ['Berjalan', 'b-biru'], selesai: ['Selesai', 'b-hijau'], dibatalkan: ['Dibatalkan', 'b-abu'] };
const km = n => Number(n || 0).toLocaleString('id-ID') + ' km';

// tahap mana saja yang boleh diajukan sekarang (sama dengan aturan di database)
function bolehAjukan(m) {
  const ok = j => m[j]?.status === 'disetujui';
  const kosong = j => !m[j] || m[j].status === 'ditolak';
  const hasil = [];
  if (kosong('tujuan') && ok('pemakai')) hasil.push('tujuan');
  if (kosong('km_awal') && ok('tujuan')) hasil.push('km_awal');
  if (kosong('km_akhir') && ok('km_awal')) hasil.push('km_akhir');
  if (kosong('uang_jalan') && ok('km_awal')) hasil.push('uang_jalan');
  if (kosong('uang_toll') && ok('km_awal')) hasil.push('uang_toll');
  return hasil;
}

function ringkas(trips, tahap) {
  const per = {};
  tahap.forEach(t => { (per[t.trip_id] ||= {})[t.jenis] = t; });
  let kmTotal = 0, jalan = 0, toll = 0, selesai = 0;
  trips.filter(t => t.status !== 'dibatalkan').forEach(t => {
    const m = per[t.id] || {};
    if (m.km_awal?.status === 'disetujui' && m.km_akhir?.status === 'disetujui') kmTotal += m.km_akhir.angka - m.km_awal.angka;
    if (m.uang_jalan?.status === 'disetujui') jalan += +m.uang_jalan.angka;
    if (m.uang_toll?.status === 'disetujui') toll += +m.uang_toll.angka;
    if (t.status === 'selesai') selesai++;
  });
  return { per, kmTotal, jalan, toll, selesai };
}

export default function Ambulans() {
  const a = useApp();
  const f = a.sub.ambulans || 'berjalan';
  const s = useLoad(async () => {
    const [trips, tahap] = await Promise.all([
      q(sb().from('ambulans_trip').select('*').order('id', { ascending: false }).limit(200)),
      q(sb().from('ambulans_tahap').select('*').limit(2000))
    ]);
    return { trips, tahap };
  }, [a.refreshKey]);

  if (!s.data) return <Loading s={s} />;
  const { per, kmTotal, jalan, toll, selesai } = ringkas(s.data.trips, s.data.tahap);
  const rows = s.data.trips.filter(t => f === 'berjalan' ? t.status === 'berjalan' : t.status !== 'berjalan');

  return <>
    <h2>Ambulans</h2>
    <p className="kecil">Setiap pemakaian ambulans dicatat bertahap, dan tiap tahap harus di-approve Ketua Umum.</p>
    <div className="kartu">
      <b>Summary (pemakaian yang sudah di-approve)</b>
      <div className="baris-flex"><span className="kecil spasi">Pemakaian selesai</span><b>{selesai}x</b></div>
      <div className="baris-flex"><span className="kecil spasi">Summary KM</span><b>{km(kmTotal)}</b></div>
      <div className="baris-flex"><span className="kecil spasi">Summary uang jalan</span><b>{rp(jalan)}</b></div>
      <div className="baris-flex"><span className="kecil spasi">Summary uang toll</span><b>{rp(toll)}</b></div>
    </div>
    <div className="aksi"><button className="btn" onClick={() => a.openModal('Pemakaian Ambulans Baru', <FormTahap jenis="pemakai" />)}>+ Pemakaian Baru</button></div>
    <Chips items={[['berjalan', 'Berjalan'], ['selesai', 'Selesai / Batal']]} value={f} onChange={k => a.setSub('ambulans', k)} />
    {rows.length ? rows.map(t => <Kartu key={t.id} t={t} m={per[t.id] || {}} />)
      : <div className="kartu kosong">{f === 'berjalan' ? 'Belum ada pemakaian yang berjalan' : 'Belum ada yang selesai'}</div>}
  </>;
}

function Kartu({ t, m }) {
  const a = useApp();
  const [lbl, cls] = ST_TRIP[t.status];
  const ketum = a.punya('ketum');
  const boleh = t.status === 'berjalan' ? bolehAjukan(m) : [];
  const tempuh = m.km_awal?.status === 'disetujui' && m.km_akhir?.status === 'disetujui' ? m.km_akhir.angka - m.km_awal.angka : null;
  const nilai = x => !x ? '' : x.jenis === 'pemakai' ? x.teks
    : x.jenis === 'tujuan' ? `${x.teks} · ${x.rs}, ${x.kota}`
    : x.jenis.startsWith('km') ? km(x.angka) : rp(x.angka);

  const putuskan = async (x, setuju) => {
    let cat = null;
    if (!setuju) { cat = prompt('Alasan menolak:'); if (!cat) return; }
    else if (!confirm(`Setujui ${NAMA[x.jenis]}: ${nilai(x)}?` + (x.jenis.startsWith('uang') ? '\nAkan tercatat sebagai pengeluaran kas pos Ambulans.' : ''))) return;
    await rpc('ambulans_putuskan', { p_tahap: x.id, p_setuju: setuju, p_catatan: cat });
    a.toast(setuju ? 'Disetujui' : 'Ditolak'); a.refresh();
  };

  return <div className="kartu">
    <div className="baris-flex"><b className="spasi">Pemakaian #{t.id}</b><span className={'badge ' + cls}>{lbl}</span></div>
    <div className="kecil">Dibuat {a.nm(t.dibuat_by)} · {jam(t.dibuat_at)}</div>
    {URUT.map((j, i) => {
      const x = m[j]; const [sl, sc] = x ? ST[x.status] : ['Belum', 'b-abu'];
      return <div key={j} style={{ margin: '8px 0', paddingTop: 6, borderTop: '1px solid var(--garis, #eee)' }}>
        <div className="baris-flex"><span className="kecil spasi">{i + 1}. {NAMA[j]}</span><span className={'badge ' + sc}>{sl}</span></div>
        {x && <div className="tebal">{nilai(x)}</div>}
        {x && <div className="kecil">Diajukan {a.nm(x.diajukan_by)}{x.putus_at ? ` · diputuskan ${a.nm(x.putus_by)} ${jam(x.putus_at)}` : ''}</div>}
        {x?.status === 'ditolak' && x.catatan && <div className="kecil">Alasan ditolak: {x.catatan}</div>}
        {x?.status === 'diajukan' && ketum && <div className="aksi">
          <Btn onClick={() => putuskan(x, true)}>✓ Setujui</Btn>
          <Btn className="btn sek" onClick={() => putuskan(x, false)}>Tolak</Btn>
        </div>}
      </div>;
    })}
    {tempuh !== null && <div className="kecil">Jarak tempuh: <b>{km(tempuh)}</b></div>}
    {t.status === 'berjalan' && <div className="aksi">
      {boleh.map(j => <button key={j} className="btn emas" onClick={() => a.openModal('Ajukan ' + NAMA[j], <FormTahap trip={t.id} jenis={j} lama={m[j]} awal={m.km_awal?.angka} />)}>
        {m[j]?.status === 'ditolak' ? 'Ajukan ulang' : 'Ajukan'} {NAMA[j]}</button>)}
      {(t.dibuat_by === a.me.id || a.punya('ketum', 'admin')) && <Btn className="btn sek" onClick={async () => {
        if (!confirm('Batalkan pemakaian ini?')) return;
        await rpc('ambulans_batal', { p_trip: t.id }); a.toast('Pemakaian dibatalkan'); a.refresh();
      }}>Batalkan</Btn>}
    </div>}
  </div>;
}

function FormTahap({ trip = null, jenis, lama, awal }) {
  const a = useApp();
  const [teks, setTeks] = useState(lama?.teks || '');
  const [rs, setRs] = useState(lama?.rs || '');
  const [kota, setKota] = useState(lama?.kota || '');
  const [angka, setAngka] = useState(lama?.angka ? +lama.angka : 0);
  const kirim = async () => {
    await rpc('ambulans_ajukan', { p_trip: trip, p_jenis: jenis, p_teks: teks, p_rs: rs, p_kota: kota, p_angka: angka || null });
    a.closeModal(); a.toast('Diajukan, menunggu approval Ketum'); a.refresh();
  };
  return <>
    {jenis === 'pemakai' && <Field id="amP" label="Nama pemakai ambulans" value={teks} onChange={e => setTeks(e.target.value)} />}
    {jenis === 'tujuan' && <>
      <Field id="amT" label="Tujuan pemakaian" value={teks} onChange={e => setTeks(e.target.value)} />
      <Field id="amR" label="Nama RS" value={rs} onChange={e => setRs(e.target.value)} />
      <Field id="amK" label="Daerah / kota" value={kota} onChange={e => setKota(e.target.value)} />
    </>}
    {(jenis === 'km_awal' || jenis === 'km_akhir') && <>
      {jenis === 'km_akhir' && awal && <div className="kecil">KM awal: {km(awal)}</div>}
      <label className="f" htmlFor="amKm">{jenis === 'km_awal' ? 'KM awal (angka di odometer)' : 'KM akhir (saat kembali)'}</label>
      <input className="f" id="amKm" inputMode="numeric" placeholder="0" value={angka || ''} onChange={e => setAngka(Number(e.target.value.replace(/[^\d]/g, '')) || 0)} />
    </>}
    {(jenis === 'uang_jalan' || jenis === 'uang_toll') && <InputRp id="amUang" label={jenis === 'uang_jalan' ? 'Jumlah uang jalan' : 'Jumlah uang toll'} value={angka} onChange={setAngka} />}
    <div className="aksi"><Btn onClick={kirim}>Ajukan ke Ketum</Btn></div>
  </>;
}
