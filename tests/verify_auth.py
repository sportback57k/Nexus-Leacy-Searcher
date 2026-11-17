"""Offline tests of the real OTP and profile adapter code. No emails are sent."""
from verify import evaluate, root
app=(root/'js/app.js').read_text()
functions=app[app.index('async function getProfileForUser'):app.index('\nasync function api(')]
evaluate(r'''
let authCalls=[],otpError=null,verifyError=null,creditResponse={id:'u1',username:'demo',credits:'5',is_admin:false,next_reset_at:'2026-11-18T23:00:00Z'};
let directReads=0;
const authClient={auth:{
 signInWithOtp:async args=>{authCalls.push(['send',args]);return {error:otpError}},
 verifyOtp:async args=>{authCalls.push(['verify',args]);return {error:verifyError,data:{user:{id:'u1'},session:{}}}},
 signOut:async()=>({error:null}),getUser:async()=>({data:{user:{id:'u1'}},error:null})
},rpc:async()=>({data:creditResponse,error:null}),from:()=>{directReads++;throw Error('Unexpected fallback')}};
function supabaseReady(){return authClient}
'''+functions+r'''
window.authTestStatus='running';
(async()=>{
 const signup=await authRequest('/api/register',{email:' TEST@Example.com ',username:'demo'});
 assert(signup.email==='test@example.com'&&signup.signup,'Normalized email and signup state');
 assert(authCalls[0][1].options.shouldCreateUser===true&&authCalls[0][1].options.data.username==='demo','Signup sends username and allows account creation');
 assert(!signup.user,'Sending a code never authenticates the user');
 await authRequest('/api/login',{email:'test@example.com'});
 assert(authCalls[1][1].options.shouldCreateUser===false&&!authCalls[1][1].options.data,'Login never creates an account');
 for(const args of [{email:'invalid',username:'demo'},{email:'test@example.com',username:'x'},{email:'test@example.com',username:'<script>'}]){
  let failed=false;try{await authRequest('/api/register',args)}catch{failed=true}assert(failed,'Bad signup rejected before send');
 }
 assert(authCalls.length===2,'Invalid forms send no email');
 let failed=false;try{await authRequest('/api/verify-otp',{email:'test@example.com',token:'123'})}catch{failed=true}assert(failed&&authCalls.length===2,'Short code rejected locally');
 const login=await authRequest('/api/verify-otp',{email:'test@example.com',token:'123456'});
 assert(authCalls[2][1].type==='email'&&authCalls[2][1].token==='123456','Verify email OTP contract');
 assert(login.user.credits===5&&login.user.credits_reset_at===creditResponse.next_reset_at,'Credits normalized and server reset timestamp retained');
 assert(directReads===0,'Available daily RPC does not fall back');
 verifyError={message:'Expired'};failed=false;try{await authRequest('/api/verify-otp',{email:'test@example.com',token:'12345678'})}catch(e){failed=e.message.includes('expiré')}assert(failed,'Expired OTP never grants access');
 otpError={status:429};failed=false;try{await authRequest('/api/login',{email:'test@example.com'})}catch(e){failed=e.message.includes('Trop de demandes')}assert(failed,'Rate-limit feedback');
 creditResponse={...creditResponse,is_admin:true,credits:50};
 const admin=await getProfileForUser({id:'u1'});assert(admin.unlimited_credits,'Administrator has unlimited credits');
 window.authTestStatus='PASS: OTP signup/login, input validation, verification, expired codes, throttling, daily balance and admin credits';
})().catch(e=>{window.authTestStatus='FAIL: '+e.message});
'queued';
''')
status=evaluate('window.authTestStatus')
assert status.startswith('PASS:'),status
print(status)
