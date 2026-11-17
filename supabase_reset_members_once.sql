-- ONE-TIME ACCOUNT DELETION. Run only after inspecting admins and exporting a backup.
-- Deletes Auth accounts and rows linked by ON DELETE CASCADE; administrators survive.
-- Storage objects owned by a user must first be handled through the Storage API.
-- A failure rolls back the deletion and the announcement together.
begin;
lock table auth.users in share row exclusive mode;
lock table public.nexus_profiles in share row exclusive mode;
create temporary table nexus_preserved_admins on commit drop as
  select u.id from auth.users u
  left join public.nexus_profiles p on p.id = u.id
  where coalesce(p.is_admin, false)
    or u.raw_app_meta_data->>'role' = 'admin'
    or u.raw_app_meta_data->>'is_admin' = 'true'
    or coalesce(u.is_super_admin, false)
    or coalesce(u.raw_app_meta_data->'roles', '[]'::jsonb) ? 'admin';
do $$ begin
  if not exists(select 1 from nexus_preserved_admins) then
    raise exception 'Aucun administrateur identifié : suppression annulée';
  end if;
  if exists(select 1 from public.nexus_site_settings where id = 1 and accounts_reset_at is not null) then
    raise exception 'Réinitialisation déjà effectuée : suppression annulée';
  end if;
end $$;
-- Revoke sessions before deleting accounts. Their signed JWTs can remain valid until expiry,
-- but protected profile-dependent RPCs cannot serve a removed profile.
delete from auth.sessions s where not exists(select 1 from nexus_preserved_admins a where a.id = s.user_id);
delete from auth.users u where not exists(select 1 from nexus_preserved_admins a where a.id = u.id);
update public.nexus_site_settings set accounts_reset_at = now() where id = 1;
do $$ begin
  if not exists(select 1 from public.nexus_site_settings where id = 1 and accounts_reset_at is not null) then
    raise exception 'Annonce non enregistrée : suppression annulée';
  end if;
end $$;
commit;
