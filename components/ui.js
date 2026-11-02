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
  pengajuan: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 3h8l4 4v14H7z"/><path d="M15 3v4h4M10 12h6M10 16h6"/></svg>',
  keropak: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="8" width="16" height="12" rx="2"/><path d="M9 8V6a3 3 0 0 1 6 0v2M10 13h4"/></svg>',
  iuran: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="8" r="3"/><path d="M3 20c0-3 3-5 6-5s6 2 6 5M16 4a3 3 0 0 1 0 6M18 15c2 .5 3 2 3 5"/></svg>',
  kas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 5h14a2 2 0 0 1 2 2v12H6a2 2 0 0 1-2-2z"/><path d="M4 7a2 2 0 0 0 2 2h14M16 14h.01"/></svg>',
  maklumat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 10v4h3l6 4V6L6 10z"/><path d="M16 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12"/></svg>',
  kelola: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/></svg>'
};

export function LogoMasjid({ size = 22 }) {
  return <svg width={size} height={size} viewBox="0 0 64 64">
    <path d="M32 8c-9 7-15 12-15 21h30c0-9-6-14-15-21z" fill="#f2c14e" />
    <rect x="15" y="29" width="34" height="23" fill="#fff" />
    <rect x="28" y="37" width="8" height="15" rx="4" fill="#0f5e47" />
  </svg>;
}
