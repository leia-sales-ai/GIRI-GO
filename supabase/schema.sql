-- ============================================================
-- GIRI Go — Supabase Schema  (einmal im SQL Editor ausführen)
-- ============================================================

-- ---------- Profile (1 Zeile pro User, Workspace = E-Mail-Domain) ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text not null default '',
  role text not null default 'creator' check (role in ('creator','reviewer','viewer')),
  ws text not null,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, name, role, ws)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1)),
    'creator',
    lower(split_part(new.email,'@',2))
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Hilfsfunktion: Workspace des eingeloggten Users
create or replace function public.my_ws() returns text
language sql stable security definer set search_path = public as $$
  select ws from public.profiles where id = auth.uid()
$$;

create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

-- ---------- Anleitungen ----------
create table if not exists public.instructions (
  id text primary key,
  ws text not null,
  status text not null default 'draft' check (status in ('draft','review','published')),
  title text not null default '',
  updated_at timestamptz not null default now(),
  data jsonb not null
);
create index if not exists instructions_ws_idx on public.instructions (ws, updated_at desc);

-- ---------- Checklisten-Durchführungen ----------
create table if not exists public.runs (
  id text primary key,
  instr_id text not null references public.instructions(id) on delete cascade,
  ws text not null,
  worker text not null default '',
  version int not null default 0,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  items jsonb not null default '{}'::jsonb
);
create index if not exists runs_instr_idx on public.runs (instr_id, started_at desc);

-- ---------- Row Level Security ----------
alter table public.profiles enable row level security;
alter table public.instructions enable row level security;
alter table public.runs enable row level security;

-- Profile: Kollegen im Workspace sehen sich gegenseitig, jeder ändert nur sich selbst
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated using (ws = public.my_ws());
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Anleitungen: veröffentlichte sind öffentlich lesbar (Link/QR ohne Login), sonst nur Workspace
drop policy if exists instr_select_public on public.instructions;
create policy instr_select_public on public.instructions for select to anon, authenticated using (status = 'published');
drop policy if exists instr_select_ws on public.instructions;
create policy instr_select_ws on public.instructions for select to authenticated using (ws = public.my_ws());
drop policy if exists instr_write on public.instructions;
create policy instr_write on public.instructions for insert to authenticated with check (ws = public.my_ws() and public.my_role() in ('creator','reviewer'));
drop policy if exists instr_update on public.instructions;
create policy instr_update on public.instructions for update to authenticated using (ws = public.my_ws() and public.my_role() in ('creator','reviewer')) with check (ws = public.my_ws());
drop policy if exists instr_delete on public.instructions;
create policy instr_delete on public.instructions for delete to authenticated using (ws = public.my_ws() and public.my_role() in ('creator','reviewer'));

-- Durchführungen: Werker (ohne Login) darf für veröffentlichte Anleitungen eintragen, Workspace liest
drop policy if exists runs_insert on public.runs;
create policy runs_insert on public.runs for insert to anon, authenticated
  with check (exists (select 1 from public.instructions i where i.id = runs.instr_id and i.status = 'published' and i.ws = runs.ws));
drop policy if exists runs_select on public.runs;
create policy runs_select on public.runs for select to authenticated using (ws = public.my_ws());

-- ---------- Storage: Bucket "media" (öffentlich lesbar, Upload nur eigener Workspace) ----------
insert into storage.buckets (id, name, public, file_size_limit)
values ('media', 'media', true, 104857600)
on conflict (id) do update set public = true, file_size_limit = 104857600;

drop policy if exists media_read on storage.objects;
create policy media_read on storage.objects for select to anon, authenticated using (bucket_id = 'media');

drop policy if exists media_upload_ws on storage.objects;
create policy media_upload_ws on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = public.my_ws());

-- Beweisfotos aus der Checkliste (Werker ohne Login) landen unter runs/…
drop policy if exists media_upload_runs on storage.objects;
create policy media_upload_runs on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = 'runs');

drop policy if exists media_update_ws on storage.objects;
create policy media_update_ws on storage.objects for update to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = public.my_ws());
drop policy if exists media_delete_ws on storage.objects;
create policy media_delete_ws on storage.objects for delete to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = public.my_ws());

-- ---------- Realtime (Sync zwischen Handy und PC) ----------
do $$ begin
  alter publication supabase_realtime add table public.instructions;
exception when duplicate_object then null; end $$;

-- ---------- Branding pro Workspace (Viewer + PDF) ----------
create table if not exists public.workspaces (
  ws text primary key,
  brand jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.workspaces enable row level security;
drop policy if exists ws_select on public.workspaces;
create policy ws_select on public.workspaces for select to anon, authenticated using (true);
drop policy if exists ws_insert on public.workspaces;
create policy ws_insert on public.workspaces for insert to authenticated with check (ws = public.my_ws() and public.my_role() in ('creator','reviewer'));
drop policy if exists ws_update on public.workspaces;
create policy ws_update on public.workspaces for update to authenticated using (ws = public.my_ws() and public.my_role() in ('creator','reviewer')) with check (ws = public.my_ws());

-- ---------- Aufrufe / Statistik ----------
create table if not exists public.views (
  id text primary key,
  instr_id text not null references public.instructions(id) on delete cascade,
  ws text not null,
  version int not null default 0,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_s int not null default 0,
  steps_seen int not null default 0,
  steps_total int not null default 0,
  completed boolean not null default false,
  reload boolean not null default false,
  device text
);
create index if not exists views_instr_idx on public.views (instr_id, started_at desc);
create index if not exists views_ws_idx on public.views (ws);
alter table public.views enable row level security;
drop policy if exists views_insert on public.views;
create policy views_insert on public.views for insert to anon, authenticated
  with check (exists (select 1 from public.instructions i where i.id = views.instr_id and i.status = 'published' and i.ws = views.ws));
drop policy if exists views_update on public.views;
create policy views_update on public.views for update to anon, authenticated
  using (started_at > now() - interval '1 day') with check (started_at > now() - interval '1 day');
drop policy if exists views_select on public.views;
create policy views_select on public.views for select to authenticated using (ws = public.my_ws());
create or replace view public.instr_stats with (security_invoker = true) as
  select instr_id, ws, count(*)::int as views, count(*) filter (where reload)::int as reloads,
    coalesce(avg(duration_s) filter (where duration_s > 0), 0)::int as avg_duration_s,
    count(*) filter (where completed)::int as completed,
    coalesce(avg(steps_seen) filter (where steps_total > 0), 0)::numeric(6,1) as avg_steps_seen,
    max(started_at) as last_view
  from public.views group by instr_id, ws;
grant select on public.instr_stats to authenticated;

-- ---------- Projekte (Ordner), Teams, Einladungen, Admin ----------
-- workspaces.folders: [{id, name, teams:[teamId]}]   workspaces.teams: [{id, name, members:[{email, role}]}]
-- workspaces.invites: [{email, role, at}]            profiles.is_admin: erster Benutzer eines Workspace
alter table public.workspaces add column if not exists folders jsonb not null default '[]'::jsonb;
alter table public.workspaces add column if not exists teams jsonb not null default '[]'::jsonb;
alter table public.workspaces add column if not exists invites jsonb not null default '[]'::jsonb;
alter table public.profiles add column if not exists is_admin boolean not null default false;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_ws text; v_cnt int; v_role text;
begin
  v_ws := lower(split_part(new.email,'@',2));
  select count(*) into v_cnt from public.profiles where ws = v_ws;
  select i->>'role' into v_role
    from public.workspaces w, jsonb_array_elements(coalesce(w.invites,'[]'::jsonb)) i
    where w.ws = v_ws and lower(i->>'email') = lower(new.email) limit 1;
  if v_role is null or v_role not in ('creator','reviewer','viewer') then v_role := 'creator'; end if;
  insert into public.profiles (id, email, name, role, ws, is_admin)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1)), v_role, v_ws, (v_cnt = 0))
  on conflict (id) do nothing;
  update public.workspaces set invites = coalesce((select jsonb_agg(i) from jsonb_array_elements(invites) i where lower(i->>'email') <> lower(new.email)), '[]'::jsonb) where ws = v_ws;
  return new;
end $$;

update public.profiles p set is_admin = true
  where not exists (select 1 from public.profiles q where q.ws = p.ws and q.is_admin)
    and p.id = (select id from public.profiles q where q.ws = p.ws order by created_at limit 1);

create or replace function public.my_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false)
$$;

drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_admin on public.profiles for update to authenticated
  using (ws = public.my_ws() and public.my_admin()) with check (ws = public.my_ws());
drop policy if exists profiles_delete_admin on public.profiles;
create policy profiles_delete_admin on public.profiles for delete to authenticated
  using (ws = public.my_ws() and public.my_admin() and id <> auth.uid());

-- Rolle/Admin-Flag darf nur ein Admin ändern
create or replace function public.profiles_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (new.role is distinct from old.role or new.is_admin is distinct from old.is_admin) then
    if auth.uid() is not null and not public.my_admin() then
      raise exception 'only admins can change roles';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists profiles_guard_trg on public.profiles;
create trigger profiles_guard_trg before update on public.profiles for each row execute procedure public.profiles_guard();

-- Öffentliche Links (anon) lesen vom Workspace nur das Branding – Teams/Einladungen (E-Mails) bleiben intern
revoke select on public.workspaces from anon;
grant select (ws, brand, updated_at) on public.workspaces to anon;

-- Workspace-Zeile (Projekte/Teams/Einladungen): Creator, Prüfer und Admins
drop policy if exists ws_insert on public.workspaces;
create policy ws_insert on public.workspaces for insert to authenticated with check (ws = public.my_ws() and (public.my_role() in ('creator','reviewer') or public.my_admin()));
drop policy if exists ws_update on public.workspaces;
create policy ws_update on public.workspaces for update to authenticated using (ws = public.my_ws() and (public.my_role() in ('creator','reviewer') or public.my_admin())) with check (ws = public.my_ws());

-- ---------- UI-Übersetzungen (Cache pro Quelltext + Zielsprache, nur Edge Function / service role) ----------
create table if not exists public.ui_tx (
  h text not null, target text not null, src text not null, txt text not null,
  created_at timestamptz not null default now(), primary key (h, target)
);
create index if not exists ui_tx_created_idx on public.ui_tx (created_at);
alter table public.ui_tx enable row level security;
revoke all on public.ui_tx from anon, authenticated;

-- ---------- v0.10: Rollen (admin = Super Admin), laufende Checklisten ----------
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('admin','creator','reviewer','viewer'));
create or replace function public.my_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin or role = 'admin' from public.profiles where id = auth.uid()), false)
$$;
drop policy if exists instr_write on public.instructions;
create policy instr_write on public.instructions for insert to authenticated with check (ws = public.my_ws() and public.my_role() in ('admin','creator','reviewer'));
drop policy if exists instr_update on public.instructions;
create policy instr_update on public.instructions for update to authenticated using (ws = public.my_ws() and public.my_role() in ('admin','creator','reviewer')) with check (ws = public.my_ws());
drop policy if exists instr_delete on public.instructions;
create policy instr_delete on public.instructions for delete to authenticated using (ws = public.my_ws() and public.my_role() in ('admin','creator','reviewer'));
drop policy if exists ws_insert on public.workspaces;
create policy ws_insert on public.workspaces for insert to authenticated with check (ws = public.my_ws() and (public.my_role() in ('admin','creator','reviewer') or public.my_admin()));
drop policy if exists ws_update on public.workspaces;
create policy ws_update on public.workspaces for update to authenticated using (ws = public.my_ws() and (public.my_role() in ('admin','creator','reviewer') or public.my_admin())) with check (ws = public.my_ws());
-- Werker darf seine laufende Durchführung fortschreiben (Job-Done-Protokoll zeigt „läuft“), bis sie abgeschlossen ist
drop policy if exists runs_update on public.runs;
create policy runs_update on public.runs for update to anon, authenticated
  using (finished_at is null and started_at > now() - interval '2 days') with check (started_at > now() - interval '2 days');

-- v0.13: eigene Symbole je Workspace – workspaces.symbols: [{id, name, url, path, ar, alpha, at}] (Bilder in media/<ws>/symbols/<id>.png)
alter table public.workspaces add column if not exists symbols jsonb not null default '[]'::jsonb;
