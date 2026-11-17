-- V48: account sanctions, revoked-session protection and administrator activity.
-- Apply after supabase_credit_auth_fix.sql. No existing member is sanctioned.
begin;
alter table public.nexus_profiles
  add column if not exists is_banned boolean not null default false,
  add column if not exists suspended_until timestamptz,
  add column if not exists moderation_reason text not null default '';

create table if not exists nexus_private.moderation_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null check (action in ('ban','suspend','restore')),
  reason text not null default '' check (char_length(reason)<=500),
  suspended_until timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists nexus_moderation_user_time on nexus_private.moderation_logs(user_id,created_at desc);
alter table nexus_private.moderation_logs enable row level security;
revoke all on nexus_private.moderation_logs from public,anon,authenticated;

-- JWTs remain signed after sign-out: check the real session on every protected operation.
create or replace function nexus_private.account_is_active(uid uuid)
returns boolean language sql stable security definer set search_path=''
as $$
  select uid is not null and exists (
    select 1 from public.nexus_profiles p join auth.users u on u.id=p.id
    where p.id=uid and not p.is_banned
      and (p.suspended_until is null or p.suspended_until<=now())
      and (u.banned_until is null or u.banned_until<=now())
      and exists(select 1 from auth.sessions s where s.user_id=uid
        and s.id=nullif(auth.jwt()->>'session_id','')::uuid)
  );
$$;
revoke all on function nexus_private.account_is_active(uuid) from public,anon,authenticated;

create or replace function public.nexus_account_is_active()
returns boolean language sql stable security definer set search_path=''
as $$ select nexus_private.account_is_active(auth.uid()); $$;
revoke all on function public.nexus_account_is_active() from public,anon;
grant execute on function public.nexus_account_is_active() to authenticated;

create or replace function public.nexus_is_admin()
returns boolean language sql stable security definer set search_path=''
as $$
 select nexus_private.account_is_active(auth.uid()) and exists(
   select 1 from public.nexus_profiles p where p.id=auth.uid() and p.is_admin);
$$;
revoke all on function public.nexus_is_admin() from public,anon;
grant execute on function public.nexus_is_admin() to authenticated;

create or replace function nexus_private.assert_active_account()
returns void language plpgsql security definer set search_path=''
as $$
declare p public.nexus_profiles;
begin
 if not nexus_private.account_is_active(auth.uid()) then
  select * into p from public.nexus_profiles where id=auth.uid();
  if p.is_banned then
   raise exception using errcode='42501',message='Ce compte est banni. Contacte un administrateur.';
  elsif p.suspended_until>now() then
   raise exception using errcode='42501',message='Ce compte est temporairement suspendu jusqu’au '||to_char(p.suspended_until at time zone 'Europe/Paris','DD/MM/YYYY HH24:MI')||' (heure de Paris).';
  end if;
  raise exception using errcode='42501',message='Session expirée ou révoquée. Reconnecte-toi.';
 end if;
end;
$$;
revoke all on function nexus_private.assert_active_account() from public,anon,authenticated;

create or replace function nexus_private.refresh_own_credits()
returns public.nexus_profiles language plpgsql security definer set search_path=''
as $$
declare
 uid uuid:=auth.uid(); p public.nexus_profiles;
 next_midnight timestamptz:=((date_trunc('day',now() at time zone 'Europe/Paris')+interval '1 day') at time zone 'Europe/Paris');
begin
 perform nexus_private.assert_active_account();
 select * into p from public.nexus_profiles where id=uid for update;
 -- Recheck after obtaining the row lock if a concurrent administrator sanctioned this user.
 if p.is_banned or p.suspended_until>now() then
   raise exception using errcode='42501',message='Ce compte est banni ou temporairement suspendu.';
 end if;
 if not p.is_admin and p.credits_reset_at<=now() then
  update public.nexus_profiles set credits=5,credits_reset_at=next_midnight where id=uid returning * into p;
 end if;
 return p;
end;
$$;
revoke all on function nexus_private.refresh_own_credits() from public,anon,authenticated;

create or replace function public.nexus_admin_moderate_user(p_user_id uuid,p_action text,p_duration_hours integer default null,p_reason text default '')
returns jsonb language plpgsql security definer set search_path=''
as $$
declare p public.nexus_profiles; until_at timestamptz; reason text:=trim(coalesce(p_reason,''));
begin
 if not public.nexus_is_admin() then raise exception using errcode='42501',message='Accès administrateur requis';end if;
 if p_action is null or p_action not in ('ban','suspend','restore') then raise exception 'Action invalide';end if;
 if char_length(reason)>500 then raise exception 'Motif trop long (500 caractères maximum)';end if;
 if p_action<>'restore' and reason='' then raise exception 'Un motif est obligatoire';end if;
 if p_action='suspend' and (p_duration_hours is null or p_duration_hours<1 or p_duration_hours>8760) then raise exception 'Durée invalide';end if;
 select * into p from public.nexus_profiles where id=p_user_id for update;
 if not found then raise exception 'Compte introuvable';end if;
 if p.is_admin or p.id=auth.uid() then raise exception 'Les comptes administrateurs sont protégés';end if;
 until_at:=case when p_action='suspend' then now()+make_interval(hours=>p_duration_hours) else null end;
 update public.nexus_profiles set is_banned=(p_action='ban'),suspended_until=until_at,
   moderation_reason=case when p_action='restore' then '' else reason end where id=p_user_id;
 update auth.users set banned_until=case when p_action='ban' then '9999-12-31 23:59:59+00'::timestamptz else until_at end where id=p_user_id;
 -- Revocation is atomic with the sanction. Restoring never revives the old sessions.
 delete from auth.sessions where user_id=p_user_id;
 insert into nexus_private.moderation_logs(user_id,actor_id,action,reason,suspended_until)
   values(p_user_id,auth.uid(),p_action,reason,until_at);
 return jsonb_build_object('user_id',p_user_id,'username',p.username,'action',p_action,'suspended_until',until_at);
end;
$$;
revoke all on function public.nexus_admin_moderate_user(uuid,text,integer,text) from public,anon;
grant execute on function public.nexus_admin_moderate_user(uuid,text,integer,text) to authenticated;

create or replace function public.nexus_admin_set_credits(p_user_id uuid,p_credits bigint)
returns table(user_id uuid,username text,credits bigint)
language plpgsql security definer set search_path=''
as $$
begin
 if not public.nexus_is_admin() then raise exception 'Accès administrateur requis';end if;
 if p_credits is null or p_credits<0 or p_credits>1000000000 then raise exception 'Nombre de crédits invalide';end if;
 return query update public.nexus_profiles p set credits=p_credits,
  credits_reset_at=case when p.credits_reset_at<=now() then
   ((date_trunc('day',now() at time zone 'Europe/Paris')+interval '1 day') at time zone 'Europe/Paris') else p.credits_reset_at end
 where p.id=p_user_id returning p.id,p.username,p.credits;
end;
$$;
revoke all on function public.nexus_admin_set_credits(uuid,bigint) from public,anon;
grant execute on function public.nexus_admin_set_credits(uuid,bigint) to authenticated;

drop function if exists public.nexus_finish_search(uuid,integer);
create or replace function public.nexus_finish_search(p_search_id uuid,p_result_count integer,p_result_preview jsonb default '[]'::jsonb)
returns boolean language plpgsql security definer set search_path=''
as $$
begin
 perform nexus_private.assert_active_account();
 if p_result_count is null or p_result_count<0 then raise exception 'Nombre de résultats invalide';end if;
 update public.nexus_search_logs set result_count=p_result_count where id=p_search_id and user_id=auth.uid();
 return found;
end;
$$;
revoke all on function public.nexus_finish_search(uuid,integer,jsonb) from public,anon;
grant execute on function public.nexus_finish_search(uuid,integer,jsonb) to authenticated;

-- One administrator-only endpoint, including moderation history and real empty states.
create or replace function public.nexus_admin_get_activity(p_user_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare result jsonb;
begin
 if not public.nexus_is_admin() then raise exception using errcode='42501',message='Accès administrateur requis';end if;
 if not exists(select 1 from public.nexus_profiles where id=p_user_id) then raise exception 'Compte introuvable';end if;
 select jsonb_build_object(
  'searches',coalesce((select jsonb_agg(to_jsonb(t)) from (select id,criteria,criteria_count,result_count,created_at from public.nexus_search_logs where user_id=p_user_id order by created_at desc limit 100)t),'[]'::jsonb),
  'videos',coalesce((select jsonb_agg(to_jsonb(t)) from (select id,category,status,title,description,created_at from public.nexus_videos where user_id=p_user_id order by created_at desc limit 100)t),'[]'::jsonb),
  'moderation',coalesce((select jsonb_agg(to_jsonb(t)) from (select l.action,l.reason,l.suspended_until,l.created_at,p.username as actor from nexus_private.moderation_logs l left join public.nexus_profiles p on p.id=l.actor_id where l.user_id=p_user_id order by l.created_at desc limit 100)t),'[]'::jsonb)
 ) into result;
 return result;
end;
$$;
revoke all on function public.nexus_admin_get_activity(uuid) from public,anon;
grant execute on function public.nexus_admin_get_activity(uuid) to authenticated;

-- Restrictive rules are ANDed with the existing ownership and administrator policies.
do $$ declare name text;begin
 foreach name in array array['nexus_profiles','nexus_search_logs','nexus_videos'] loop
  execute format('drop policy if exists nexus_active_account_required on public.%I',name);
  execute format('create policy nexus_active_account_required on public.%I as restrictive for all to authenticated using ((select public.nexus_account_is_active())) with check ((select public.nexus_account_is_active()))',name);
 end loop;
end $$;
drop policy if exists nexus_active_storage_required on storage.objects;
create policy nexus_active_storage_required on storage.objects as restrictive for all to authenticated
 using (bucket_id not in ('nexus-videos-private','nexus-videos-public') or (select public.nexus_account_is_active()))
 with check (bucket_id not in ('nexus-videos-private','nexus-videos-public') or (select public.nexus_account_is_active()));
revoke insert,update,delete on public.nexus_profiles from anon,authenticated;
notify pgrst,'reload schema';
commit;
