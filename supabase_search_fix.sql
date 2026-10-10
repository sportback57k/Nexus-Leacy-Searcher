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
