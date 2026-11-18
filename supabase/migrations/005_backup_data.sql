-- =====================================================================
--  DKM Masjid Jami Turayah — fungsi BACKUP SEMUA DATA
--  Jalankan sekali di Supabase: SQL Editor -> New query -> paste -> Run.
--  Tidak mengubah data apa pun. Hanya admin yang bisa memakai.
--  Daftar tabel dibaca langsung dari database, jadi tabel baru otomatis ikut.
-- =====================================================================

create or replace function public.backup_semua_data()
returns json
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  t record;
  hasil jsonb := '{}'::jsonb;
  isi jsonb;
begin
  if not public.has_role(array['admin']) then
    raise exception 'Hanya admin yang dapat mengunduh backup.';
  end if;

  for t in
    select c.relname as nama
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind in ('r', 'p')
     order by c.relname
  loop
    execute format('select coalesce(jsonb_agg(to_jsonb(x)), ''[]''::jsonb) from (select * from public.%I order by 1) x', t.nama)
      into isi;
    hasil := hasil || jsonb_build_object(t.nama, isi);
  end loop;

  return json_build_object('dibuat', now(), 'tabel', hasil);
end $$;

revoke all on function public.backup_semua_data() from public, anon;
grant execute on function public.backup_semua_data() to authenticated;
