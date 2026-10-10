-- NEXUS / Supabase
-- Run this in Supabase SQL Editor.
-- Email is stored by Supabase Auth. The username is stored in user metadata/profile.
-- You can enable or disable "Confirm email" in Authentication > Sign In / Providers > Email.
-- If confirmation is enabled, users verify their email before their first login.

create table if not exists public.nexus_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  is_admin boolean not null default false,
  credits bigint not null default 5,
  created_at timestamptz not null default now(),
  constraint nexus_username_format check (username ~ '^[A-Za-z0-9_.-]{3,32}$'),
  constraint nexus_credits_nonnegative check (credits >= 0)
);

alter table public.nexus_profiles enable row level security;

create policy "profiles_select_own"
on public.nexus_profiles for select
to authenticated
using (id = auth.uid());

create or replace function public.nexus_create_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  wanted_username text;
begin
  wanted_username := coalesce(new.raw_user_meta_data->>'username',
                              split_part(new.email, '@', 1));
  insert into public.nexus_profiles(id, username)
  values (new.id, wanted_username);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_nexus on auth.users;
create trigger on_auth_user_created_nexus
after insert on auth.users
for each row execute function public.nexus_create_profile();

-- Prevent normal users from changing their admin flag or credits through the API.
revoke update on public.nexus_profiles from authenticated;

-- Optional: if the table already contains profiles and you need to repair them,
-- do it from the Supabase dashboard using an owner/service-role context.
