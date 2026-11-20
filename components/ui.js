'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { angka, pesanError } from '@/lib/util';

export const AppCtx = createContext(null);
export const useApp = () => useContext(AppCtx);

// muat data async; data lama tetap tampil saat memuat ulang
export function useLoad(fn, deps) {
  const [s, setS] = useState({ loading: true });
  useEffect(() => {
    let hidup = true;
    setS(x => ({ ...x, loading: true }));
    fn().then(d => hidup && setS({ data: d, loading: false }))
        .catch(e => hidup && setS({ err: pesanError(e), loading: false }));
    return () => { hidup = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return s;
}

export function Loading({ s }) {
  if (s?.err) return <div className="kartu kosong">Gagal memuat: {s.err}</div>;
  return <div className="loading">Memuat…</div>;
}

// tombol aksi: otomatis disable saat proses + tampilkan error
export function Btn({ onClick, className = 'btn', children, disabled, ...p }) {
  const [busy, setBusy] = useState(false);
  const { toast } = useApp();
  return (
    <button {...p} className={className} disabled={busy || disabled}
      onClick={async e => {
        setBusy(true);
        try { await onClick(e); } catch (err) { toast(pesanError(err), true); }
        finally { setBusy(false); }
      }}>{children}</button>
  );
}

export function Field({ id, label, ...p }) {
  return <><label className="f" htmlFor={id}>{label}</label><input className="f" id={id} {...p} /></>;
}

export function InputRp({ id, label, value, onChange }) {
  return <>
    <label className="f" htmlFor={id}>{label}</label>
    <input className="f" id={id} inputMode="numeric" placeholder="0"
      value={value ? Number(value).toLocaleString('id-ID') : ''}
      onChange={e => onChange(angka(e.target.value))} />
  </>;
}

export function Chips({ items, value, onChange }) {
  return <div className="chips">
    {items.map(([k, l]) => <button key={k} className={value === k ? 'on' : ''} onClick={() => onChange(k)}>{l}</button>)}
  </div>;
}

export const IK = {
  beranda: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/></svg>',
  jadwal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/><path d="M17 4v4M15 6h4"/></svg>',
  pengajuan: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 3h8l4 4v14H7z"/><path d="M15 3v4h4M10 12h6M10 16h6"/></svg>',
  keropak: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="8" width="16" height="12" rx="2"/><path d="M9 8V6a3 3 0 0 1 6 0v2M10 13h4"/></svg>',
  iuran: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="8" r="3"/><path d="M3 20c0-3 3-5 6-5s6 2 6 5M16 4a3 3 0 0 1 0 6M18 15c2 .5 3 2 3 5"/></svg>',
  kas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 5h14a2 2 0 0 1 2 2v12H6a2 2 0 0 1-2-2z"/><path d="M4 7a2 2 0 0 0 2 2h14M16 14h.01"/></svg>',
  intransit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 8h13l-3-3M20 16H7l3 3"/></svg>',
  ambulans: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 16V8h11v8M13 11h4l3 3v2h-2"/><circle cx="7" cy="17" r="2"/><circle cx="16" cy="17" r="2"/><path d="M7.5 10v3M6 11.5h3"/></svg>',
  maklumat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 10v4h3l6 4V6L6 10z"/><path d="M16 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12"/></svg>',
  zakat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 10h12l-1.5 10h-9z"/><path d="M9 10V7a3 3 0 0 1 6 0v3M12 14v3"/></svg>',
  qurban: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 9c-1.5-1-2-3-1-4 1 1 2 1 3 1M19 9c1.5-1 2-3 1-4-1 1-2 1-3 1"/><path d="M7 6h10l1 6-2 3v5h-3v-3h-2v3H8v-5l-2-3z"/></svg>',
  inventaris: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7l9-4 9 4v10l-9 4-9-4z"/><path d="M3 7l9 4 9-4M12 11v10"/></svg>',
  kelola: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/></svg>'
};

export function LogoMasjid({ size = 34 }) {
  return <img src="/logo.png" alt="Logo Masjid" width={size} height={size} style={{ objectFit: 'contain', borderRadius: 4, display: 'block' }} />;
}
