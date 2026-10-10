-- NEXUS — thème global administrateur
-- À exécuter dans Supabase SQL Editor.

alter table public.nexus_site_settings
  add column if not exists theme_name text not null default 'Rouge',
  add column if not exists theme_color text not null default '#ff3038';

update public.nexus_site_settings
set theme_name = coalesce(nullif(theme_name,''),'Rouge'),
    theme_color = case
      when theme_color ~ '^#[0-9A-Fa-f]{6}$' then lower(theme_color)
      else '#ff3038'
    end
where id=1;

-- Lecture publique du thème global.
drop function if exists public.nexus_get_site_theme();
create or replace function public.nexus_get_site_theme()
returns table(theme_name text, theme_color text)
language sql
security definer
set search_path = public
stable
as $$
  select theme_name, theme_color
  from public.nexus_site_settings
  where id=1;
$$;

grant execute on function public.nexus_get_site_theme() to anon, authenticated;

-- Seul un admin peut modifier le thème.
drop function if exists public.nexus_set_site_theme(text,text);
create or replace function public.nexus_set_site_theme(p_name text, p_color text)
returns table(theme_name text, theme_color text)
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cleaned_color text := lower(trim(coalesce(p_color,'')));
  cleaned_name text := nullif(trim(coalesce(p_name,'')), '');
begin
  if uid is null or not public.nexus_is_admin() then
    raise exception 'Accès administrateur requis';
  end if;

  if cleaned_color !~ '^#[0-9a-f]{6}$' then
    raise exception 'Couleur invalide';
  end if;

  update public.nexus_site_settings
  set theme_name = coalesce(cleaned_name,'Personnalisé'),
      theme_color = cleaned_color,
      updated_at = now(),
      updated_by = uid
  where id=1;

  return query
  select s.theme_name, s.theme_color
  from public.nexus_site_settings s
  where s.id=1;
end;
$$;

grant execute on function public.nexus_set_site_theme(text,text) to authenticated;

select pg_notify('pgrst','reload schema');
