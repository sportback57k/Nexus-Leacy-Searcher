-- Apply after supabase_admin_media_fix.sql. Does not delete accounts.
begin;
create schema if not exists nexus_private;
revoke all on schema nexus_private from public, anon, authenticated;

alter table public.nexus_profiles add column if not exists credits_reset_at timestamptz
  not null default ((date_trunc('day', now() at time zone 'Europe/Paris') + interval '1 day') at time zone 'Europe/Paris');
alter table public.nexus_site_settings add column if not exists accounts_reset_at timestamptz;
alter table public.nexus_profiles alter column credits_reset_at set default
  ((date_trunc('day', now() at time zone 'Europe/Paris') + interval '1 day') at time zone 'Europe/Paris');

-- A locked row makes reset and debit atomic, including concurrent searches.
-- Definer privileges are necessary: clients cannot write credits or admin flags.
create or replace function nexus_private.refresh_own_credits()
returns public.nexus_profiles
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  profile public.nexus_profiles;
  next_midnight timestamptz := ((date_trunc('day', now() at time zone 'Europe/Paris') + interval '1 day') at time zone 'Europe/Paris');
begin
  if uid is null then raise exception 'Utilisateur non connecté'; end if;
  select * into profile from public.nexus_profiles where id = uid for update;
  if not found then raise exception 'Profil du compte introuvable'; end if;
  if not profile.is_admin and profile.credits_reset_at <= now() then
    update public.nexus_profiles set credits = 5, credits_reset_at = next_midnight
    where id = uid returning * into profile;
  end if;
  return profile;
end;
$$;
revoke all on function nexus_private.refresh_own_credits() from public, anon, authenticated;

-- Stable client contract; the public entry points check the authenticated user.
drop function if exists public.nexus_get_credit_status();
create function public.nexus_get_credit_status()
returns table(id uuid, username text, is_admin boolean, credits bigint, created_at timestamptz, credits_reset_at timestamptz)
language plpgsql security definer set search_path = ''
as $$
declare profile public.nexus_profiles;
begin
  if auth.uid() is null then raise exception 'Utilisateur non connecté'; end if;
  profile := nexus_private.refresh_own_credits();
  return query select profile.id, profile.username, profile.is_admin, profile.credits, profile.created_at,
    case when profile.is_admin then null::timestamptz else profile.credits_reset_at end;
end;
$$;
revoke all on function public.nexus_get_credit_status() from public, anon;
grant execute on function public.nexus_get_credit_status() to authenticated;

drop function if exists public.nexus_start_search(jsonb);
create function public.nexus_start_search(p_criteria jsonb)
returns table(search_id uuid, credits bigint, unlimited_credits boolean, next_reset_at timestamptz)
language plpgsql security definer set search_path = ''
as $$
declare
  profile public.nexus_profiles;
  new_log_id uuid;
  criteria_count_value integer;
begin
  if auth.uid() is null then raise exception 'Utilisateur non connecté'; end if;
  if p_criteria is null or jsonb_typeof(p_criteria) <> 'object' then
    raise exception 'Critères de recherche invalides';
  end if;
  criteria_count_value := (select count(*)::integer from jsonb_object_keys(p_criteria));
  if criteria_count_value < 1 then raise exception 'Aucun critère de recherche'; end if;
  profile := nexus_private.refresh_own_credits();
  if not profile.is_admin then
    if profile.credits < 1 then raise exception 'Crédits insuffisants'; end if;
    update public.nexus_profiles as p set credits = p.credits - 1
      where p.id = profile.id returning p.credits into profile.credits;
  end if;
  insert into public.nexus_search_logs(user_id, username, criteria, criteria_count)
    values (profile.id, profile.username, p_criteria, criteria_count_value)
    returning id into new_log_id;
  return query select new_log_id, profile.credits, profile.is_admin,
    case when profile.is_admin then null::timestamptz else profile.credits_reset_at end;
end;
$$;
revoke all on function public.nexus_start_search(jsonb) from public, anon;
grant execute on function public.nexus_start_search(jsonb) to authenticated;

-- Metadata is used only for display names; admin authority stays in the protected table.
create or replace function public.nexus_create_profile()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  wanted_username text := trim(coalesce(new.raw_user_meta_data->>'username', ''));
begin
  if wanted_username !~ '^[A-Za-z0-9_.-]{3,32}$' then
    wanted_username := 'membre_' || replace(new.id::text, '-', '');
    wanted_username := left(wanted_username, 32);
  end if;
  -- Serialize equal names so simultaneous registrations also resolve collisions.
  perform pg_advisory_xact_lock(hashtextextended(lower(wanted_username), 0));
  if exists(select 1 from public.nexus_profiles p where lower(p.username) = lower(wanted_username)) then
    wanted_username := left(wanted_username, 19) || '_' || left(replace(new.id::text, '-', ''), 12);
  end if;
  insert into public.nexus_profiles(id, username, is_admin, credits)
    values (new.id, wanted_username, false, 5);
  return new;
end;
$$;
revoke all on function public.nexus_create_profile() from public, anon, authenticated;
revoke insert, update, delete on public.nexus_profiles from anon, authenticated;
grant select on public.nexus_profiles to authenticated;
grant select on public.nexus_site_settings to anon, authenticated;
-- Admin grants remain usable for the current day, even on a previously inactive account.
create or replace function public.nexus_admin_set_credits(p_user_id uuid, p_credits bigint)
returns table(user_id uuid, username text, credits bigint)
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null or not exists(select 1 from public.nexus_profiles p where p.id=auth.uid() and p.is_admin) then
    raise exception 'Accès administrateur requis';
  end if;
  if p_credits is null or p_credits < 0 or p_credits > 1000000000 then
    raise exception 'Nombre de crédits invalide';
  end if;
  return query update public.nexus_profiles p set credits=p_credits,
    credits_reset_at=case when p.credits_reset_at<=now() then
      ((date_trunc('day', now() at time zone 'Europe/Paris') + interval '1 day') at time zone 'Europe/Paris')
      else p.credits_reset_at end
    where p.id=p_user_id returning p.id,p.username,p.credits;
end;
$$;

-- Old project functions may have explicit anon grants. Remove these from all
-- account operations; triggers do not need client execution privileges.
do $$ declare f record; begin
  for f in select p.oid::regprocedure signature, p.proname, p.prorettype
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in (
      'nexus_get_site_status','nexus_get_site_theme','nexus_admin_set_credits',
      'nexus_finish_search','nexus_get_credit_status','nexus_start_search',
      'nexus_is_admin','nexus_set_maintenance','nexus_set_site_theme',
      'nexus_create_profile','nexus_keep_latest_search')
  loop
    execute format('revoke all on function %s from public, anon',f.signature);
    if f.proname in ('nexus_get_site_status','nexus_get_site_theme') then
      execute format('alter function %s security invoker',f.signature);
      execute format('grant execute on function %s to anon, authenticated',f.signature);
    elsif f.prorettype='trigger'::regtype then
      execute format('revoke all on function %s from authenticated',f.signature);
    else
      execute format('grant execute on function %s to authenticated',f.signature);
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';
commit;
