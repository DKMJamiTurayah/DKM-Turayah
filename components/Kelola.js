'use client';
import { useEffect, useState } from 'react';
import { sb, rpc, q } from '@/lib/supabase';
import { ROLE, jam } from '@/lib/util';
import { Btn, Chips, Field, Loading, useApp, useLoad } from './ui';
import { JalurInfo, susunInfo } from './InfoBerjalan';

export default function Kelola() {
  const a = useApp();
  const tab = a.sub.kelola || 'pengurus';
  const s = useLoad(async () => {
    const profs = await q(sb().from('profiles').select('*').order('created_at'));
    const m = {}; profs.forEach(p => m[p.id] = p); a.setProf(m);
    return profs;
  }, [a.refreshKey]);

  return <>
    <h2>Kelola</h2>
    <Chips items={[['pengurus', 'Pengurus'], ['bidang', 'Bidang'], ['info', 'Info Berjalan'], ...(a.punya('admin') ? [['aktivitas', 'Aktivitas'], ['backup', 'Backup']] : [])]} value={tab} onChange={k => a.setSub('kelola', k)} />
    {tab === 'backup' && a.punya('admin') ? <Backup /> : tab === 'info' ? <KelolaInfo /> : tab === 'aktivitas' && a.punya('admin') ? <Aktivitas /> : !s.data ? <Loading s={s} /> : tab === 'pengurus' ? <>
      <p className="kecil">Pengurus mendaftar sendiri lewat halaman login (&quot;Daftar Pengurus&quot;), lalu jabatannya diatur di sini.</p>
      {s.data.slice().sort((x, y) => (x.role === 'pending' ? 0 : 1) - (y.role === 'pending' ? 0 : 1)).map(p => (
        <div className="kartu klik" key={p.id} onClick={() => a.openModal('Atur Pengurus', <FormUser p={p} />)}>
          <div className="baris-flex"><div className="spasi"><b>{p.nama}</b><div className="kecil">@{p.username}{p.no_rumah ? ' · Rumah ' + p.no_rumah : ''}{p.no_hp ? ' · ' + p.no_hp : ''}</div></div>
            <span className={'badge ' + (p.role === 'pending' ? 'b-kuning' : p.aktif ? 'b-hijau' : 'b-abu')}>{ROLE[p.role]}{p.aktif ? '' : ' (nonaktif)'}</span></div>
          {p.role === 'ketua_bidang' && <div className="kecil">{a.bn(p.bidang_id)}</div>}
          {p.jabatan && <div className="kecil">{p.jabatan}</div>}
          {p.boleh_maklumat && !['admin', 'ketum'].includes(p.role) && <div className="kecil masuk">✓ Pembuat maklumat</div>}
        </div>))}
    </> : <>
      <div className="aksi" style={{ marginTop: 0, marginBottom: 10 }}>
        <button className="btn" onClick={() => a.openModal('Tambah Bidang', <FormBidang />)}>+ Tambah Bidang</button></div>
      {Object.values(a.bid).map(b => {
        const kb = s.data.filter(p => p.role === 'ketua_bidang' && p.bidang_id === b.id && p.aktif);
        return <div className="kartu klik" key={b.id} style={b.aktif ? {} : { opacity: .5 }} onClick={() => a.openModal('Ubah Bidang', <FormBidang b={b} />)}>
          <b>{b.nama}</b><div className="kecil">Ketua: {kb.length ? kb.map(p => p.nama).join(', ') : <i>belum ada</i>}{b.aktif ? '' : ' · nonaktif'}</div></div>;
      })}
    </>}
  </>;
}

function FormUser({ p }) {
  const a = useApp();
  const bidAktif = Object.values(a.bid).filter(b => b.aktif);
  const [f, setF] = useState({ role: p.role, bidang: p.bidang_id || bidAktif[0]?.id || null, jabatan: p.jabatan || '', aktif: p.aktif, mk: !!p.boleh_maklumat });
  const simpan = async () => {
    await rpc('set_user', { p_id: p.id, p_role: f.role, p_bidang: f.role === 'ketua_bidang' ? +f.bidang : null, p_jabatan: f.jabatan.trim() || null, p_aktif: f.aktif });
    if (f.mk !== !!p.boleh_maklumat) await rpc('set_akses_maklumat', { p_id: p.id, p_boleh: f.mk });
    a.closeModal(); a.toast('Tersimpan');
    if (p.id === a.me.id) return a.muatSaya(a.me.id);
    a.refresh();
  };
  return <>
    <b>{p.nama}</b> <span className="kecil">@{p.username}{p.no_rumah ? ' · Rumah ' + p.no_rumah : ''}</span>
    <label className="f" htmlFor="uRole">Peran di sistem</label>
    <select className="f" id="uRole" value={f.role} onChange={e => setF({ ...f, role: e.target.value })}>
      {Object.entries(ROLE).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
    {f.role === 'ketua_bidang' && <>
      <label className="f" htmlFor="uBid">Bidang</label>
      <select className="f" id="uBid" value={f.bidang || ''} onChange={e => setF({ ...f, bidang: e.target.value })}>
        {bidAktif.map(b => <option key={b.id} value={b.id}>{b.nama}</option>)}</select></>}
    <Field id="uJab" label="Jabatan (tampil di aplikasi, opsional)" placeholder="contoh: Wakil Bendahara" value={f.jabatan} onChange={e => setF({ ...f, jabatan: e.target.value })} />
    <label className="f"><input type="checkbox" checked={f.aktif} onChange={e => setF({ ...f, aktif: e.target.checked })} /> Akun aktif</label>
    {!['admin', 'ketum'].includes(f.role) && <label className="f"><input type="checkbox" checked={f.mk} onChange={e => setF({ ...f, mk: e.target.checked })} /> Boleh membuat &amp; mengubah Maklumat Jumat</label>}
    <div className="kecil" style={{ marginTop: 8 }}><b>Hak akses:</b> Ketua Umum = approve pengajuan & kelola pengurus · Bendahara = cairkan dana, terima keropak & iuran, transaksi kas · Ketua Bidang = ajukan anggaran & konfirmasi terima · Petugas/Sekretaris = setor keropak & catat iuran · Admin = kelola pengurus. Maklumat Jumat dibuat oleh Admin, Ketum, dan pengurus yang dicentang. Semua pengurus bisa melihat laporan.</div>
    <div className="aksi"><Btn onClick={simpan}>Simpan</Btn></div>
  </>;
}

function FormBidang({ b }) {
  const a = useApp();
  const [f, setF] = useState({ nama: b?.nama || '', aktif: b ? b.aktif : true });
  const simpan = async () => {
    const d = { nama: f.nama.trim(), aktif: f.aktif };
    if (!d.nama) return a.toast('Nama wajib diisi', true);
    await q(b ? sb().from('bidang').update(d).eq('id', b.id) : sb().from('bidang').insert(d));
    await a.muatBidang(); a.closeModal(); a.toast('Tersimpan'); a.refresh();
  };
  return <>
    <Field id="bNama" label="Nama bidang" value={f.nama} onChange={e => setF({ ...f, nama: e.target.value })} />
    <label className="f"><input type="checkbox" checked={f.aktif} onChange={e => setF({ ...f, aktif: e.target.checked })} /> Aktif</label>
    <div className="aksi"><Btn onClick={simpan}>Simpan</Btn></div>
  </>;
}

const NAMA_HAL = { beranda: 'Beranda', jadwal: 'Jadwal', pengajuan: 'Pengajuan', keropak: 'Keropak', iuran: 'Iuran', kas: 'Kas', laporan: 'Laporan', intransit: 'Intransit', ambulans: 'Ambulans', maklumat: 'Maklumat', zakat: 'Zakat', qurban: 'Qurban', inventaris: 'Inventaris', kelola: 'Kelola' };
const ONLINE_MS = 150000; // dianggap online kalau ping terakhir < 2,5 menit lalu (ping tiap 1 menit saat layar terbuka)

function lalu(t) {
  const d = Math.max(0, Math.round((Date.now() - new Date(t)) / 1000));
  if (d < 60) return 'baru saja';
  if (d < 3600) return Math.round(d / 60) + ' menit lalu';
  if (d < 86400) return Math.round(d / 3600) + ' jam lalu';
  return Math.round(d / 86400) + ' hari lalu';
}
function durasi(a, b) {
  const m = Math.max(0, Math.round((new Date(b) - new Date(a)) / 60000));
  return m < 60 ? m + ' mnt' : Math.floor(m / 60) + ' jam ' + (m % 60) + ' mnt';
}

function Aktivitas() {
  const a = useApp();
  const [tick, setTick] = useState(0);
  useEffect(() => { const iv = setInterval(() => setTick(t => t + 1), 30000); return () => clearInterval(iv); }, []);
  const s = useLoad(() => q(sb().from('sesi_aplikasi').select('*').order('terakhir_aktif', { ascending: false }).limit(100)), [tick, a.refreshKey]);
  if (!s.data) return <Loading s={s} />;
  const sekarang = Date.now();
  const online = s.data.filter(x => sekarang - new Date(x.terakhir_aktif) < ONLINE_MS);
  const orang = id => { const p = a.prof[id]; return (p?.nama || '—') + (p?.no_rumah ? ' · Rumah ' + p.no_rumah : ''); };
  return <>
    <p className="kecil">Tercatat otomatis setiap kali ada yang membuka aplikasi setelah login. Layar yang sedang terbuka dihitung online; diperbarui tiap 30 detik. Pengunjung yang belum login tidak tercatat.</p>
    <div className="baris-flex"><h3 className="spasi">Sedang online ({online.length})</h3>
      <button className="btn sek kecil" onClick={() => setTick(t => t + 1)}>Muat ulang</button></div>
    {online.length ? online.map(x => <div className="kartu" key={x.id}>
      <b>{orang(x.user_id)}</b>
      <div className="kecil">Sedang buka: {NAMA_HAL[x.halaman] || x.halaman || '—'} · aktif {lalu(x.terakhir_aktif)}</div></div>)
      : <div className="kartu kosong">Tidak ada yang online saat ini</div>}
    <h3>Riwayat kunjungan terakhir</h3>
    {s.data.length ? s.data.map(x => <div className="kartu" key={x.id}>
      <div className="baris-flex"><b className="spasi">{orang(x.user_id)}</b><span className="kecil">{durasi(x.mulai, x.terakhir_aktif)}</span></div>
      <div className="kecil">Masuk {jam(x.mulai)} · halaman terakhir: {NAMA_HAL[x.halaman] || x.halaman || '—'}</div></div>)
      : <div className="kartu kosong">Belum ada kunjungan tercatat</div>}
  </>;
}

/* ====== Backup semua data (khusus admin) ====== */
const NAMA_SHEET = {
  profiles: 'Pengurus (Akun)', struktur_dkm: 'Struktur DKM', bidang: 'Bidang', pos_dana: 'Pos Dana', kas: 'Kas',
  pengajuan: 'Pengajuan Anggaran', pengajuan_item: 'Rincian Pengajuan', intransit: 'Intransit', ambulans_trip: 'Ambulans - Pemakaian', ambulans_tahap: 'Ambulans - Tahap',
  keropak_jumat: 'Keropak Jumat', iuran: 'Iuran Warga', warga: 'Data Warga', maklumat: 'Maklumat Jumat',
  zakat_tahun: 'Zakat - Setting Tahun', zakat_terima: 'Zakat - Penerimaan', zakat_salur: 'Zakat - Penyaluran',
  qurban_setting: 'Qurban - Setting', qurban_peserta: 'Qurban - Peserta', qurban_bayar: 'Qurban - Pembayaran',
  qurban_bagi: 'Qurban - Pembagian', tarawih: 'Petugas Tarawih', takjil: 'Jadwal Takjil', takjil_setting: 'Takjil - Setting',
  inventaris: 'Inventaris', pinjam: 'Peminjaman', pinjam_item: 'Rincian Peminjaman',
  log_aktivitas: 'Log Aktivitas', sesi_aplikasi: 'Sesi Aplikasi'
};

function Backup() {
  const a = useApp();
  const [info, setInfo] = useState(null);
  const unduh = async () => {
    const data = await rpc('backup_semua_data');
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    wb.creator = 'DKM Masjid Jami Turayah';
    const tgl = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' });
    const ws0 = wb.addWorksheet('Info Backup');
    ws0.addRow(['Backup Semua Data — DKM Masjid Jami Turayah']).font = { bold: true, size: 14 };
    ws0.addRow(['Dibuat ' + jam(data.dibuat) + ' oleh ' + a.me.nama]);
    ws0.addRow(['Simpan di tempat aman. Foto/berkas unggahan tidak ikut, hanya nama/link berkasnya.']).font = { color: { argb: 'FFC00000' } };
    ws0.addRow([]);
    ws0.addRow(['Sheet', 'Tabel database', 'Jumlah baris']).font = { bold: true };
    const dipakai = new Set(['Info Backup']);
    const tabel = Object.keys(data.tabel).sort((x, y) => (NAMA_SHEET[x] ? 0 : 1) - (NAMA_SHEET[y] ? 0 : 1)
      || Object.keys(NAMA_SHEET).indexOf(x) - Object.keys(NAMA_SHEET).indexOf(y) || x.localeCompare(y));
    let total = 0;
    for (const t of tabel) {
      const rows = data.tabel[t] || [];
      total += rows.length;
      let nama = (NAMA_SHEET[t] || t).replace(/[\\/?*[\]:]/g, '-').slice(0, 31);
      for (let i = 2; dipakai.has(nama); i++) nama = nama.slice(0, 28) + ' ' + i;
      dipakai.add(nama);
      ws0.addRow([nama, t, rows.length]);
      const ws = wb.addWorksheet(nama);
      const kolom = [...new Set(rows.flatMap(r => Object.keys(r)))];
      if (!kolom.length) { ws.addRow(['(kosong)']); continue; }
      ws.columns = kolom.map(k => ({ header: k, key: k, width: Math.min(40, Math.max(12, k.length + 2)) }));
      ws.getRow(1).font = { bold: true };
      ws.views = [{ state: 'frozen', ySplit: 1 }];
      rows.forEach(r => ws.addRow(kolom.map(k => r[k] === null || r[k] === undefined ? null : typeof r[k] === 'object' ? JSON.stringify(r[k]) : r[k])));
    }
    ws0.columns = [{ width: 28 }, { width: 22 }, { width: 14 }];
    const buf = await wb.xlsx.writeBuffer();
    const url = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    const el = document.createElement('a');
    el.href = url; el.download = 'Backup-DKM-Turayah-' + tgl + '.xlsx';
    document.body.appendChild(el); el.click(); el.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    setInfo(tabel.length + ' tabel · ' + total.toLocaleString('id-ID') + ' baris');
    a.toast('Backup terunduh');
  };
  return <div className="kartu">
    <b>Backup semua data</b>
    <p className="kecil">Sekali klik mengunduh satu file Excel berisi semua data aplikasi (satu tabel per sheet), untuk disimpan di flashdisk. Tabel baru otomatis ikut.</p>
    <Btn className="btn penuh" onClick={unduh}>⬇ Unduh Backup (.xlsx)</Btn>
    {info && <p className="kecil masuk" style={{ marginTop: 8 }}>✓ Terakhir diunduh: {info}</p>}
    <p className="kecil" style={{ marginTop: 8 }}>Foto/berkas unggahan tidak ikut, hanya nama/link berkasnya. File ini berisi nomor HP pengurus dan data warga — simpan di tempat aman.</p>
  </div>;
}

/* ====== Tulisan berjalan (Admin & Ketum) ====== */
function KelolaInfo() {
  const a = useApp();
  const [n, setN] = useState(0);
  const s = useLoad(async () => {
    const [set] = await q(sb().from('info_berjalan_setting').select('*').eq('id', 1));
    const pesan = await q(sb().from('info_berjalan').select('*').order('urutan').order('id'));
    const pratinjau = await rpc('info_berjalan_publik');
    return { set, pesan, pratinjau };
  }, [n, a.refreshKey]);
  if (!s.data) return s.err?.includes('info_berjalan')
    ? <div className="kartu kosong">Jalankan dulu SQL <b>006_info_berjalan.sql</b> di Supabase.</div> : <Loading s={s} />;
  const { set, pesan, pratinjau } = s.data;
  const muat = () => { setN(x => x + 1); a.refresh(); };
  const ubahSet = async d => { await q(sb().from('info_berjalan_setting').update({ ...d, diubah_by: a.me.id, diubah_at: new Date().toISOString() }).eq('id', 1)); muat(); };
  const items = susunInfo(pratinjau);
  return <>
    <p className="kecil">Tulisan berjalan tampil di atas aplikasi pengurus dan di halaman jamaah. Berhenti saat disentuh supaya bisa dibaca.</p>
    <div className="kartu" style={{ padding: 0, overflow: 'hidden' }}>
      {items.length ? <JalurInfo items={items} /> : <div className="kosong" style={{ padding: 14 }}>{set?.aktif ? 'Belum ada isi' : 'Tulisan berjalan sedang dimatikan'}</div>}
    </div>
    <div className="kartu">
      <label className="f"><input type="checkbox" checked={!!set?.aktif} onChange={e => ubahSet({ aktif: e.target.checked }).catch(er => a.toast(er.message, true))} /> <b>Tampilkan tulisan berjalan</b></label>
      <FormSalam set={set} simpan={ubahSet} />
      <label className="f"><input type="checkbox" checked={!!set?.auto_jumat} onChange={e => ubahSet({ auto_jumat: e.target.checked }).catch(er => a.toast(er.message, true))} /> Otomatis tampilkan petugas Jumat terdekat (dari Maklumat)</label>
      <label className="f"><input type="checkbox" checked={!!set?.auto_saldo} onChange={e => ubahSet({ auto_saldo: e.target.checked }).catch(er => a.toast(er.message, true))} /> Otomatis tampilkan total saldo kas</label>
    </div>
    <div className="baris-flex"><h3 className="spasi">Pesan ({pesan.length})</h3>
      <button className="btn kecil" onClick={() => a.openModal('Tambah Pesan', <FormPesan selesai={muat} urutan={pesan.length} />)}>+ Tambah Pesan</button></div>
    {pesan.length ? pesan.map(p => (
      <div className="kartu klik" key={p.id} style={p.aktif ? {} : { opacity: .5 }} onClick={() => a.openModal('Ubah Pesan', <FormPesan p={p} selesai={muat} />)}>
        <div>{p.teks}</div><div className="kecil">{p.aktif ? 'Tampil' : 'Disembunyikan'} · urutan {p.urutan}</div>
      </div>)) : <div className="kartu kosong">Belum ada pesan. Contoh: "Kajian rutin setiap Ahad ba'da Subuh".</div>}
  </>;
}

function FormSalam({ set, simpan }) {
  const a = useApp();
  const [v, setV] = useState(set?.salam || '');
  return <>
    <Field id="ibSalam" label="Pembuka (boleh tulisan Arab singkat, kosongkan kalau tidak perlu)" dir="auto" value={v} onChange={e => setV(e.target.value)} />
    <div className="aksi" style={{ marginTop: 6 }}><Btn className="btn sek kecil" onClick={async () => { await simpan({ salam: v.trim() || null }); a.toast('Tersimpan'); }}>Simpan pembuka</Btn></div>
  </>;
}

function FormPesan({ p, selesai, urutan = 0 }) {
  const a = useApp();
  const [f, setF] = useState({ teks: p?.teks || '', aktif: p ? p.aktif : true, urutan: p?.urutan ?? urutan });
  const simpan = async () => {
    const d = { teks: f.teks.trim(), aktif: f.aktif, urutan: +f.urutan || 0 };
    if (d.teks.length < 3) return a.toast('Isi pesan minimal 3 huruf', true);
    if (d.teks.length > 200) return a.toast('Pesan maksimal 200 huruf', true);
    await q(p ? sb().from('info_berjalan').update(d).eq('id', p.id) : sb().from('info_berjalan').insert({ ...d, dibuat_by: a.me.id }));
    a.closeModal(); a.toast('Tersimpan'); selesai();
  };
  const hapus = async () => {
    if (!confirm('Hapus pesan ini?')) return;
    await q(sb().from('info_berjalan').delete().eq('id', p.id));
    a.closeModal(); a.toast('Dihapus'); selesai();
  };
  return <>
    <label className="f" htmlFor="ibTeks">Isi pesan ({f.teks.length}/200)</label>
    <textarea className="f" id="ibTeks" rows={3} maxLength={200} dir="auto" value={f.teks} onChange={e => setF({ ...f, teks: e.target.value })}
      placeholder="contoh: Kajian rutin setiap Ahad ba'da Subuh bersama Ust. ..." />
    <Field id="ibUrut" label="Urutan tampil (kecil = duluan)" type="number" value={f.urutan} onChange={e => setF({ ...f, urutan: e.target.value })} />
    <label className="f"><input type="checkbox" checked={f.aktif} onChange={e => setF({ ...f, aktif: e.target.checked })} /> Tampilkan</label>
    <div className="aksi">{p && <Btn className="btn merah-sek" onClick={hapus}>Hapus</Btn>}<Btn onClick={simpan}>Simpan</Btn></div>
  </>;
}
