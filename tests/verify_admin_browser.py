"""Admin browser checks with mocked Supabase; run a local http.server on port 8000."""
from playwright.sync_api import sync_playwright
MOCK=r'''
window.__activityMode='full';window.__moderationFailure=false;window.__lastModeration=null;
const user={id:'admin',email:'admin@example.test'};
const members=[{id:'admin',username:'Admin',is_admin:true,credits:5,created_at:'2026-11-01T10:00:00Z'},{id:'member',username:'Membre <test>',is_admin:false,credits:5,created_at:'2026-11-02T10:00:00Z',is_banned:false,suspended_until:null,moderation_reason:''}];
const client={auth:{onAuthStateChange(){},getUser:async()=>({data:{user}}),signOut:async()=>({error:null})},
from(name){let q={select(){return q},eq(){return q},order(){return q},in(){return q},limit(){return q},maybeSingle:async()=>({data:{accounts_reset_at:null},error:null}),then(resolve){return Promise.resolve({data:name==='nexus_profiles'?members:[],error:null}).then(resolve)}};return q},
rpc:async(name,args)=>{
 if(name==='nexus_get_credit_status')return {data:members[0],error:null};
 if(name==='nexus_admin_get_activity'){
  if(window.__activityMode==='error')return {error:{message:'Test indisponible'}};
  return {data:window.__activityMode==='empty'?{searches:[],videos:[],moderation:[]}:{searches:[{criteria:{prenom:'<img onerror=alert(1)>'},criteria_count:1,result_count:2,created_at:'2026-11-17T12:00:00Z'}],videos:[{category:'BAVUR',status:'approved',title:'Test vidéo',description:'Description',created_at:'2026-11-17T11:00:00Z'}],moderation:[{action:'restore',reason:'Test réactivation',actor:'Admin',created_at:'2026-11-17T13:00:00Z'}]},error:null};
 }
 if(name==='nexus_admin_moderate_user'){
  window.__lastModeration=args;
  if(window.__moderationFailure)return {error:{message:'Test refusé'}};
  members[1].is_banned=args.p_action==='ban';members[1].suspended_until=args.p_action==='suspend'?'2099-01-01T00:00:00Z':null;members[1].moderation_reason=args.p_reason;
  return {data:{action:args.p_action},error:null};
 }
 return {data:{maintenance_mode:false},error:null};
},channel(){let q={on(){return q},subscribe(){return q}};return q}};
window.supabase={createClient:()=>client};
'''
with sync_playwright() as p:
 browser=p.chromium.launch();page=browser.new_page(viewport={'width':1440,'height':1000});errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.route('https://cdn.jsdelivr.net/**',lambda r:r.fulfill(status=200,body=''))
 page.add_init_script(MOCK);page.goto('http://127.0.0.1:8000/admin/')
 page.wait_for_selector('#adminDashboard:not([hidden]) .user-row')
 assert page.locator('.user-row').count()==2
 assert page.get_by_role('button',name='Gérer l’accès').count()==1,'Admins must be protected in the UI'
 page.locator('.user-row').nth(1).get_by_role('button',name='Voir l’activité').click()
 page.wait_for_selector('.activity-item')
 assert page.locator('.activity-item').count()==3
 assert 'Réactivation' in page.locator('.activity-item').first.inner_text()
 assert '<img onerror=alert(1)>' in page.locator('#userLogs').inner_text()
 assert page.locator('#userLogs img').count()==0
 page.locator('#backToUsers').click()
 for mode,text in [('empty','Aucune activité'),('error','Test indisponible')]:
  page.evaluate('(m)=>window.__activityMode=m',mode)
  page.locator('.user-row').nth(1).get_by_role('button',name='Voir l’activité').click()
  page.wait_for_function('(text)=>document.querySelector("#userLogs").textContent.includes(text)',arg=text)
  page.locator('#backToUsers').click()
 page.get_by_role('button',name='Gérer l’accès').click()
 page.wait_for_selector('#moderationDialog[open]')
 page.locator('#moderationForm [name=duration]').select_option('168')
 page.locator('#moderationForm [name=reason]').fill('Test de suspension')
 page.locator('#moderationSubmit').click()
 page.wait_for_function('!document.querySelector("#moderationDialog").open')
 assert page.evaluate('window.__lastModeration.p_duration_hours')==168
 assert 'Suspendu' in page.locator('.user-row').nth(1).inner_text()
 page.get_by_role('button',name='Gérer l’accès').click()
 assert page.locator('#moderationForm [name=action]').input_value()=='restore'
 page.locator('#moderationSubmit').click()
 page.wait_for_function('!document.querySelector("#moderationDialog").open')
 page.get_by_role('button',name='Gérer l’accès').click()
 page.locator('#moderationForm [name=action]').select_option('ban')
 assert page.locator('#moderationDurationField').is_hidden()
 page.locator('#moderationForm [name=reason]').fill('Test de bannissement')
 page.evaluate('window.__moderationFailure=true');page.locator('#moderationSubmit').click()
 page.wait_for_function('document.querySelector("#moderationFeedback").textContent.includes("Test refusé")')
 assert page.locator('#moderationDialog').evaluate('(d)=>d.open')
 page.evaluate('window.__moderationFailure=false');page.locator('#moderationSubmit').click()
 page.wait_for_function('!document.querySelector("#moderationDialog").open')
 assert 'BANNI' in page.locator('.user-row').nth(1).inner_text()
 page.set_viewport_size({'width':390,'height':844})
 page.get_by_role('button',name='Gérer l’accès').click()
 assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
 page.screenshot(path='/tmp/nexus-moderation-mobile.png',full_page=True)
 assert not errors,errors
 browser.close()
print('PASS: administrator activity, sorting, safe text, empty/error states, suspension, ban, restore, retry, admin protection and mobile layout')
