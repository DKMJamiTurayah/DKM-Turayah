import { createClient } from '@supabase/supabase-js';

let client = null;

// Client dibuat sekali di browser. window.__DKM_TEST__ hanya dipakai saat pengujian otomatis.
export function sb() {
  if (client) return client;
  const T = typeof window !== 'undefined' ? window.__DKM_TEST__ : null;
  client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    T ? { global: { headers: { Authorization: 'Bearer ' + T.token } }, auth: { persistSession: false, autoRefreshToken: false } } : {}
  );
  return client;
}

export async function rpc(fn, args) {
  const { data, error } = await sb().rpc(fn, args);
  if (error) throw error;
  return data;
}

export async function q(promise) {
  const { data, error } = await promise;
  if (error) throw error;
  return data;
}
