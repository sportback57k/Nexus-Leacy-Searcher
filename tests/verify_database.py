"""Isolated PostgreSQL integration checks; requires pgserver and psycopg2-binary.
Never connects to the hosted project and never sends email.
"""
import os, tempfile
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
os.environ['LC_ALL']='C'
os.environ['LANG']='C'
import pgserver, psycopg2
root=Path(__file__).resolve().parents[1]
server=pgserver.get_server(tempfile.mkdtemp(prefix='nexus-test-pg-'),cleanup_mode='delete')
uri=server.get_uri()
conn=psycopg2.connect(uri);conn.autocommit=True
c=conn.cursor()
c.execute('''
create role anon; create role authenticated;
create schema auth;
create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb default '{}', raw_app_meta_data jsonb default '{}', is_super_admin boolean default false);
create table auth.sessions(id uuid primary key default gen_random_uuid(), user_id uuid references auth.users on delete cascade);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema auth to authenticated, anon;
grant execute on function auth.uid() to authenticated, anon;
create table public.nexus_site_settings(id integer primary key);
insert into public.nexus_site_settings values (1);
''')
for name in ['supabase_schema.sql','supabase_search_fix.sql','supabase_credit_auth_fix.sql']:
 c.execute((root/name).read_text())
# Reapplying the non-destructive migration must be safe.
c.execute((root/'supabase_credit_auth_fix.sql').read_text())
admin='00000000-0000-0000-0000-000000000001'
member='00000000-0000-0000-0000-000000000002'
c.execute("insert into auth.users(id,email,raw_user_meta_data) values (%s,'admin@example.test','{\"username\":\"admin\"}'),(%s,'member@example.test','{\"username\":\"member\",\"is_admin\":true}')",(admin,member))
c.execute('update public.nexus_profiles set is_admin=true where id=%s',(admin,))
c.execute('select is_admin from nexus_profiles where id=%s',(member,));assert c.fetchone()[0] is False

def actor_query(uid,sql):
 with psycopg2.connect(uri) as db:
  with db.cursor() as cur:
   cur.execute("select set_config('request.jwt.claim.sub', %s, true)",(uid,))
   cur.execute('set local role authenticated')
   cur.execute(sql)
   return cur.fetchall() if cur.description else None

c.execute("update nexus_profiles set credits=0,credits_reset_at=now()-interval '1 second' where id=%s",(member,))
row=actor_query(member,'select credits,credits_reset_at>now() from nexus_get_credit_status()')[0]
assert row==(5,True),row
assert actor_query(member,'select credits from nexus_get_credit_status()')[0][0]==5
assert actor_query(member,"select credits,unlimited_credits from nexus_start_search('{\"nom_famille\":\"Demo\"}')")[0]==(4,False)
assert actor_query(member,'select credits from nexus_get_credit_status()')[0][0]==4
c.execute('update nexus_profiles set credits=3 where id=%s',(member,))
def debit(_):
 try:actor_query(member,"select * from nexus_start_search('{\"prenom\":\"Demo\"}')");return True
 except psycopg2.Error as e:
  assert 'Crédits insuffisants' in str(e),str(e)
  return False
with ThreadPoolExecutor(max_workers=8) as pool:
 assert sum(pool.map(debit,range(8)))==3
assert actor_query(member,'select credits from nexus_get_credit_status()')[0][0]==0
c.execute('select count(*) from nexus_search_logs');assert c.fetchone()[0]==4
assert actor_query(admin,"select credits,unlimited_credits from nexus_start_search('{\"prenom\":\"Demo\"}')")[0]==(5,True)
for uid,sql in [(member,'update nexus_profiles set is_admin=true'),('', 'select * from nexus_get_credit_status()')]:
 try:actor_query(uid,sql);raise AssertionError('Unauthorized operation allowed')
 except psycopg2.Error:pass
# An admin allocation survives the first visit of a previously inactive member.
c.execute("update nexus_profiles set credits_reset_at=now()-interval '1 hour' where id=%s",(member,))
actor_query(admin,"select * from nexus_admin_set_credits('"+member+"',17)")
assert actor_query(member,'select credits from nexus_get_credit_status()')[0][0]==17
try:actor_query(member,"select * from nexus_admin_set_credits('"+member+"',999)");raise AssertionError('Member changed credits')
except psycopg2.Error:pass
# Local midnights really span 23/25 hours at the Paris DST boundaries.
c.execute("""select extract(epoch from ('2026-03-30 00:00 Europe/Paris'::timestamptz-'2026-03-29 00:00 Europe/Paris'::timestamptz))/3600,
extract(epoch from ('2026-10-26 00:00 Europe/Paris'::timestamptz-'2026-10-25 00:00 Europe/Paris'::timestamptz))/3600""")
assert tuple(map(int,c.fetchone()))==(23,25)
# Duplicate names and malicious user metadata do not block OTP signup or grant admin.
c.execute("insert into auth.users(id,email,raw_user_meta_data) values (gen_random_uuid(),'duplicate@example.test','{\"username\":\"member\"}'),(gen_random_uuid(),'new@example.test','{}')")
c.execute('select count(distinct username) from nexus_profiles');assert c.fetchone()[0]==4
# Reset keeps both table admins and trusted app-metadata admins, then publishes notice.
c.execute("insert into auth.users(id,email,raw_app_meta_data) values (gen_random_uuid(),'protected@example.test','{\"role\":\"admin\"}')")
c.execute('insert into auth.sessions(user_id) select id from auth.users')
c.execute((root/'supabase_reset_members_once.sql').read_text())
c.execute('select count(*) from auth.users');assert c.fetchone()[0]==2
c.execute('select count(*) from auth.sessions');assert c.fetchone()[0]==2
c.execute('select accounts_reset_at is not null from nexus_site_settings');assert c.fetchone()[0]
# No identifiable admin: abort deletion and keep the users.
c.execute('update nexus_profiles set is_admin=false');c.execute("update auth.users set raw_app_meta_data='{}'")
try:c.execute((root/'supabase_reset_members_once.sql').read_text());raise AssertionError('Reset lacked admin guard')
except psycopg2.Error as e:assert 'Aucun administrateur' in str(e)
c.execute('rollback');c.execute('select count(*) from auth.users');assert c.fetchone()[0]==2
conn.close();server.cleanup()
print('PASS: daily reset, same-day balance, concurrent debits, admin preservation, permissions, DST, signup trigger, one-time reset and rollback guard')
