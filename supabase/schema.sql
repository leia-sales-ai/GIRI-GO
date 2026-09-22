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
