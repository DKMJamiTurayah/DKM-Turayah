'use client';
import { useState } from 'react';
import { sb, rpc, q } from '@/lib/supabase';
import { hariIni, jam, rp, tgl } from '@/lib/util';
import { Btn, Chips, Field, InputRp, Loading, useApp, useLoad } from './ui';

// PEMINJAMAN: 4 tahap, tiap tahap diajukan lalu di-approve Ketum.
const URUT = ['pemakai', 'tujuan', 'km_awal', 'uang_jalan'];
const NAMA = { pemakai: 'Nama pemakai', tujuan: 'Tujuan & RS', km_awal: 'KM awal', uang_jalan: 'Uang jalan' };
const ST = {
  diajukan: ['Menunggu Ketum', 'b-kuning'], disetujui: ['Disetujui', 'b-hijau'], ditolak: ['Ditolak', 'b-merah'],
  menunggu_dana: ['Menunggu dana Bendahara', 'b-ungu']
};
const ST_TRIP = { berjalan: ['Berjalan', 'b-biru'], selesai: ['Selesai', 'b-hijau'], dibatalkan: ['Dibatalkan', 'b-abu'] };
const km = n => Number(n || 0).toLocaleString('id-ID') + ' km';

// tahap peminjaman mana yang boleh diajukan sekarang (urut, sama dengan aturan di database)
function bolehAjukan(m) {
  const ok = j => m[j]?.status === 'disetujui';
  const kosong = j => !m[j] || m[j].status === 'ditolak';
  return URUT.slice(1).filter((j, i) => kosong(j) && ok(URUT[i]));
}
const pinjamLengkap = m => URUT.every(j => m[j]?.status === 'disetujui');

function ringkas(trips, tahap) {
  const per = {};
  tahap.forEach(t => { (per[t.trip_id] ||= {})[t.jenis] = t; });
  let kmTotal = 0, jalan = 0, toll = 0, bbm = 0, selesai = 0;
  trips.filter(t => t.status !== 'dibatalkan').forEach(t => {
    const m = per[t.id] || {};
    if (m.uang_jalan?.status === 'disetujui') jalan += +m.uang_jalan.angka;
    if (m.pengembalian?.status === 'disetujui') {
      toll += +(m.pengembalian.toll_total || 0);
      bbm += +(m.pengembalian.bbm || 0);
      if (m.km_awal?.status === 'disetujui') kmTotal += m.pengembalian.angka - m.km_awal.angka;
    }
    if (t.status === 'selesai') selesai++;
  });
  return { per, kmTotal, jalan, toll, bbm, selesai };
}

export default function Ambulans() {
  const a = useApp();
  const f = a.sub.ambulans || 'pinjam';
  const s = useLoad(async () => {
    const [trips, tahap, tollRows, jasa, pos] = await Promise.all([
      q(sb().from('ambulans_trip').select('*').order('id', { ascending: false }).limit(200)),
      q(sb().from('ambulans_tahap').select('*').limit(2000)),
      q(sb().from('ambulans_toll').select('*').order('id').limit(3000)),
      q(sb().from('kas').select('id,tanggal,jumlah,keterangan').eq('kategori', 'Jasa dari peminjam').order('id', { ascending: false }).limit(200)),
      q(sb().from('pos_dana').select('id,nama,aktif,urutan').order('urutan'))
    ]);
    const posAmb = pos.find(p => p.nama === 'Ambulans');
    const saldo = posAmb ? await rpc('saldo_pos', { p_pos: posAmb.id }) : null;
    return { trips, tahap, tollRows, jasa, pos, saldo };
  }, [a.refreshKey]);

  if (!s.data) return <Loading s={s} />;
  const { per, kmTotal, jalan, toll, bbm, selesai } = ringkas(s.data.trips, s.data.tahap);
  const totalJasa = s.data.jasa.reduce((x, r) => x + +r.jumlah, 0);
  const tollDari = id => s.data.tollRows.filter(r => r.tahap_id === id);
  const adaDana = s.data.tahap.some(x => x.status === 'menunggu_dana');

  const aktif = s.data.trips.filter(t => t.status === 'berjalan');
  const daftarPinjam = aktif;                                                  // semua yang belum dikembalikan
  const daftarKembali = aktif.filter(t => pinjamLengkap(per[t.id] || {}));     // siap/sedang proses pengembalian
  const daftarRiwayat = s.data.trips.filter(t => t.status !== 'berjalan');

  return <>
    <h2>Ambulans</h2>
    <p className="kecil">Peminjaman dan pengembalian dicatat terpisah. Tiap tahap di-approve Ketua Umum, dana diambil dari kas pos Ambulans.</p>
    <div className="kartu">
      <b>Summary (yang sudah di-approve)</b>
      <div className="baris-flex"><span className="kecil spasi">Saldo kas pos Ambulans</span><b>{rp(s.data.saldo)}</b></div>
      <div className="baris-flex"><span className="kecil spasi">Pemakaian selesai</span><b>{selesai}x</b></div>
      <div className="baris-flex"><span className="kecil spasi">Summary KM</span><b>{km(kmTotal)}</b></div>
      <div className="baris-flex"><span className="kecil spasi">Uang jalan diberikan</span><b>{rp(jalan)}</b></div>
      <div className="baris-flex"><span className="kecil spasi">Pemakaian toll</span><b>{rp(toll)}</b></div>
      <div className="baris-flex"><span className="kecil spasi">Pembelian BBM</span><b>{rp(bbm)}</b></div>
      <div className="baris-flex"><span className="kecil spasi">Pemasukan jasa peminjam</span><b>{rp(totalJasa)}</b></div>
    </div>
    {adaDana && a.punya('bendahara') && <div className="kartu"><b>Ada tahap menunggu dana</b>
      <div className="kecil">Saldo pos Ambulans tidak cukup. Buka tahap berlabel "Menunggu dana Bendahara" lalu pindahkan dana dari pos lain.</div></div>}

    <Chips items={[['pinjam', 'Peminjaman'], ['kembali', 'Pengembalian'], ['riwayat', 'Selesai / Batal']]} value={f} onChange={k => a.setSub('ambulans', k)} />

    {f === 'pinjam' && <>
      <div className="aksi"><button className="btn" onClick={() => a.openModal('Peminjaman Ambulans Baru', <FormTahap jenis="pemakai" />)}>+ Peminjaman Baru</button></div>
      {daftarPinjam.length ? daftarPinjam.map(t => <KartuPinjam key={t.id} t={t} m={per[t.id] || {}} pos={s.data.pos} saldo={s.data.saldo} />)
        : <div className="kartu kosong">Belum ada peminjaman yang berjalan</div>}
    </>}

    {f === 'kembali' && <>
      <p className="kecil">Pengembalian diisi setelah ambulans kembali: KM akhir, toll per gerbang, BBM sesuai struk, dan nama pengembali.</p>
      {daftarKembali.length ? daftarKembali.map(t => <KartuKembali key={t.id} t={t} m={per[t.id] || {}} toll={tollDari((per[t.id] || {}).pengembalian?.id)} pos={s.data.pos} />)
        : <div className="kartu kosong">Belum ada ambulans yang siap dikembalikan. Peminjaman harus lengkap dan disetujui dulu.</div>}
    </>}

    {f === 'riwayat' && <>
      <div className="kartu">
        <div className="baris-flex"><b className="spasi">Jasa dari Peminjam</b>
          {a.punya('bendahara', 'admin') && <button className="btn kecil" onClick={() => a.openModal('Pemasukan Jasa Peminjam', <FormJasa trips={s.data.trips.filter(t => t.status !== 'dibatalkan')} />)}>+ Pemasukan</button>}</div>
        {s.data.jasa.length ? s.data.jasa.slice(0, 8).map(j => <div key={j.id} className="baris-flex" style={{ marginTop: 8 }}>
          <span className="kecil spasi">{tgl(j.tanggal)} · {j.keterangan}</span><b>{rp(j.jumlah)}</b></div>)
          : <div className="kecil">Belum ada pemasukan jasa</div>}
        {s.data.jasa.length > 8 && <div className="kecil">Menampilkan 8 terbaru. Semua tercatat di Buku Kas pos Ambulans.</div>}
      </div>
      {daftarRiwayat.length ? daftarRiwayat.map(t => <KartuPinjam key={t.id} t={t} m={per[t.id] || {}} toll={tollDari((per[t.id] || {}).pengembalian?.id)} pos={s.data.pos} saldo={s.data.saldo} />)
        : <div className="kartu kosong">Belum ada yang selesai</div>}
    </>}
  </>;
}

/* nilai ringkas satu tahap peminjaman */
const nilai = x => !x ? '' : x.jenis === 'pemakai' ? x.teks
  : x.jenis === 'tujuan' ? `${x.teks} · ${x.rs}, ${x.kota}`
  : x.jenis === 'km_awal' ? km(x.angka) : rp(x.angka);

/* Ketum approve/tolak, dan Bendahara cairkan dana. Dipakai kartu peminjaman & pengembalian */
function AksiTahap({ x, label }) {
  const a = useApp();
  const ketum = a.punya('ketum');                // sama dengan aturan database: hanya Ketum
  const putuskan = async setuju => {
    let cat = null;
    if (!setuju) { cat = prompt('Alasan menolak:'); if (!cat) return; }
    else if (!confirm(`Setujui ${label}?` + (x.jenis === 'uang_jalan' ? '\nUang jalan akan dikeluarkan dari kas pos Ambulans.'
      : x.jenis === 'pengembalian' ? '\nSisa/kekurangan uang jalan akan dicatat di kas pos Ambulans.' : ''))) return;
    const hasil = await rpc('ambulans_putuskan', { p_tahap: x.id, p_setuju: setuju, p_catatan: cat });
    a.toast(hasil === 'menunggu_dana' ? 'Disetujui. Saldo pos Ambulans kurang, diteruskan ke Bendahara' : setuju ? 'Disetujui' : 'Ditolak');
    a.refresh();
  };
  if (x.status === 'diajukan' && ketum) return <div className="aksi">
    <Btn onClick={() => putuskan(true)}>✓ Setujui</Btn>
    <Btn className="btn sek" onClick={() => putuskan(false)}>Tolak</Btn>
  </div>;
  return null;
}

function Dana({ x, pos }) {
  const a = useApp();
  if (x?.status !== 'menunggu_dana') return null;
  return <>
    <div className="kecil">Saldo pos Ambulans kurang {rp(x.dana_kurang)}. Dana dipindahkan Bendahara dari pos lain.</div>
    {a.punya('bendahara') && <div className="aksi"><button className="btn emas" onClick={() => a.openModal('Tambah Dana Pos Ambulans', <FormDana x={x} pos={pos} />)}>Pindahkan dana</button></div>}
  </>;
}

function KartuPinjam({ t, m, toll = [], pos }) {
  const a = useApp();
  const [lbl, cls] = ST_TRIP[t.status];
  const boleh = t.status === 'berjalan' ? bolehAjukan(m) : [];
  const lengkap = pinjamLengkap(m);
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
        {x && <AksiTahap x={x} label={`${NAMA[j]}: ${nilai(x)}`} />}
        <Dana x={x} pos={pos} />
      </div>;
    })}
    {t.status === 'berjalan' && lengkap && <div className="kecil">Peminjaman lengkap. Lanjutkan di menu <b>Pengembalian</b> setelah ambulans kembali.</div>}
    {m.pengembalian && t.status !== 'berjalan' && <RingkasKembali m={m} toll={toll} />}
    {t.status === 'berjalan' && <div className="aksi">
      {boleh.map(j => <button key={j} className="btn emas" onClick={() => a.openModal('Ajukan ' + NAMA[j], <FormTahap trip={t.id} jenis={j} lama={m[j]} />)}>
        {m[j]?.status === 'ditolak' ? 'Ajukan ulang' : 'Ajukan'} {NAMA[j]}</button>)}
      {(t.dibuat_by === a.me.id || a.punya('ketum', 'admin')) && <Btn className="btn sek" onClick={async () => {
        if (!confirm('Batalkan pemakaian ini?')) return;
        await rpc('ambulans_batal', { p_trip: t.id }); a.toast('Pemakaian dibatalkan'); a.refresh();
      }}>Batalkan</Btn>}
    </div>}
  </div>;
}

/* rincian pengembalian + saldo akhir */
function RingkasKembali({ m, toll }) {
  const p = m.pengembalian, jalan = +(m.uang_jalan?.angka || 0);
  const tempuh = p.angka - (m.km_awal?.angka || 0);
  const sisa = +p.sisa;
  return <div style={{ marginTop: 8, paddingTop: 6, borderTop: '1px solid var(--garis, #eee)' }}>
    <div className="tebal">Pengembalian oleh {p.teks}</div>
    <div className="baris-flex"><span className="kecil spasi">KM akhir</span><b>{km(p.angka)}</b></div>
    {m.km_awal && <div className="baris-flex"><span className="kecil spasi">Jarak tempuh</span><b>{km(tempuh)}</b></div>}
    {toll.length ? toll.map(r => <div key={r.id} className="baris-flex"><span className="kecil spasi">Toll · {r.gerbang}</span><b>{rp(r.jumlah)}</b></div>)
      : <div className="baris-flex"><span className="kecil spasi">Toll</span><b>Tidak ada</b></div>}
    <div className="baris-flex"><span className="kecil spasi">Total toll</span><b>{rp(p.toll_total)}</b></div>
    <div className="baris-flex"><span className="kecil spasi">BBM (struk)</span><b>{rp(p.bbm)}</b></div>
    <div className="baris-flex"><span className="kecil spasi">Uang jalan</span><b>{rp(jalan)}</b></div>
    <div className="baris-flex"><span className="kecil spasi">{sisa >= 0 ? 'Saldo akhir (sisa dikembalikan)' : 'Kekurangan uang jalan'}</span><b>{rp(Math.abs(sisa))}</b></div>
  </div>;
}

function KartuKembali({ t, m, toll, pos }) {
  const a = useApp();
  const p = m.pengembalian;
  const [sl, sc] = p ? ST[p.status] : ['Belum diisi', 'b-abu'];
  const boleh = !p || p.status === 'ditolak';
  return <div className="kartu">
    <div className="baris-flex"><b className="spasi">Pemakaian #{t.id}</b><span className={'badge ' + sc}>{sl}</span></div>
    <div className="tebal">{m.pemakai?.teks}</div>
    <div className="kecil">{m.tujuan?.teks} · {m.tujuan?.rs}, {m.tujuan?.kota}</div>
    <div className="baris-flex"><span className="kecil spasi">KM awal</span><b>{km(m.km_awal?.angka)}</b></div>
    <div className="baris-flex"><span className="kecil spasi">Uang jalan</span><b>{rp(m.uang_jalan?.angka)}</b></div>
    {p && <>
      <RingkasKembali m={m} toll={toll} />
      <div className="kecil">Diajukan {a.nm(p.diajukan_by)}{p.putus_at ? ` · diputuskan ${a.nm(p.putus_by)} ${jam(p.putus_at)}` : ''}</div>
      {p.status === 'ditolak' && p.catatan && <div className="kecil">Alasan ditolak: {p.catatan}</div>}
      <AksiTahap x={p} label="pengembalian ambulans" />
      <Dana x={p} pos={pos} />
    </>}
    {boleh && <div className="aksi"><button className="btn emas" onClick={() => a.openModal('Pengembalian Ambulans', <FormKembali t={t} m={m} toll={toll} />)}>
      {p ? 'Isi ulang pengembalian' : 'Input Pengembalian'}</button></div>}
  </div>;
}

function FormTahap({ trip = null, jenis, lama }) {
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
    {jenis === 'km_awal' && <>
      <label className="f" htmlFor="amKm">KM awal (angka di odometer)</label>
      <input className="f" id="amKm" inputMode="numeric" placeholder="0" value={angka || ''} onChange={e => setAngka(Number(e.target.value.replace(/[^\d]/g, '')) || 0)} />
    </>}
    {jenis === 'uang_jalan' && <InputRp id="amUang" label="Jumlah uang jalan" value={angka} onChange={setAngka} />}
    <div className="aksi"><Btn onClick={kirim}>Ajukan ke Ketum</Btn></div>
  </>;
}

function FormKembali({ t, m, toll }) {
  const a = useApp();
  const p = m.pengembalian;
  const [kmAkhir, setKmAkhir] = useState(p?.angka ? +p.angka : 0);
  const [nama, setNama] = useState(p?.teks || '');
  const [bbm, setBbm] = useState(p?.bbm ? +p.bbm : 0);
  const [baris, setBaris] = useState(toll.length ? toll.map(r => ({ gerbang: r.gerbang, jumlah: +r.jumlah })) : [{ gerbang: '', jumlah: 0 }]);
  const ubah = (i, k, v) => setBaris(baris.map((b, j) => j === i ? { ...b, [k]: v } : b));
  const isi = baris.filter(b => b.gerbang.trim() || b.jumlah);
  const totalToll = isi.reduce((x, b) => x + (+b.jumlah || 0), 0);
  const jalan = +(m.uang_jalan?.angka || 0);
  const sisa = jalan - totalToll - (+bbm || 0);

  const kirim = async () => {
    if (kmAkhir <= +m.km_awal.angka) throw new Error(`KM akhir harus lebih besar dari KM awal (${km(m.km_awal.angka)})`);
    if (!nama.trim()) throw new Error('Nama pengembali wajib diisi');
    if (isi.some(b => !b.gerbang.trim() || !b.jumlah)) throw new Error('Lengkapi nama gerbang dan nominal toll, atau hapus barisnya');
    await rpc('ambulans_kembali', {
      p_trip: t.id, p_km_akhir: kmAkhir, p_pengembali: nama.trim(), p_bbm: bbm || 0,
      p_toll: isi.map(b => ({ gerbang: b.gerbang.trim(), jumlah: +b.jumlah }))
    });
    a.closeModal(); a.toast('Pengembalian diajukan, menunggu approval Ketum'); a.refresh();
  };

  return <>
    <div className="kecil">KM awal: {km(m.km_awal.angka)} · Uang jalan: {rp(jalan)}</div>
    <label className="f" htmlFor="kbKm">KM akhir (saat kembali)</label>
    <input className="f" id="kbKm" inputMode="numeric" placeholder="0" value={kmAkhir || ''} onChange={e => setKmAkhir(Number(e.target.value.replace(/[^\d]/g, '')) || 0)} />
    <Field id="kbNama" label="Nama pengembali" value={nama} onChange={e => setNama(e.target.value)} />
    <b className="kecil">Pemakaian toll (per gerbang / karcis)</b>
    {baris.map((b, i) => <div key={i} className="baris-flex" style={{ gap: 6, alignItems: 'flex-end' }}>
      <div className="spasi"><Field id={'kbG' + i} label={'Gerbang ' + (i + 1)} value={b.gerbang} onChange={e => ubah(i, 'gerbang', e.target.value)} /></div>
      <div className="spasi"><InputRp id={'kbJ' + i} label="Nominal" value={b.jumlah} onChange={v => ubah(i, 'jumlah', v)} /></div>
      {baris.length > 1 && <button className="btn sek kecil" onClick={() => setBaris(baris.filter((_, j) => j !== i))}>Hapus</button>}
    </div>)}
    <div className="aksi"><button className="btn sek kecil" onClick={() => setBaris([...baris, { gerbang: '', jumlah: 0 }])}>+ Tambah gerbang</button></div>
    <InputRp id="kbBbm" label="Nominal pembelian BBM (sesuai struk)" value={bbm} onChange={setBbm} />
    <div className="kartu">
      <div className="baris-flex"><span className="kecil spasi">Total toll</span><b>{rp(totalToll)}</b></div>
      <div className="baris-flex"><span className="kecil spasi">BBM</span><b>{rp(bbm)}</b></div>
      <div className="baris-flex"><span className="kecil spasi">{sisa >= 0 ? 'Saldo akhir (sisa dikembalikan ke kas)' : 'Kekurangan uang jalan'}</span><b>{rp(Math.abs(sisa))}</b></div>
    </div>
    <div className="aksi"><Btn onClick={kirim}>Ajukan ke Ketum</Btn></div>
  </>;
}

function FormDana({ x, pos }) {
  const a = useApp();
  const [dari, setDari] = useState('');
  const sumber = pos.filter(p => p.aktif && p.nama !== 'Ambulans');
  const kirim = async () => {
    if (!dari) throw new Error('Pilih pos sumber dana');
    if (!confirm('Pindahkan dana ke pos Ambulans dan catat pengeluarannya?')) return;
    await rpc('ambulans_dana_bendahara', { p_tahap: x.id, p_pos_sumber: +dari });
    a.closeModal(); a.toast('Dana dipindahkan dan tercatat'); a.refresh();
  };
  return <>
    <div className="kecil">Kekurangan saldo pos Ambulans: <b>{rp(x.dana_kurang)}</b>. Jumlah yang dipindahkan dihitung otomatis dari saldo terbaru.</div>
    <label className="f" htmlFor="dnPos">Ambil dari pos</label>
    <select className="f" id="dnPos" value={dari} onChange={e => setDari(e.target.value)}>
      <option value="">Pilih pos…</option>
      {sumber.map(p => <option key={p.id} value={p.id}>{p.nama}</option>)}</select>
    <div className="aksi"><Btn onClick={kirim}>Pindahkan &amp; catat</Btn></div>
  </>;
}

function FormJasa({ trips }) {
  const a = useApp();
  const [f, setF] = useState({ tgl: hariIni(), peminjam: '', trip: '', jml: 0, ket: '' });
  const simpan = async () => {
    if (!f.peminjam.trim() || !f.jml) return a.toast('Nama peminjam dan jumlah wajib diisi', true);
    if (!confirm(`Simpan pemasukan jasa ${rp(f.jml)} dari ${f.peminjam.trim()}? Tidak bisa dihapus.`)) return;
    await rpc('ambulans_jasa', { p_trip: f.trip ? +f.trip : null, p_tanggal: f.tgl, p_jumlah: f.jml, p_peminjam: f.peminjam.trim(), p_keterangan: f.ket.trim() || null });
    a.closeModal(); a.toast('Pemasukan jasa tersimpan'); a.refresh();
  };
  return <>
    <Field id="jsTgl" label="Tanggal" type="date" value={f.tgl} onChange={e => setF({ ...f, tgl: e.target.value })} />
    <Field id="jsNama" label="Nama peminjam" value={f.peminjam} onChange={e => setF({ ...f, peminjam: e.target.value })} />
    <label className="f" htmlFor="jsTrip">Pemakaian terkait (opsional)</label>
    <select className="f" id="jsTrip" value={f.trip} onChange={e => setF({ ...f, trip: e.target.value })}>
      <option value="">Tanpa pemakaian</option>
      {trips.map(t => <option key={t.id} value={t.id}>Pemakaian #{t.id} · {jam(t.dibuat_at)}</option>)}</select>
    <InputRp id="jsJml" label="Jumlah jasa" value={f.jml} onChange={v => setF({ ...f, jml: v })} />
    <Field id="jsKet" label="Keterangan (opsional)" value={f.ket} onChange={e => setF({ ...f, ket: e.target.value })} />
    <div className="aksi"><Btn onClick={simpan}>Simpan</Btn></div>
    <p className="kecil">Otomatis masuk Buku Kas pos Ambulans dengan kategori "Jasa dari peminjam". Jika salah, buat transaksi koreksi lewat menu Kas.</p>
  </>;
}
