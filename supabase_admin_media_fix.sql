-- NEXUS — journal des recherches avec pseudo + critères exacts
-- À exécuter UNE FOIS dans Supabase > SQL Editor.
-- Cette migration conserve les recherches existantes et ajoute :
--   * username : pseudo du compte
--   * criteria  : valeurs exactes des critères saisis (JSON)
-- La table reste protégée par RLS ; l'admin Supabase peut la consulter depuis le dashboard.

create table if not exists public.nexus_search_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  username text,
  criteria jsonb,
  criteria_count integer not null check (criteria_count > 0),
  result_count integer,
  created_at timestamptz not null default now()
);

alter table public.nexus_search_logs enable row level security;

alter table public.nexus_search_logs
  add column if not exists username text,
  add column if not exists criteria jsonb;

-- Les anciennes lignes restent valides ; les nouvelles contiennent les données complètes.
-- Remplit le pseudo pour les anciennes lignes quand possible.
update public.nexus_search_logs l
set username = p.username
from public.nexus_profiles p
where l.user_id = p.id
  and l.username is null;

-- Les utilisateurs ne peuvent voir que leurs propres journaux via l'application.
drop policy if exists "search_logs_select_own" on public.nexus_search_logs;
create policy "search_logs_select_own"
on public.nexus_search_logs for select
to authenticated
using (user_id = auth.uid());

-- Les écritures passent uniquement par les fonctions SECURITY DEFINER.
revoke insert, update, delete on public.nexus_search_logs from authenticated;

-- Supprime l'ancienne signature pour éviter les conflits RPC.
drop function if exists public.nexus_start_search(integer);

create or replace function public.nexus_start_search(p_criteria jsonb)
returns table(search_id uuid, credits bigint, unlimited_credits boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  profile public.nexus_profiles%rowtype;
  new_log_id uuid;
  criteria_count_value integer;
  criteria_username text;
begin
  if uid is null then
    raise exception 'Utilisateur non connecté';
  end if;

  if p_criteria is null or jsonb_typeof(p_criteria) <> 'object' then
    raise exception 'Critères de recherche invalides';
  end if;

  criteria_count_value := (select count(*)::integer from jsonb_object_keys(p_criteria));
  if criteria_count_value < 1 then
    raise exception 'Aucun critère de recherche';
  end if;

  select * into profile
  from public.nexus_profiles
  where id = uid
  for update;

  if not found then
    raise exception 'Profil du compte introuvable';
  end if;

  criteria_username := profile.username;

  if profile.is_admin then
    insert into public.nexus_search_logs(user_id, username, criteria, criteria_count)
    values (uid, criteria_username, p_criteria, criteria_count_value)
    returning id into new_log_id;

    return query select new_log_id, profile.credits, true;
    return;
  end if;

  if profile.credits < 1 then
    raise exception 'Crédits insuffisants';
  end if;

  update public.nexus_profiles as np
  set credits = np.credits - 1
  where np.id = uid
  returning np.credits into profile.credits;

  insert into public.nexus_search_logs(user_id, username, criteria, criteria_count)
  values (uid, criteria_username, p_criteria, criteria_count_value)
  returning id into new_log_id;

  return query select new_log_id, profile.credits, false;
end;
$$;

create or replace function public.nexus_finish_search(p_search_id uuid, p_result_count integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Utilisateur non connecté';
  end if;

  if p_result_count is null or p_result_count < 0 then
    raise exception 'Nombre de résultats invalide';
  end if;

  update public.nexus_search_logs
  set result_count = p_result_count
  where id = p_search_id
    and user_id = auth.uid();

  return found;
end;
$$;

revoke all on function public.nexus_start_search(jsonb) from public;
grant execute on function public.nexus_start_search(jsonb) to authenticated;

revoke all on function public.nexus_finish_search(uuid, integer) from public;
grant execute on function public.nexus_finish_search(uuid, integer) to authenticated;

-- Force PostgREST to refresh its schema cache so the new RPC is immediately visible.
notify pgrst, 'reload schema';
-- NEXUS — admin credits + BAVUR/BLOCUS moderation + featured videos
-- À exécuter dans Supabase > SQL Editor après les migrations précédentes.

-- Helper sécurisé : permet de vérifier le statut admin sans exposer toute la table.
create or replace function public.nexus_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_admin from public.nexus_profiles where id = auth.uid()), false);
$$;
revoke all on function public.nexus_is_admin() from public;
grant execute on function public.nexus_is_admin() to authenticated;

-- Les admins peuvent voir les profils pour alimenter le menu déroulant des pseudos.
drop policy if exists "profiles_select_admin" on public.nexus_profiles;
create policy "profiles_select_admin"
on public.nexus_profiles for select
to authenticated
using (id = auth.uid() or public.nexus_is_admin());

-- Fonction serveur pour modifier le solde d'un compte sans exposer une écriture générale.
create or replace function public.nexus_admin_set_credits(p_user_id uuid, p_credits bigint)
returns table(user_id uuid, username text, credits bigint)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.nexus_is_admin() then
    raise exception 'Accès administrateur requis';
  end if;
  if p_credits is null or p_credits < 0 or p_credits > 1000000000 then
    raise exception 'Nombre de crédits invalide';
  end if;

  return query
  update public.nexus_profiles as p
  set credits = p_credits
  where p.id = p_user_id
  returning p.id, p.username, p.credits;
end;
$$;
revoke all on function public.nexus_admin_set_credits(uuid, bigint) from public;
grant execute on function public.nexus_admin_set_credits(uuid, bigint) to authenticated;

-- Journal de recherche : les admins peuvent consulter les critères enregistrés.
drop policy if exists "search_logs_select_admin" on public.nexus_search_logs;
create policy "search_logs_select_admin"
on public.nexus_search_logs for select
to authenticated
using (user_id = auth.uid() or public.nexus_is_admin());

-- Vidéos.
create table if not exists public.nexus_videos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  username text not null,
  category text not null check (category in ('BAVUR','BLOCUS')),
  title text not null check (char_length(title) between 1 and 100),
  description text not null default '' check (char_length(description) <= 1000),
  storage_path text not null unique,
  public_path text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  size_bytes bigint,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  rejection_reason text
);

alter table public.nexus_videos enable row level security;

create index if not exists nexus_videos_category_status_idx on public.nexus_videos(category, status, created_at desc);
create index if not exists nexus_videos_user_idx on public.nexus_videos(user_id, created_at desc);

-- Lecture publique uniquement des vidéos approuvées. Le contenu vidéo lui-même est servi par le bucket public après approbation.
drop policy if exists "videos_public_approved" on public.nexus_videos;
create policy "videos_public_approved"
on public.nexus_videos for select
to anon, authenticated
using (status = 'approved');

-- Un utilisateur connecté peut voir ses propres vidéos, y compris en attente/refusées.
drop policy if exists "videos_select_own" on public.nexus_videos;
create policy "videos_select_own"
on public.nexus_videos for select
to authenticated
using (user_id = auth.uid() or public.nexus_is_admin());

-- Création : uniquement pour son propre compte et avec un chemin qui commence par son UUID.
drop policy if exists "videos_insert_own" on public.nexus_videos;
create policy "videos_insert_own"
on public.nexus_videos for insert
to authenticated
with check (
  user_id = auth.uid()
  and status = 'pending'
  and storage_path like (auth.uid()::text || '/%')
);

-- Seul l'admin peut modérer.
drop policy if exists "videos_update_admin" on public.nexus_videos;
create policy "videos_update_admin"
on public.nexus_videos for update
to authenticated
using (public.nexus_is_admin())
with check (public.nexus_is_admin());

drop policy if exists "videos_delete_admin" on public.nexus_videos;
create policy "videos_delete_admin"
on public.nexus_videos for delete
to authenticated
using (public.nexus_is_admin());

-- Buckets : privé pour les vidéos en attente, public pour les vidéos approuvées.
insert into storage.buckets (id, name, public)
values ('nexus-videos-private', 'nexus-videos-private', false)
on conflict (id) do update set public = false;

insert into storage.buckets (id, name, public)
values ('nexus-videos-public', 'nexus-videos-public', true)
on conflict (id) do update set public = true;

-- Upload privé par l'utilisateur dans son propre dossier.
drop policy if exists "nexus_private_upload_own" on storage.objects;
create policy "nexus_private_upload_own"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'nexus-videos-private'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Lecture des vidéos privées par leur propriétaire ou par un admin.
drop policy if exists "nexus_private_read_own_or_admin" on storage.objects;
create policy "nexus_private_read_own_or_admin"
on storage.objects for select
to authenticated
using (
  bucket_id = 'nexus-videos-private'
  and ((storage.foldername(name))[1] = auth.uid()::text or public.nexus_is_admin())
);

-- L'admin peut supprimer une vidéo privée refusée.
drop policy if exists "nexus_private_delete_admin" on storage.objects;
create policy "nexus_private_delete_admin"
on storage.objects for delete
to authenticated
using (bucket_id = 'nexus-videos-private' and public.nexus_is_admin());

-- Les utilisateurs connectés peuvent déposer leur vidéo dans leur propre dossier.
drop policy if exists "nexus_public_upload_own" on storage.objects;
create policy "nexus_public_upload_own"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'nexus-videos-public'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Seul l'admin peut créer/supprimer dans le bucket public (hors dépôt personnel ci-dessus).
drop policy if exists "nexus_public_insert_admin" on storage.objects;
create policy "nexus_public_insert_admin"
on storage.objects for insert
to authenticated
with check (bucket_id = 'nexus-videos-public' and public.nexus_is_admin());

drop policy if exists "nexus_public_delete_admin" on storage.objects;
create policy "nexus_public_delete_admin"
on storage.objects for delete
to authenticated
using (bucket_id = 'nexus-videos-public' and public.nexus_is_admin());

-- Lecture publique du bucket public.
drop policy if exists "nexus_public_read" on storage.objects;
create policy "nexus_public_read"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'nexus-videos-public');

-- ============================================================
-- MODE MAINTENANCE DU SITE
-- ============================================================
create table if not exists public.nexus_site_settings (
  id integer primary key check (id = 1),
  maintenance_mode boolean not null default false,
  maintenance_reason text not null default 'Maintenance en cours. Revenez plus tard.',
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

insert into public.nexus_site_settings (id)
values (1)
on conflict (id) do nothing;

alter table public.nexus_site_settings enable row level security;

drop policy if exists "nexus_settings_read_public" on public.nexus_site_settings;
create policy "nexus_settings_read_public"
on public.nexus_site_settings for select
to anon, authenticated
using (id = 1);

revoke insert, update, delete on public.nexus_site_settings from anon, authenticated;

drop function if exists public.nexus_get_site_status();
create or replace function public.nexus_get_site_status()
returns table(maintenance_mode boolean, maintenance_reason text)
language sql
security definer
set search_path = public
stable
as $$
  select maintenance_mode, maintenance_reason
  from public.nexus_site_settings
  where id = 1;
$$;

grant execute on function public.nexus_get_site_status() to anon, authenticated;

drop function if exists public.nexus_set_maintenance(boolean, text);
create or replace function public.nexus_set_maintenance(p_enabled boolean, p_reason text)
returns table(maintenance_mode boolean, maintenance_reason text)
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cleaned_reason text := nullif(trim(coalesce(p_reason, '')), '');
begin
  if uid is null or not public.nexus_is_admin() then
    raise exception 'Accès administrateur requis';
  end if;

  if p_enabled and cleaned_reason is null then
    raise exception 'Une raison est obligatoire pour fermer le site';
  end if;

  update public.nexus_site_settings
  set maintenance_mode = coalesce(p_enabled, false),
      maintenance_reason = case
        when p_enabled then cleaned_reason
        else 'Maintenance terminée. Le site est de nouveau disponible.'
      end,
      updated_at = now(),
      updated_by = uid
  where id = 1;

  return query
  select s.maintenance_mode, s.maintenance_reason
  from public.nexus_site_settings s
  where s.id = 1;
end;
$$;

grant execute on function public.nexus_set_maintenance(boolean, text) to authenticated;

select pg_notify('pgrst', 'reload schema');
