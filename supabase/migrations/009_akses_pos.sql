-- =====================================================================
--  DKM Turayah — 009: AKSES PER POS DANA (tiap pengurus hanya lihat pos yang diizinkan)
--  Jalankan sekali di SQL Editor (New query -> paste -> Run). Aman diulang.
--  Admin, Ketum, Bendahara selalu melihat SEMUA pos.
--  Role lain hanya melihat pos yang dicentang di menu Kas -> tombol "Akses".
-- =====================================================================

create table if not exists public.akses_pos (
  user_id uuid not null references public.profiles(id) on delete cascade,
  pos_id  int  not null references public.pos_dana(id) on delete cascade,
  primary key (user_id, pos_id)
);
alter table public.akses_pos enable row level security;
drop policy if exists baca_akses_pos on public.akses_pos;
create policy baca_akses_pos on public.akses_pos for select to authenticated
  using (user_id = auth.uid() or public.has_role(array['admin','ketum']));
-- tulis hanya lewat fungsi set_akses_pos

create or replace function public.pos_penuh() returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_role(array['admin','ketum','bendahara']);
$$;

create or replace function public.boleh_pos(p_pos int) returns boolean
language sql stable security definer set search_path = public as $$
  select public.pos_penuh()
      or exists (select 1 from akses_pos a join profiles p on p.id = a.user_id
                 where a.user_id = auth.uid() and a.pos_id = p_pos and p.aktif);
$$;

create or replace function public.boleh_ambulans() returns boolean
language sql stable security definer set search_path = public as $$
  select public.pos_penuh()
      or exists (select 1 from akses_pos a join pos_dana d on d.id = a.pos_id
                 join profiles p on p.id = a.user_id
                 where a.user_id = auth.uid() and p.aktif and d.nama ilike '%ambulans%');
$$;

-- Admin/Ketum mengatur pos apa saja yang boleh dilihat satu pengurus
create or replace function public.set_akses_pos(p_user uuid, p_pos int[])
returns void language plpgsql security definer set search_path = public as $$
declare v_nama text;
begin
  if not has_role(array['admin','ketum']) then raise exception 'Hanya Admin / Ketum yang bisa mengatur akses pos'; end if;
  select nama into v_nama from profiles where id = p_user;
  if v_nama is null then raise exception 'Pengurus tidak ditemukan'; end if;
  delete from akses_pos where user_id = p_user;
  insert into akses_pos (user_id, pos_id)
    select p_user, x from unnest(coalesce(p_pos, '{}')) as x
    where exists (select 1 from pos_dana where id = x);
  perform _log('kas', null, 'atur akses pos', v_nama || ' -> ' || coalesce(array_length(p_pos,1),0) || ' pos');
end $$;

-- Saldo & rekap yang HANYA menghitung pos yang boleh dilihat user ini
create or replace function public.saldo_kas_saya() returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce(sum(case when jenis = 'masuk' then jumlah else -jumlah end), 0)
  from kas where is_member() and boleh_pos(pos_id);
$$;

create or replace function public.laporan_pos_saya(p_tgl date)
returns table (pos_id int, nama text, saldo_lalu numeric, masuk numeric, keluar numeric, total numeric)
language sql stable security definer set search_path = public as $$
  select p.id, p.nama,
    coalesce(sum(case when k.tanggal <= p_tgl - 7 then case when k.jenis = 'masuk' then k.jumlah else -k.jumlah end end), 0),
    coalesce(sum(case when k.tanggal > p_tgl - 7 and k.tanggal <= p_tgl and k.jenis = 'masuk' then k.jumlah end), 0),
    coalesce(sum(case when k.tanggal > p_tgl - 7 and k.tanggal <= p_tgl and k.jenis = 'keluar' then k.jumlah end), 0),
    coalesce(sum(case when k.tanggal <= p_tgl then case when k.jenis = 'masuk' then k.jumlah else -k.jumlah end end), 0)
  from pos_dana p left join kas k on k.pos_id = p.id
  where is_member() and boleh_pos(p.id)
    and (p.aktif or exists (select 1 from kas x where x.pos_id = p.id and x.tanggal <= p_tgl))
  group by p.id, p.nama, p.urutan
  order by p.urutan, p.id;
$$;

grant execute on function public.pos_penuh(), public.boleh_pos(int), public.boleh_ambulans(),
  public.set_akses_pos(uuid, int[]), public.saldo_kas_saya(), public.laporan_pos_saya(date) to authenticated;

-- ---------- Data awal ----------
-- Ketua Bidang & Petugas: tetap melihat semua pos seperti sekarang (bisa dikurangi lewat tombol Akses)
insert into public.akses_pos (user_id, pos_id)
  select p.id, d.id from profiles p cross join pos_dana d
  where p.role in ('ketua_bidang','petugas')
on conflict do nothing;
-- Sekretaris: hanya Bank BJB dan Qris Gopay
insert into public.akses_pos (user_id, pos_id)
  select p.id, d.id from profiles p join pos_dana d
    on (d.nama ilike '%bjb%' or d.nama ilike '%qris%' or d.nama ilike '%gopay%')
  where p.role = 'sekretaris'
on conflict do nothing;

-- ---------- Buku kas: baris hanya terlihat kalau pos-nya boleh ----------
drop policy if exists baca_kas on public.kas;
create policy baca_kas on public.kas for select to authenticated
  using (public.is_member() and public.boleh_pos(pos_id));

-- ---------- Ambulans: hanya yang punya akses pos Ambulans ----------
drop policy if exists baca_amb_trip  on public.ambulans_trip;
drop policy if exists baca_amb_tahap on public.ambulans_tahap;
create policy baca_amb_trip  on public.ambulans_trip  for select to authenticated using (public.is_member() and public.boleh_ambulans());
create policy baca_amb_tahap on public.ambulans_tahap for select to authenticated using (public.is_member() and public.boleh_ambulans());

do $$
declare r record;
begin
  if to_regclass('public.ambulans_toll') is not null then
    for r in select policyname from pg_policies
             where schemaname = 'public' and tablename = 'ambulans_toll' and cmd = 'SELECT' loop
      execute format('drop policy if exists %I on public.ambulans_toll', r.policyname);
    end loop;
    create policy baca_amb_toll on public.ambulans_toll for select to authenticated
      using (public.is_member() and public.boleh_ambulans());
  end if;
end $$;
