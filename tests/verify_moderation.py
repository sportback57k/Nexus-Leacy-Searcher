"""Real isolated PostgreSQL tests of account moderation and activity RPCs."""
import os,tempfile,json,uuid
from pathlib import Path
os.environ['LC_ALL']='C';os.environ['LANG']='C'
import pgserver,psycopg2
root=Path(__file__).resolve().parents[1]
server=pgserver.get_server(tempfile.mkdtemp(prefix='nexus-moderation-'),cleanup_mode='delete')
uri=server.get_uri();db=psycopg2.connect(uri);db.autocommit=True;c=db.cursor()
c.execute('''
create role anon;create role authenticated;
create schema auth;create schema storage;
create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',raw_app_meta_data jsonb default '{}',is_super_admin boolean default false,banned_until timestamptz);
create table auth.sessions(id uuid primary key,user_id uuid references auth.users on delete cascade);
create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb)$$;
create function auth.uid() returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid$$;
grant usage on schema auth,storage to authenticated,anon;
grant execute on function auth.uid(),auth.jwt() to authenticated,anon;
create table public.nexus_site_settings(id integer primary key);
insert into public.nexus_site_settings values (1);
create table public.nexus_videos(id uuid primary key default gen_random_uuid(),user_id uuid references auth.users on delete cascade,category text,status text,title text,description text,created_at timestamptz default now());
alter table public.nexus_videos enable row level security;
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text);
alter table storage.objects enable row level security;
grant select,insert on storage.objects to authenticated;
create policy storage_test_allow on storage.objects for all to authenticated using(true) with check(true);
''')
for name in ['supabase_schema.sql','supabase_search_fix.sql','supabase_credit_auth_fix.sql','supabase_account_moderation.sql']:
 c.execute((root/name).read_text())
c.execute((root/'supabase_account_moderation.sql').read_text())
c.execute('create policy profiles_test_admin on nexus_profiles for select to authenticated using(public.nexus_is_admin())')
admin,member,other=[str(uuid.uuid4()) for _ in range(3)]
for uid,name in [(admin,'admin'),(member,'member'),(other,'other')]:
 c.execute('insert into auth.users(id,email,raw_user_meta_data) values(%s,%s,%s)',(uid,name+'@example.test',json.dumps({'username':name})))
c.execute('update nexus_profiles set is_admin=true where id=%s',(admin,))
sessions={}
def new_session(uid):
 sid=str(uuid.uuid4());c.execute('insert into auth.sessions values(%s,%s)',(sid,uid));sessions[uid]=sid;return sid
for uid in [admin,member,other]:new_session(uid)
def actor(uid,sql,args=(),sid=None,role='authenticated'):
 with psycopg2.connect(uri) as conn:
  with conn.cursor() as cur:
   cur.execute("select set_config('request.jwt.claims',%s,true)",(json.dumps({'sub':uid,'session_id':sid or sessions.get(uid)}),))
   cur.execute('set local role '+role);cur.execute(sql,args)
   return cur.fetchall() if cur.description else None

def denied(uid,sql,args=(),sid=None,role='authenticated'):
 try:actor(uid,sql,args,sid,role)
 except psycopg2.Error:return
 raise AssertionError('Unauthorized operation succeeded: '+sql)

assert actor(member,'select credits from nexus_get_credit_status()')[0][0]==5
empty=actor(admin,'select nexus_admin_get_activity(%s)',(member,))[0][0]
assert empty=={'searches':[],'videos':[],'moderation':[]}
denied(member,'select nexus_admin_get_activity(%s)',(other,))
denied(member,"select nexus_admin_moderate_user(%s,'ban',null,'test')",(other,))
denied(None,'select nexus_admin_get_activity(%s)',(member,),role='anon')
log=actor(member,"select search_id from nexus_start_search('{\"prenom\":\"<script>test</script>\"}')")[0][0]
activity=actor(admin,'select nexus_admin_get_activity(%s)',(member,))[0][0]
assert activity['searches'][0]['criteria']['prenom']=='<script>test</script>'
old_sid=sessions[member];new_session(member);second_sid=sessions[member]
actor(admin,"select nexus_admin_moderate_user(%s,'suspend',24,'Temporary test')",(member,))
c.execute('select count(*) from auth.sessions where user_id=%s',(member,));assert c.fetchone()[0]==0
c.execute('select banned_until>now() from auth.users where id=%s',(member,));assert c.fetchone()[0]
for sid in [old_sid,second_sid]:
 denied(member,'select * from nexus_get_credit_status()',sid=sid)
 denied(member,"select * from nexus_start_search('{\"prenom\":\"Blocked\"}')",sid=sid)
 denied(member,'select nexus_finish_search(%s,1)',(log,),sid=sid)
 assert actor(member,'select id from nexus_profiles where id=%s',(member,),sid=sid)==[]
 denied(member,"insert into storage.objects(bucket_id) values('nexus-videos-public')",sid=sid)
# Clearing cookies / issuing another session does not remove a permanent or active sanction.
new_session(member)
denied(member,'select * from nexus_get_credit_status()')
actor(admin,"select nexus_admin_moderate_user(%s,'restore',null,'Lifted')",(member,))
denied(member,'select * from nexus_get_credit_status()')
new_session(member);assert actor(member,'select credits from nexus_get_credit_status()')[0][0]==4
actor(admin,"select nexus_admin_moderate_user(%s,'ban',null,'Permanent test')",(member,))
new_session(member);denied(member,'select * from nexus_get_credit_status()')
c.execute('select is_banned from nexus_profiles where id=%s',(member,));assert c.fetchone()[0]
actor(admin,"select nexus_admin_moderate_user(%s,'restore',null,'Lifted')",(member,))
new_session(member)
actor(admin,"select nexus_admin_moderate_user(%s,'suspend',1,'Expiry test')",(member,))
c.execute("update nexus_profiles set suspended_until=now()-interval '1 minute' where id=%s",(member,))
c.execute("update auth.users set banned_until=now()-interval '1 minute' where id=%s",(member,))
new_session(member);assert actor(member,'select credits from nexus_get_credit_status()')[0][0]==4
for hours in [None,0,-1,8761]:denied(admin,"select nexus_admin_moderate_user(%s,'suspend',%s,'test')",(member,hours))
denied(admin,"select nexus_admin_moderate_user(%s,'ban',null,'')",(member,))
denied(admin,"select nexus_admin_moderate_user(%s,'ban',null,'test')",(admin,))
# Even a once-valid admin JWT is denied after that session is removed.
admin_sid=sessions[admin];c.execute('delete from auth.sessions where id=%s',(admin_sid,))
denied(admin,'select nexus_admin_get_activity(%s)',(member,),sid=admin_sid)
denied(admin,'select * from nexus_admin_set_credits(%s,99)',(member,),sid=admin_sid)
new_session(admin)
activity=actor(admin,'select nexus_admin_get_activity(%s)',(member,))[0][0]
assert len(activity['moderation'])==5
assert activity['moderation'][0]['action']=='suspend'
assert all(row['actor']=='admin' for row in activity['moderation'])
assert actor(other,'select credits from nexus_get_credit_status()')[0][0]==5
c.execute('select count(*) from nexus_profiles where is_admin');assert c.fetchone()[0]==1
db.close();server.cleanup()
print('PASS: moderation authorization, permanent bans, temporary suspensions, automatic expiry, revoked and fabricated sessions, RLS/Storage denial, admin protection and activity history')
