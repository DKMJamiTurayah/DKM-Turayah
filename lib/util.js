export const NAMA_DKM = process.env.NEXT_PUBLIC_NAMA_DKM || 'DKM Masjid Jami Turayah';
export const EMAIL_DOMAIN = process.env.NEXT_PUBLIC_EMAIL_DOMAIN || 'dkmturayah.id';

export const ROLE = {
  pending: 'Menunggu aktivasi', admin: 'Admin', ketum: 'Ketua Umum', bendahara: 'Bendahara',
  sekretaris: 'Sekretaris', ketua_bidang: 'Ketua Bidang', petugas: 'Petugas Keropak/Iuran'
};
export const ST_AJU = {
  diajukan: ['Menunggu Ketum', 'b-kuning'], disetujui: ['Disetujui · tunggu pencairan', 'b-biru'],
  dicairkan: ['Dicairkan · tunggu konfirmasi', 'b-ungu'], diterima: ['Selesai · diterima', 'b-hijau'],
  ditolak: ['Ditolak', 'b-merah'], dibatalkan: ['Dibatalkan', 'b-abu']
};
export const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
export const BULAN_P = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

export const esc = s => (s ?? '').toString().replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const rp = n => 'Rp ' + Number(n || 0).toLocaleString('id-ID');
export const tgl = d => d ? new Date(d.length === 10 ? d + 'T00:00:00' : d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
export const jam = d => d ? new Date(d).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';
export const hariIni = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
export const bulanIni = () => hariIni().slice(0, 7);
export const angka = v => Number(String(v ?? '').replace(/[^\d]/g, '')) || 0;
export const pendek = n => (n || '').split(' (')[0];
export const periode = (th, i) => th + '-' + String(i + 1).padStart(2, '0');
export const keEmail = u => u.includes('@') ? u.trim().toLowerCase() : u.trim().toLowerCase().replace(/\s+/g, '') + '@' + EMAIL_DOMAIN;

export function jumatTerakhir() {
  const d = new Date(hariIni() + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() - 5 + 7) % 7));
  return d.toISOString().slice(0, 10);
}

// Jumat terdekat ke depan (hari ini kalau hari ini Jumat)
export function jumatDepan() {
  const d = new Date(hariIni() + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + ((5 - d.getUTCDay() + 7) % 7));
  return d.toISOString().slice(0, 10);
}

export const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
export function tglPanjang(s) {
  if (!s) return '-';
  const d = new Date(s + 'T00:00:00Z');
  return `${HARI[d.getUTCDay()]}, ${d.getUTCDate()} ${BULAN_P[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function pesanError(e) {
  const m = e?.message || String(e);
  if (/duplicate key|keropak_satu_per_tanggal/.test(m)) return 'Data sudah ada (dobel)';
  if (/Invalid login/.test(m)) return 'Username atau password salah';
  if (/already registered/.test(m)) return 'Username sudah dipakai';
  if (/Password should be/.test(m)) return 'Password minimal 6 karakter';
  return m;
}

 export function unduhCSVlama(nama, rows) {
   const csv = '﻿' + rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = nama; a.click();
}

export function cetak(judul, isi) {
  const w = window.open('', '_blank');
  if (!w) return false;
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(judul)}</title><style>
    body{font:12px/1.4 Arial,sans-serif;margin:18mm 14mm;color:#000} h2{text-align:center;margin:0;font-size:16px} .sub{text-align:center;margin-bottom:14px}
    table{width:100%;border-collapse:collapse;margin:8px 0} .data th,.data td{border:1px solid #000;padding:4px 6px} .data th{background:#eee}
    .info td{padding:2px 4px} .r{text-align:right} .ttdt td{text-align:center;width:25%;vertical-align:top;padding-top:16px}
    .ttd{height:46px;font-size:10px;color:#0a6;display:flex;align-items:center;justify-content:center}
    @media print{button{display:none}}</style></head><body>${isi}
    <p style="font-size:10px;color:#666;margin-top:20px">Dicetak ${jam(new Date())} dari sistem ${esc(NAMA_DKM)}</p>
    <button onclick="print()" style="padding:8px 16px">Cetak</button></body></html>`);
  w.document.close();
  return true;
}
function crc32(b){let c,t=crc32.t;if(!t){t=crc32.t=[];for(let n=0;n<256;n++){c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0}}c=0xFFFFFFFF;for(let i=0;i<b.length;i++)c=t[(c^b[i])&255]^(c>>>8);return(c^0xFFFFFFFF)>>>0}
function zipBlob(files){
  const te=new TextEncoder(),parts=[],cen=[];let off=0;
  files.forEach(([nm,isi])=>{
    const n=te.encode(nm),d=te.encode(isi),c=crc32(d);
    const h=new DataView(new ArrayBuffer(30));
    h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint16(6,0x0800,true);h.setUint16(12,0x21,true);h.setUint32(14,c,true);h.setUint32(18,d.length,true);h.setUint32(22,d.length,true);h.setUint16(26,n.length,true);
    parts.push(new Uint8Array(h.buffer),n,d);
    const e=new DataView(new ArrayBuffer(46));
    e.setUint32(0,0x02014b50,true);e.setUint16(4,20,true);e.setUint16(6,20,true);e.setUint16(8,0x0800,true);e.setUint16(14,0x21,true);e.setUint32(16,c,true);e.setUint32(20,d.length,true);e.setUint32(24,d.length,true);e.setUint16(28,n.length,true);e.setUint32(42,off,true);
    cen.push(new Uint8Array(e.buffer),n);
    off+=30+n.length+d.length;
  });
  const cs=cen.reduce((x,p)=>x+p.length,0);
  const z=new DataView(new ArrayBuffer(22));
  z.setUint32(0,0x06054b50,true);z.setUint16(8,files.length,true);z.setUint16(10,files.length,true);z.setUint32(12,cs,true);z.setUint32(16,off,true);
  return new Blob([...parts,...cen,new Uint8Array(z.buffer)],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}
const kolomXl=i=>{let s='';for(i++;i>0;i=Math.floor((i-1)/26))s=String.fromCharCode(65+(i-1)%26)+s;return s};
const xe=s=>String(s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
function buatXlsx(rows){
  const NS='http://schemas.openxmlformats.org/spreadsheetml/2006/main',lebar=[];
  const sx=rows.map((r,ri)=>'<row r="'+(ri+1)+'">'+r.map((v,ci)=>{
    if(v===null||v===undefined||v==='')return '';
    const ref=kolomXl(ci)+(ri+1),s=String(v);
    lebar[ci]=Math.max(lebar[ci]||8,Math.min(50,s.length+2));
    if(ri===0)return '<c r="'+ref+'" s="1" t="inlineStr"><is><t>'+xe(s)+'</t></is></c>';
    if((typeof v==='number'&&isFinite(v))||/^-?(0|[1-9]\d{0,14})(\.\d+)?$/.test(s))return '<c r="'+ref+'" s="2"><v>'+Number(s)+'</v></c>';
    return '<c r="'+ref+'" t="inlineStr"><is><t xml:space="preserve">'+xe(s)+'</t></is></c>';
  }).join('')+'</row>').join('');
  const cols=lebar.map((w,i)=>w?'<col min="'+(i+1)+'" max="'+(i+1)+'" width="'+w+'" customWidth="1"/>':'<col min="'+(i+1)+'" max="'+(i+1)+'" width="8"/>').join('');
  const H='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  return zipBlob([
        ['[Content_Types].xml',H+'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>'],
    ['_rels/.rels',H+'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
    ['xl/workbook.xml',H+'<workbook xmlns="'+NS+'" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Data" sheetId="1" r:id="rId1"/></sheets></workbook>'],
    ['xl/_rels/workbook.xml.rels',H+'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'],
        ['xl/styles.xml',H+'<styleSheet xmlns="'+NS+'"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFD9EAD3"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="3" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>'],
    ['xl/worksheets/sheet1.xml',H+'<worksheet xmlns="'+NS+'"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>'+cols+'</cols><sheetData>'+sx+'</sheetData></worksheet>']
  ]);
}
export function unduhCSV(nama, rows) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(buatXlsx(rows));
  a.download = nama.replace(/\.csv$/i, '.xlsx'); a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
