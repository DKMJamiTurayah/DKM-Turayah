'use client';
import { useState } from 'react';
import { sb, rpc, q } from '@/lib/supabase';
import { jam, rp, tgl } from '@/lib/util';
import { Btn, Chips, Field, Loading, useApp, useLoad } from './ui';

const ST_INT = {
  menunggu: ['Menunggu diserahkan', 'b-kuning'],
  diserahkan: ['Dalam perjalanan ke Bendahara', 'b-biru'],
  diterima: ['Diterima Bendahara', 'b-hijau']
};

export default function Intransit() {
  const a = useApp();
  const f = a.sub.intransit || 'proses';
  const s = useLoad(() => q(sb().from('intransit').select('*, pengajuan(nomor, judul, bidang_id, diajukan_by)').order('id', { ascending: false }).limit(200)), [a.refreshKey]);
  const lihat = x => ({ ...x, pj: Array.isArray(x.pengajuan) ? x.pengajuan[0] : x.pengajuan });
  const rows = (s.data || []).map(lihat).filter(x => f === 'proses' ? x.status !== 'diterima' : x.status === 'diterima');
  const total = (s.data || []).filter(x => x.status !== 'diterima').reduce((n, x) => n + +x.jumlah, 0);

  return <>
    <h2>Intransit</h2>
    <p className="kecil">Uang kembalian dari dana yang sudah dicairkan. Selama belum diterima Bendahara, uang ini belum masuk saldo kas.</p>
    <div className="kartu"><span className="kecil">Total sedang intransit</span><b className="tebal" style={{ display: 'block', fontSize: 20 }}>{rp(total)}</b></div>
    <Chips items={[['proses', 'Sedang Proses'], ['selesai', 'Sudah Diterima']]} value={f} onChange={k => a.setSub('intransit', k)} />
    {!s.data ? <Loading s={s} /> : rows.length ? rows.map(x => <Kartu key={x.id} t={x} />)
      : <div className="kartu kosong">{f === 'proses' ? 'Tidak ada uang kembalian yang sedang intransit' : 'Belum ada yang diterima'}</div>}
    <p className="kecil">Alur: Ketua Bidang catat kembalian di detail pengajuan → klik &quot;Sudah Saya Serahkan&quot; → Bendahara klik &quot;Terima&quot; setelah uang di tangan → otomatis masuk kas.</p>
  </>;
}

function Kartu({ t }) {
  const a = useApp();
  const [lbl, cls] = ST_INT[t.status];
  const me = a.me, pj = t.pj || {};
  const pemegang = t.status === 'menunggu' && (me.id === t.dicatat_by || me.id === pj.diajukan_by || (me.role === 'ketua_bidang' && me.bidang_id === pj.bidang_id));
  const bendahara = a.punya('bendahara') && t.status !== 'diterima';
  return <div className="kartu">
    <div className="baris-flex"><span className="kecil">{pj.nomor} · {tgl(t.dicatat_at)}</span><span className="spasi" /><span className={'badge ' + cls}>{lbl}</span></div>
    <div className="tebal" style={{ marginTop: 4 }}>{pj.judul}</div>
    <div className="baris-flex"><span className="kecil spasi">{a.bn(pj.bidang_id)}</span><span className="nominal">{rp(t.jumlah)}</span></div>
    {t.catatan && <div className="kecil">{t.catatan}</div>}
    <div className="kecil">Dicatat {a.nm(t.dicatat_by)}{t.serah_at ? ' · diserahkan ' + jam(t.serah_at) : ''}{t.terima_at ? ' · diterima ' + a.nm(t.terima_by) + ' ' + jam(t.terima_at) : ''}</div>
    {(pemegang || bendahara) && <div className="aksi">
      {pemegang && <Btn onClick={async () => {
        if (!confirm(`Uang kembalian ${rp(t.jumlah)} sudah Anda serahkan ke Bendahara?`)) return;
        await rpc('serahkan_intransit', { p_id: t.id }); a.toast('Ditandai sudah diserahkan, menunggu Bendahara'); a.refresh();
      }}>Sudah Saya Serahkan</Btn>}
      {bendahara && <Btn className="btn emas" onClick={() => a.openModal('Terima Uang Kembalian', <FormTerima t={t} />)}>Terima</Btn>}
    </div>}
  </div>;
}

function FormTerima({ t }) {
  const a = useApp();
  const [cat, setCat] = useState('');
  const terima = async () => {
    if (!confirm(`Uang ${rp(t.jumlah)} sudah benar-benar Anda terima? Akan masuk kas pos asal pencairan.`)) return;
    await rpc('terima_intransit', { p_id: t.id, p_catatan: cat.trim() || null });
    a.closeModal(); a.toast('Kembalian diterima dan masuk kas'); a.refresh();
  };
  return <>
    <div className="kecil">{t.pj?.nomor} · {t.pj?.judul}</div>
    <div className="tebal" style={{ fontSize: 20, margin: '6px 0' }}>{rp(t.jumlah)}</div>
    {t.status === 'menunggu' && <div className="kecil">Pemegang uang belum menandai &quot;sudah diserahkan&quot;. Klik Terima hanya jika uang sudah ada di tangan Anda.</div>}
    <Field id="iCat" label="Catatan (opsional)" value={cat} onChange={e => setCat(e.target.value)} />
    <div className="aksi"><Btn onClick={terima}>✓ Terima</Btn></div>
  </>;
}
