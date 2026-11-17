'use client';
import { useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import { sb, q } from '@/lib/supabase';
import { HARI, BULAN } from '@/lib/util';
import { hitungJadwal, tambahHari, LOKASI } from '@/lib/jadwal';
import { Btn, Field, Loading, useApp, useLoad } from './ui';
import { Skala, bolehBuat } from './Maklumat';

const CSS = `.tr-tabel td{white-space:normal;min-width:44px}.tr-tabel td:nth-child(n+3){text-align:left!important}
.tr-pt td{font-size:21px}.tr-pt td.bk{font-weight:700}.tr-tema{font-size:15px;font-weight:500;color:var(--redup-mk,#777);margin-top:2px}`;
const tglPendek = t => { const d = new Date(t + 'T00:00:00Z'); return `${HARI[d.getUTCDay()].slice(0, 3)}, ${d.getUTCDate()} ${BULAN[d.getUTCMonth()]}`; };

// daftar malam tarawih: malam ke-n = malam sebelum tanggal n Ramadhan
export const daftarMalam = rm => rm.r.hari.map(h => {
  const tanggal = tambahHari(h.tanggal, -1);
  return { malam: h.ke, tanggal, isya: hitungJadwal(tanggal).isya };
});

export default function Tarawih({ rm }) {
  const a = useApp();
  const th = +rm.hijri;
  const boleh = bolehBuat(a);
  const poster = useRef();
  const s = useLoad(() => q(sb().from('tarawih').select('*').eq('tahun', th).order('malam')), [a.refreshKey, th]);
  if (!s.data) return <Loading s={s} />;

  const per = {}; s.data.forEach(r => per[r.malam] = r);
  const malam = daftarMalam(rm);
  const terisi = malam.filter(m => per[m.malam]?.imam).length;
  const nama = k => [...new Set(s.data.flatMap(r => [r.imam, r.bilal, r.kultum]).filter(Boolean))].sort();
  const semuaNama = nama();

  const buka = m => boleh && a.openModal('Malam ke-' + m.malam + ' · ' + tglPendek(m.tanggal),
    <FormMalam key={m.malam} th={th} m={m} r={per[m.malam]} malam={malam} per={per} nama={semuaNama} />);

  const buatGambar = async () => {
    await document.fonts?.ready;
    const opsi = { pixelRatio: 1, cacheBust: true, backgroundColor: '#f6eedf' };
    await toPng(poster.current, opsi);
    return { url: await toPng(poster.current, opsi), nama: `petugas-tarawih-${th}H.png` };
  };
  const unduh = async () => {
    const { url, nama } = await buatGambar();
    const el = document.createElement('a'); el.href = url; el.download = nama; el.click();
    a.toast('Gambar diunduh');
  };
  const bagikan = async () => {
    const { url, nama } = await buatGambar();
    const file = new File([await (await fetch(url)).blob()], nama, { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: 'Jadwal Petugas Tarawih' }); } catch (e) { if (e.name !== 'AbortError') throw e; }
    } else {
      const el = document.createElement('a'); el.href = url; el.download = nama; el.click();
      a.toast('HP/browser ini tidak bisa langsung share, gambar diunduh');
    }
  };

  return <>
    <style>{CSS}</style>
    <div className="kartu">
      <b>Petugas Tarawih Ramadhan {th} H</b>
      <div className="kecil">{terisi} dari {malam.length} malam sudah ada imamnya.
        {boleh ? ' Ketuk baris untuk mengisi petugas.' : ' Yang bisa mengisi: Admin, Ketum, dan pengurus yang diberi akses maklumat.'}</div>
      <div className="aksi" style={{ marginTop: 10 }}>
        <Btn onClick={bagikan}>Bagikan ke WA</Btn>
        <Btn className="btn sek" onClick={unduh}>Unduh Gambar</Btn>
      </div>
    </div>
    <div className="kartu" style={{ padding: 6, overflowX: 'auto' }}>
      <table className="t jd-tabel tr-tabel">
        <thead><tr><th>Malam</th><th>Tanggal</th><th>Imam</th><th>Bilal</th><th>Kultum</th></tr></thead>
        <tbody>{malam.map(m => {
          const r = per[m.malam] || {};
          return <tr key={m.malam} onClick={() => buka(m)} style={boleh ? { cursor: 'pointer' } : {}}>
            <td>{m.malam}</td><td>{tglPendek(m.tanggal)}</td>
            <td>{r.imam || <span className="kecil">—</span>}</td><td>{r.bilal || <span className="kecil">—</span>}</td>
            <td>{r.kultum || <span className="kecil">—</span>}</td></tr>;
        })}</tbody>
      </table>
    </div>
    <h3>Pratinjau gambar</h3>
    <Skala><PosterTarawih ref={poster} th={th} malam={malam} per={per} /></Skala>
  </>;
}

function FormMalam({ th, m, r, malam, per, nama }) {
  const a = useApp();
  const [f, setF] = useState({ imam: r?.imam || '', bilal: r?.bilal || '', kultum: r?.kultum || '', tema: r?.tema || '' });
  const simpan = async (lanjut) => {
    const row = { tahun: th, malam: m.malam, imam: f.imam.trim() || null, bilal: f.bilal.trim() || null,
      kultum: f.kultum.trim() || null, tema: f.tema.trim() || null, diubah_by: a.me.id, diubah_at: new Date().toISOString() };
    const { error } = await sb().from('tarawih').upsert(row, { onConflict: 'tahun,malam' });
    if (error) throw error;
    a.toast('Malam ke-' + m.malam + ' tersimpan'); a.refresh();
    const nx = malam.find(x => x.malam === m.malam + 1);
    if (lanjut && nx) a.openModal('Malam ke-' + nx.malam + ' · ' + tglPendek(nx.tanggal),
      <FormMalam key={nx.malam} th={th} m={nx} r={per[nx.malam]} malam={malam} per={per} nama={[...new Set([...nama, row.imam, row.bilal, row.kultum].filter(Boolean))]} />);
    else a.closeModal();
  };
  const kosongkan = async () => {
    if (!confirm('Kosongkan petugas malam ke-' + m.malam + '?')) return;
    const { error } = await sb().from('tarawih').delete().eq('tahun', th).eq('malam', m.malam);
    if (error) throw error;
    a.closeModal(); a.toast('Dikosongkan'); a.refresh();
  };
  return <>
    <div className="kecil">Isya ± {m.isya} WIB</div>
    <Field id="tImam" label="Imam" list="tNama" value={f.imam} onChange={e => setF({ ...f, imam: e.target.value })} />
    <Field id="tBilal" label="Bilal" list="tNama" value={f.bilal} onChange={e => setF({ ...f, bilal: e.target.value })} />
    <Field id="tKultum" label="Penceramah kultum" list="tNama" value={f.kultum} onChange={e => setF({ ...f, kultum: e.target.value })} />
    <Field id="tTema" label="Tema kultum (opsional)" value={f.tema} onChange={e => setF({ ...f, tema: e.target.value })} />
    <datalist id="tNama">{nama.map(x => <option key={x} value={x} />)}</datalist>
    <div className="aksi">
      {m.malam < malam.length && <Btn className="btn sek" onClick={() => simpan(true)}>Simpan &amp; malam berikutnya</Btn>}
      <Btn onClick={() => simpan(false)}>Simpan</Btn>
    </div>
    {r && <div className="aksi"><Btn className="btn merah-sek" onClick={kosongkan}>Kosongkan malam ini</Btn></div>}
  </>;
}

function PosterTarawih({ th, malam, per, ref }) {
  return <div ref={ref} className="mk jd-poster">
    <div className="mk-atas" style={{ paddingBottom: 90 }}>
      <img src="/logo-masjid-jamie-jelas.png" alt="" style={{ position: 'absolute', top: 40, right: 56, width: 170, height: 170, objectFit: 'contain', background: '#fff', borderRadius: 24, padding: 8 }} />
      <div className="mk-kicker">Jadwal Petugas Tarawih</div>
      <div className="mk-judul" style={{ fontSize: 70 }}>Ramadhan {th} H</div>
      <div className="mk-alamat">Masjid Jami Turayah · {LOKASI.nama}</div>
    </div>
    <div className="mk-isi">
      <table className="jd-pt tr-pt">
        <thead><tr><th>Malam</th><th className="l">Tanggal</th><th className="l">Imam</th><th className="l">Bilal</th><th className="l bk">Kultum</th></tr></thead>
        <tbody>{malam.map(m => {
          const r = per[m.malam] || {};
          return <tr key={m.malam} className={new Date(m.tanggal + 'T00:00:00Z').getUTCDay() === 4 ? 'jm' : ''}>
            <td className="ke">{m.malam}</td><td className="l">{tglPendek(m.tanggal)}</td>
            <td className="l">{r.imam || '-'}</td><td className="l">{r.bilal || '-'}</td>
            <td className="l bk">{r.kultum || '-'}{r.tema ? <div className="tr-tema">{r.tema}</div> : null}</td></tr>;
        })}</tbody>
      </table>
      <div className="jd-catatan">Shalat Isya &amp; Tarawih berjamaah · Malam ke-1 menyesuaikan keputusan sidang isbat pemerintah</div>
    </div>
  </div>;
}
