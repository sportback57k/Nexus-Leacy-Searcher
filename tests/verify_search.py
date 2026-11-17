"""Offline regression checks for search, using macOS JavaScriptCore."""
from verify import evaluate, root
app=(root/'js/app.js').read_text()
helpers=app[app.index('function errorMessage'):app.index('function getSupabase')]
handler=app[app.index('async function searchRpc'):app.index('const creditPill=')]
evaluate(r'''
let currentUser={id:'demo',credits:5,unlimited_credits:false};
let testInputs=[],calls=[],states=[],rendered=null,sourceError=null,sourceBody={results:[{prenom:'Démo'}]},billingError=null,historyError=null,accessError=null;
let requestGate=null;
ids.searchBtn.disabled=false;ids.searchBtn.querySelector=()=>({textContent:'Rechercher'});
document.querySelectorAll=()=>testInputs;
window.NEXUS_CONFIG={endpoint:'https://example.invalid/search'};
function updateCreditDisplays(){}
function page(id){calls.push('page:'+id)}
function setNotice(){}
function supabaseReady(){return {rpc:(name,args)=>{
 calls.push(name);
 const result=name==='nexus_get_credit_status'?{data:{id:currentUser?.id,credits:5,is_admin:false},error:accessError}:name==='nexus_start_search'?{data:{search_id:'s1',credits:4,unlimited_credits:false},error:billingError}:{data:true,error:historyError};
 const promise=Promise.resolve(result);promise.abortSignal=()=>promise;return promise;
}}}
function setTimeout(){return 1} function clearTimeout(){}
class AbortController {constructor(){this.signal={aborted:false}} abort(){this.signal.aborted=true}}
'''+helpers+handler+r'''
showState=(title,message)=>{states.push({title,message});currentResults=[]};
showResults=results=>{rendered=results};
fetchWithTimeout=async()=>{calls.push('fetch');if(requestGate)await requestGate;if(sourceError)throw sourceError;return {response:{ok:true,status:200},raw:JSON.stringify(sourceBody)}};
const runSearch=ids.searchBtn.events.click[ids.searchBtn.events.click.length-1];
function reset(){
 testInputs=[{value:'Démo',dataset:{key:'nom_famille'},checkValidity:()=>true}];
 currentUser={id:'demo',credits:5,unlimited_credits:false};
 calls=[];states=[];rendered=null;sourceError=null;sourceBody={results:[{prenom:'Démo'}]};billingError=null;historyError=null;accessError=null;requestGate=null;
}
window.searchTestStatus='running';
(async()=>{
 reset();await runSearch();
 assert(calls.join(',')==='nexus_get_credit_status,fetch,nexus_start_search,nexus_finish_search','Only debit after valid source response');
 assert(rendered.length===1&&currentUser.credits===4&&!ids.searchBtn.disabled,'Successful rendering and button release');
 reset();accessError={message:'Ce compte est banni'};await runSearch();assert(calls.join(',')==='nexus_get_credit_status'&&rendered===null,'A banned cached account never contacts the source');
 reset();sourceError=new Error('Network unavailable');await runSearch();
 assert(calls.join(',')==='nexus_get_credit_status,fetch'&&currentUser.credits===5&&!ids.searchBtn.disabled,'Network failures never debit');
 for(const body of [{error:{message:'Refus'}},{results:[null]},{results:['invalid']},{data:{unexpected:[]}}]){
  reset();sourceBody=body;await runSearch();assert(calls.join(',')==='nexus_get_credit_status,fetch'&&rendered===null,'Malformed and error payloads never debit');
 }
 reset();sourceBody={data:{results:[]}};await runSearch();assert(rendered.length===0&&calls.includes('nexus_start_search'),'Valid empty result');
 reset();historyError={message:'History unavailable'};await runSearch();assert(rendered.length===1,'History failure preserves paid results');
 reset();billingError={message:'Crédits insuffisants'};await runSearch();assert(rendered===null&&!calls.includes('nexus_finish_search'),'Billing rejection does not expose results');
 reset();testInputs=[];await runSearch();assert(calls.length===0&&states[0].title==='Aucun critère','Empty criteria do not request source');
 reset();currentUser.credits=0;await runSearch();assert(calls.length===0,'Zero credits do not request source');
 reset();currentUser=null;await runSearch();assert(calls.join(',')==='page:account','Signed-out users routed to account');
 reset();testInputs=[['date_naissance','2000-01-02'],['jour_naissance','3']].map(([key,value])=>({dataset:{key},value,checkValidity:()=>true}));await runSearch();assert(calls.length===0&&states[0].title==='Date incohérente','Conflicting birth date rejected');
 reset();testInputs=[['jour_naissance','31'],['mois_naissance','2']].map(([key,value])=>({dataset:{key},value,checkValidity:()=>true}));await runSearch();assert(calls.length===0&&states[0].title==='Date invalide','Impossible calendar date rejected');
 reset();let release;requestGate=new Promise(resolve=>release=resolve);const first=runSearch();await runSearch();await Promise.resolve();assert(calls.join(',')==='nexus_get_credit_status,fetch','Double click starts one request');release();await first;
 reset();requestGate=new Promise(resolve=>release=resolve);const pending=runSearch();await Promise.resolve();await Promise.resolve();currentUser={id:'other',credits:10};release();await pending;assert(!calls.includes('nexus_start_search')&&currentUser.credits===10,'Changed session is never charged');
 window.searchTestStatus='PASS: search success, nested/empty results, source errors, malformed payloads, billing/history errors, date validation, login, zero credits, double clicks and session changes';
})().catch(error=>{window.searchTestStatus='FAIL: '+error.message});
'queued';
''')
status=evaluate('window.searchTestStatus')
assert status.startswith('PASS:'),status
print(status)
