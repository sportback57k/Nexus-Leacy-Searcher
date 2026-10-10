const groups={
"Identité":[["nom_famille","Nom"],["prenom","Prénom"],["nom_naissance","Nom de naissance"],["nom_affichage","Nom affiché"]],
"Naissance":[["jour_naissance","Jour"],["mois_naissance","Mois"],["annee_naissance","Année"],["date_naissance","Date exacte"],["ville_naissance","Ville de naissance"],["genre","Genre"]],
"Contact":[["email","Email"],["telephone","Téléphone"],["nom_utilisateur","Nom d’utilisateur"],["adresse_ip","Adresse IP"]],
"Localisation":[["adresse","Adresse"],["code_postal","Code postal"],["ville","Ville"]],
"FiveM / GTA RP":[["steam_id","Steam ID"],["fivem_license","FiveM License"],["discord_id","Discord ID"],["xbox_live_id","Xbox Live (XBL)"],["live_id","Live ID"],["fivem_license2","FiveM License2"]],
"Champs avancés":[["iban","IBAN"],["bic","BIC"],["vin_plaque","VIN / plaque"],["numero_serie","N° de série"]]
};
const groupExtras={
 "Localisation":[["complement_adresse","Complément d’adresse"],["departement","Département"],["region","Région"],["pays","Pays"],["lieu_naissance","Lieu de naissance"]],
 "Champs avancés":[["civilite","Civilité"],["mobile","Mobile"],["societe","Société"],["profession","Profession"],["fonction","Fonction"],["siret","SIRET"],["siren","SIREN"],["marque","Marque"],["modele","Modèle"],["immatriculation","Immatriculation"],["fivem_id","FiveM ID"]]
};
const groupIcons={"Identité":"👤","Naissance":"🎂","Contact":"📞","Localisation":"📍","FiveM / GTA RP":"🎮","Champs avancés":"🧩"};
const fieldTypes={
 jour_naissance:{type:"select",options:[["","Jour"],...Array.from({length:31},(_,index)=>[String(index+1),String(index+1)])]},
 mois_naissance:{type:"select",options:[["","Mois"],["1","Janvier"],["2","Février"],["3","Mars"],["4","Avril"],["5","Mai"],["6","Juin"],["7","Juillet"],["8","Août"],["9","Septembre"],["10","Octobre"],["11","Novembre"],["12","Décembre"]]},
 annee_naissance:{type:"number",min:"1900",max:"2100",placeholder:"Année"},
 date_naissance:{type:"date"},
 genre:{type:"select",options:[["","Tous"],["Homme","Homme"],["Femme","Femme"],["Autre","Autre"]]}
};
const emoji=Object.fromEntries(Object.values(groups).flat().map(([key])=>[key,"🔹"]));
const fieldLabels=Object.fromEntries([...Object.values(groups),...Object.values(groupExtras)].flat());
Object.assign(emoji,{nom_famille:"👤",prenom:"🧑",nom_naissance:"🪪",nom_affichage:"🏷️",nom_utilisateur:"@",genre:"⚧️",civilite:"🎩",date_naissance:"🎂",annee_naissance:"📅",jour_naissance:"📆",mois_naissance:"🗓️",email:"📧",telephone:"📱",mobile:"📲",adresse_ip:"🌐",discord_id:"💬",adresse:"🏠",complement_adresse:"🏡",ville:"📍",code_postal:"📮",departement:"🗺️",region:"🧭",pays:"🌍",ville_naissance:"👶",lieu_naissance:"📍",societe:"🏢",profession:"💼",fonction:"🧑‍💼",siret:"🏷️",siren:"🏷️",marque:"🚗",modele:"🚘",vin_plaque:"🔢",immatriculation:"🚘",numero_serie:"🔐",iban:"🏦",bic:"🏦",steam_id:"🎮",fivem_license:"🎮",fivem_license2:"🎮",fivem_id:"🎮",xbox_live_id:"🎮",live_id:"🎮"});

const $=selector=>document.querySelector(selector);
const esc=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
const heroArt=$(".hero-art");
const eyePupil=$(".eye-pupil");
if(heroArt&&eyePupil&&window.matchMedia("(pointer: fine) and (prefers-reduced-motion: no-preference)").matches){
 let pointerX=0,pointerY=0,eyeFrame=0;
 heroArt.addEventListener("pointermove",event=>{
  pointerX=event.clientX;pointerY=event.clientY;
  if(eyeFrame)return;
  eyeFrame=window.requestAnimationFrame(()=>{
   const bounds=eyePupil.parentElement.getBoundingClientRect();
   const dx=pointerX-(bounds.left+bounds.width/2),dy=pointerY-(bounds.top+bounds.height/2);
   const distance=Math.min(6,Math.hypot(dx,dy)/28);
   eyePupil.style.transform=`translate3d(${Math.cos(Math.atan2(dy,dx))*distance}px,${Math.sin(Math.atan2(dy,dx))*distance}px,0)`;
   eyeFrame=0;
  });
 });
 heroArt.addEventListener("pointerleave",()=>{eyePupil.style.transform="translate3d(0,0,0)"});
}
let currentResults=[];
let currentUser=null;
let adminUsersOffset=0;
let selectedAdminUser=null;
let siteMaintenance=false;
let siteMaintenanceReason="";
let siteTheme={name:"red",color:"#ff3038"};
const adminPageSize=100;
const fields=$("#fields");

for(const [index,[group,items]] of Object.entries(groups).entries()){
 const section=document.createElement("section");section.className="group";
 const toggle=document.createElement("button");toggle.type="button";toggle.className="group-toggle";toggle.setAttribute("aria-expanded",index===0?"true":"false");toggle.setAttribute("aria-controls",`group-fields-${index}`);
 const icon=document.createElement("span");icon.className="group-icon";icon.setAttribute("aria-hidden","true");icon.textContent=groupIcons[group]||"＋";
 const title=document.createElement("span");title.className="group-title";title.textContent=group;
 const chevron=document.createElement("span");chevron.className="group-chevron";chevron.setAttribute("aria-hidden","true");chevron.textContent="⌃";
 toggle.append(icon,title,chevron);
 const content=document.createElement("div");content.className="group-content";content.id=`group-fields-${index}`;
 content.hidden=index!==0;
 content.appendChild(createFieldGrid(items));
 if(groupExtras[group]){
  const details=document.createElement("details");details.className="extra-fields";
  const summary=document.createElement("summary");summary.textContent=`➕ Autres critères (${groupExtras[group].length})`;
  details.append(summary,createFieldGrid(groupExtras[group]));content.appendChild(details);
 }
 toggle.addEventListener("click",()=>{const expanded=toggle.getAttribute("aria-expanded")==="true";toggle.setAttribute("aria-expanded",String(!expanded));content.hidden=expanded});
 section.append(toggle,content);fields.appendChild(section);
}
function createFieldGrid(items){
 const grid=document.createElement("div");grid.className="grid";
 for(const [key,label] of items){
  const wrapper=document.createElement("label");
  const caption=document.createElement("span");caption.className="field-caption";caption.textContent=`${emoji[key]||"🔹"} ${label}`;
  const config=fieldTypes[key]||{};
  const input=document.createElement(config.type==="select"?"select":"input");input.dataset.key=key;
  if(config.type==="select"){
   config.options.forEach(([value,text])=>{const option=document.createElement("option");option.value=value;option.textContent=text;input.appendChild(option)});
  }else{
   input.type=config.type||"text";input.placeholder=config.placeholder||label;
   if(config.min)input.min=config.min;
   if(config.max)input.max=config.max;
  }
  wrapper.append(caption,input);grid.appendChild(wrapper);
 }
 return grid;
}

function updateFilters(){
 const count=[...document.querySelectorAll("[data-key]")].filter(input=>input.value.trim()).length;
 $("#selected").textContent=`${count} critère${count===1?"":"s"}`;
 $(".filter-count").textContent=`${count} critère${count===1?"":"s"} actif${count===1?"":"s"}`;
}
let creditCountdownTimer=null;
function formatResetCountdown(resetAt){
 const target=Date.parse(resetAt||"");
 if(!Number.isFinite(target))return "—";
 const ms=Math.max(0,target-Date.now());
 const totalSeconds=Math.floor(ms/1000);
 const days=Math.floor(totalSeconds/86400);
 const hours=Math.floor((totalSeconds%86400)/3600);
 const minutes=Math.floor((totalSeconds%3600)/60);
 const seconds=totalSeconds%60;
 if(days>0)return `${days}j ${String(hours).padStart(2,"0")}h ${String(minutes).padStart(2,"0")}m`;
 return `${String(hours).padStart(2,"0")}h ${String(minutes).padStart(2,"0")}m ${String(seconds).padStart(2,"0")}s`;
}
function updateCreditDisplays(){
 const unlimited=Boolean(currentUser?.unlimited_credits);
 const credits=Number.isInteger(currentUser?.credits)?currentUser.credits:null;
 const creditsPill=$("#creditsPill");
 const text=unlimited?"Crédits illimités":credits===null?"Crédits":`${credits} crédit${credits===1?"":"s"}`;
 if(creditsPill)creditsPill.textContent=text;
 const profileCredits=$("#profileCredits");
 if(profileCredits)profileCredits.textContent=unlimited?"∞":credits===null?"0":String(credits);
 const resetText=$("#creditResetCountdown");
 if(resetText)resetText.textContent=unlimited?"Aucun reset nécessaire":credits===null?"Connecte-toi pour voir le reset":`Reset dans ${formatResetCountdown(currentUser?.credits_reset_at)}`;
 const modalCredits=$("#creditModalBalance");
 if(modalCredits)modalCredits.textContent=unlimited?"∞":credits===null?"0":String(credits);
 const modalReset=$("#creditModalReset");
 if(modalReset)modalReset.textContent=unlimited?"Crédits illimités":`Prochain renouvellement : ${formatResetCountdown(currentUser?.credits_reset_at)}`;
}
function startCreditCountdown(){
 if(creditCountdownTimer)clearInterval(creditCountdownTimer);
 creditCountdownTimer=setInterval(async()=>{
   if(!currentUser||currentUser.unlimited_credits)return updateCreditDisplays();
   if(currentUser.credits_reset_at&&Date.parse(currentUser.credits_reset_at)<=Date.now()){
     try{
       const result=await api("/api/me");
       currentUser=result.user;
     }catch(error){console.warn("Impossible de renouveler les crédits :",error.message||error)}
   }
   updateCreditDisplays();
 },1000);
 updateCreditDisplays();
}
document.querySelectorAll("[data-key]").forEach(input=>{
 input.addEventListener("input",updateFilters);
 input.addEventListener("change",updateFilters);
});

const SITE_THEMES={
 red:{name:"Rouge",color:"#ff3038",rgb:"255,48,56",light:"#ff6670",dark:"#a90f18"},
 violet:{name:"Violet",color:"#9b5cff",rgb:"155,92,255",light:"#bd91ff",dark:"#5f2bb8"},
 blue:{name:"Bleu",color:"#3d8bff",rgb:"61,139,255",light:"#79adff",dark:"#1f56b5"},
 green:{name:"Vert",color:"#20c77a",rgb:"32,199,122",light:"#67e0a6",dark:"#087c4b"},
 orange:{name:"Orange",color:"#ff8a30",rgb:"255,138,48",light:"#ffb16f",dark:"#b84d0a"},
 pink:{name:"Rose",color:"#ff4fa3",rgb:"255,79,163",light:"#ff8bc2",dark:"#b51e68"}
};
function hexToRgb(hex){const m=String(hex||"").match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);return m?`${parseInt(m[1],16)},${parseInt(m[2],16)},${parseInt(m[3],16)}`:"255,48,56"}
function applySiteTheme(theme){
 const color=String(theme?.color||"#ff3038").toLowerCase();
 const preset=Object.values(SITE_THEMES).find(item=>item.color===color)||{name:"Personnalisé",color,rgb:hexToRgb(color),light:color,dark:color};
 siteTheme={name:String(theme?.name||preset.name),color, rgb:preset.rgb||hexToRgb(color),light:preset.light||color,dark:preset.dark||color};
 const root=document.documentElement;
 root.style.setProperty("--accent",siteTheme.color);
 root.style.setProperty("--accent-rgb",siteTheme.rgb);
 root.style.setProperty("--accent-light",siteTheme.light);
 root.style.setProperty("--accent-dark",siteTheme.dark);
 root.style.setProperty("--theme-glow",`rgba(${siteTheme.rgb},`);
 document.body?.setAttribute("data-site-theme",siteTheme.name.toLowerCase());
 const colorInput=$("#siteThemeColor"); if(colorInput)colorInput.value=siteTheme.color;
 const preview=$("#themePreviewText"); if(preview)preview.textContent=`${siteTheme.name} · ${siteTheme.color.toUpperCase()}`;
 document.querySelectorAll(".theme-swatch").forEach(btn=>btn.classList.toggle("active",btn.dataset.themePreset===Object.keys(SITE_THEMES).find(key=>SITE_THEMES[key].color===siteTheme.color)));
}
async function loadSiteTheme(){
 try{
  const client=supabaseReady();
  const {data,error}=await client.rpc("nexus_get_site_theme");
  if(error)throw error;
  const theme=Array.isArray(data)?data[0]:data;
  if(theme)applySiteTheme(theme);
 }catch(error){console.warn("Impossible de charger le thème global :",error?.message||error)}
}
async function saveSiteTheme(){
 if(!currentUser?.is_admin)throw new Error("Accès administrateur requis");
 const color=$("#siteThemeColor")?.value||"#ff3038";
 const preset=Object.values(SITE_THEMES).find(item=>item.color===color);
 const name=preset?.name||"Personnalisé";
 const {data,error}=await supabaseReady().rpc("nexus_set_site_theme",{p_name:name,p_color:color});
 if(error)throw error;
 const theme=Array.isArray(data)?data[0]:data;
 applySiteTheme(theme||{name,color});
}

async function loadMaintenanceStatus(){
 try{
  const client=supabaseReady();
  const {data,error}=await client.rpc("nexus_get_site_status");
  if(error)throw error;
  const status=Array.isArray(data)?data[0]:data;
  siteMaintenance=Boolean(status?.maintenance_mode);
  siteMaintenanceReason=String(status?.maintenance_reason||"");
  renderMaintenanceStatus();
 }catch(error){
  console.warn("Impossible de charger le mode maintenance :",error.message||error);
 }
}
function renderMaintenanceStatus(){
 const overlay=$("#maintenanceOverlay");
 if(!overlay)return;
 $("#maintenanceReason").textContent=siteMaintenanceReason||"Maintenance en cours.";
 const adminAllowed=Boolean(currentUser?.is_admin);
 overlay.hidden=!siteMaintenance||adminAllowed;
 const badge=$("#maintenanceStatusBadge");
 const desc=$("#maintenanceAdminDescription");
 if(badge)badge.textContent=siteMaintenance?"FERMÉ":"OUVERT";
 if(desc)desc.textContent=siteMaintenance?`Le site est fermé aux utilisateurs. Raison : ${siteMaintenanceReason}`:"Le site est actuellement ouvert.";
}
async function setMaintenance(enabled,reason=""){
 const client=supabaseReady();
 const {data,error}=await client.rpc("nexus_set_maintenance",{p_enabled:enabled,p_reason:reason});
 if(error)throw error;
 const status=Array.isArray(data)?data[0]:data;
 siteMaintenance=Boolean(status?.maintenance_mode);
 siteMaintenanceReason=String(status?.maintenance_reason||"");
 renderMaintenanceStatus();
}

const NEXUS_ROUTES={
 home:"/accueil/", search:"/recherche/", account:"/connexion/", bavur:"/bavur/", blocus:"/blocus/", discord:"/discord/", admin:"/admin/"
};
function currentRoutePage(){
 const path=window.location.pathname.replace(/\/+$/,"") || "/";
 for(const [id,route] of Object.entries(NEXUS_ROUTES)) if(path===route || (route!=="/" && path===route.slice(0,-1))) return id;
 return path==="/"?"home":"home";
}
document.querySelectorAll("[data-page]").forEach(button=>button.addEventListener("click",()=>page(button.dataset.page)));
function page(id){
 const route=NEXUS_ROUTES[id];
 const path=window.location.pathname.replace(/\/+$/,"") || "/";
 if(route && path!==route && path!==route.slice(0,-1)){ window.location.assign(route); return; }
 const target=$("#"+id);
 if(!target)return;
 document.querySelectorAll(".page").forEach(item=>item.classList.remove("active"));
 target.classList.add("active");
 target.classList.remove("page-enter"); void target.offsetWidth; target.classList.add("page-enter");
 document.querySelectorAll("nav button").forEach(item=>item.classList.toggle("active",item.dataset.page===id));
 document.querySelectorAll(".header-button").forEach(item=>item.classList.toggle("active",item.dataset.page===id));
 document.title=`NEXUS — ${({home:"Accueil",search:"Recherche",account:"Connexion",bavur:"BAVUR",blocus:"BLOCUS",discord:"Discord",admin:"Administration"})[id]||"NEXUS"}`;
 if(id==="account")renderAccount();
 if(id==="admin")openAdmin();
 if(id==="bavur"||id==="blocus")loadVideos(id.toUpperCase());
}

$("#clear").addEventListener("click",()=>{
 document.querySelectorAll("[data-key]").forEach(input=>input.value="");
 updateFilters();
});

function isDisplayableResultField(key,value){
 const normalized=String(key||"").toLowerCase();
 if(value===null||value===undefined||String(value).trim()==="")return false;
 if(normalized.startsWith("_"))return false;
 if(/(^|_)(raw|raw_data|all_texte|metadata|meta|debug|internal|source_payload)(_|$)/i.test(normalized))return false;
 if(["source","metadata","meta","debug","internal","all_texte","_all_texte"].includes(normalized))return false;
 return true;
}
function resultFields(result){
 return Object.entries(result||{}).filter(([key,value])=>isDisplayableResultField(key,value));
}
function displayValue(value){
 if(value!==null&&typeof value==="object"){
  try{return JSON.stringify(value)}catch{return String(value)}
 }
 return String(value??"");
}
function showResults(items){
 currentResults=items;
 $("#state").classList.add("hide");$("#count").textContent=items.length;$("#output").replaceChildren();
 items.forEach((result,index)=>{
  const all=resultFields(result);
  const title=result.nom_affichage||`${result.prenom||""} ${result.nom_famille||""}`.trim()||`Résultat ${index+1}`;
  $("#output").insertAdjacentHTML("beforeend",`<article class="result">
   <div class="rhead"><div class="avatar">${result.genre==="Femme"?"👩":result.genre==="Homme"?"👨":"👤"}</div><div><b>${esc(title)}</b><small>RÉSULTAT #${String(index+1).padStart(2,"0")}</small></div><button type="button" class="copy-result" data-result-index="${index}">⧉ Copier</button><span class="match">✓ MATCH</span></div>
   <div class="allfields">${all.map(([key,value])=>`<div class="kv"><span>${emoji[key]||"🔹"} ${esc(fieldLabels[key]||key.replace(/_/g," "))}</span><strong>${esc(displayValue(value))}</strong></div>`).join("")}</div>
  </article>`);
 });
}
function formatResultForCopy(result){
 const fields=resultFields(result);
 const title=result.nom_affichage||`${result.prenom||""} ${result.nom_famille||""}`.trim()||"Résultat";
 return `✦ NEXUS SEARCHER
━━━━━━━━━━━━━━━━━━━━
👤 ${title}

${fields.map(([key,value])=>`${emoji[key]||"🔹"} ${fieldLabels[key]||key.replace(/_/g," ")} : ${displayValue(value)}`).join("\n")}

━━━━━━━━━━━━━━━━━━━━
✨ Résultat exporté depuis NEXUS Searcher`;
}
async function copyText(text){
 let clipboardError;
 if(navigator.clipboard?.writeText){
  try{await navigator.clipboard.writeText(text);return}
  catch(error){clipboardError=error}
 }
 const textarea=document.createElement("textarea");
 textarea.value=text;textarea.setAttribute("readonly","");textarea.style.position="fixed";textarea.style.left="-9999px";
 document.body.appendChild(textarea);
 let copied=false;
 try{textarea.select();copied=document.execCommand("copy")}finally{textarea.remove()}
 if(!copied){
  const detail=clipboardError instanceof Error?` (${clipboardError.message})`:"";
  throw Error(`Copie impossible. Vérifie les autorisations du presse-papiers.${detail}`);
 }
}
$("#output").addEventListener("click",async event=>{
 const button=event.target.closest(".copy-result");
 if(!button)return;
 const result=currentResults[Number(button.dataset.resultIndex)];
 if(!result)return;
 button.disabled=true;
 try{await copyText(formatResultForCopy(result));button.textContent="✓ Copié";button.classList.add("copied")}
 catch(error){button.textContent="Échec";button.title=error.message}
 finally{
  button.disabled=false;
  window.setTimeout(()=>{if(button.isConnected){button.textContent="⧉ Copier";button.classList.remove("copied");button.removeAttribute("title")}},2500);
 }
});

function errorMessage(value){
 if(value instanceof Error && value.message)return value.message;
 if(typeof value==='string')return value;
 if(value&&typeof value==='object'){
  const direct=value.error??value.message??value.detail??value.reason;
  if(direct!==undefined){
   const nested=errorMessage(direct);
   if(nested)return nested;
  }
  try{return JSON.stringify(value)}catch{return String(value)}
 }
 return String(value??"Erreur inconnue");
}
function showState(title,message){
 $("#state").classList.remove("hide");
 $("#state").innerHTML=`<strong>!</strong><b>${esc(title)}</b><span>${esc(message)}</span>`;
 $("#output").replaceChildren();$("#count").textContent="—";
}

function getSupabase(){
 const cfg=window.NEXUS_CONFIG||{};
 if(!cfg.supabaseUrl||!cfg.supabaseAnonKey||!window.supabase?.createClient)return null;
 if(!window.__NEXUS_SUPABASE)window.__NEXUS_SUPABASE=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey,{
   auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
 });
 return window.__NEXUS_SUPABASE;
}
function supabaseReady(){
 const client=getSupabase();
 if(!client)throw new Error("Supabase n’est pas configuré. Renseigne supabaseUrl et supabaseAnonKey dans js/config.js.");
 return client;
}
async function getProfileForUser(authUser){
 const client=supabaseReady();
 // Le RPC gère le reset quotidien. Si la migration n'a pas encore été
 // exécutée, on retombe proprement sur la ligne du profil afin que le site
 // reste utilisable au lieu de bloquer toute l'interface.
 try{
  const {data,error}=await client.rpc("nexus_get_credit_status");
  if(!error){
   const profile=Array.isArray(data)?data[0]:data;
   if(profile)return {...profile,unlimited_credits:Boolean(profile.is_admin)};
  }
 }catch(error){
  console.warn("RPC crédits indisponible, lecture directe du profil :",error?.message||error);
 }
 const {data,error}=await client.from("nexus_profiles")
  .select("id,username,is_admin,credits,created_at,credits_reset_at")
  .eq("id",authUser.id).maybeSingle();
 if(error)throw new Error(error.message);
 if(!data)throw new Error("Profil du compte introuvable.");
 return {...data,unlimited_credits:Boolean(data.is_admin)};
}
async function authRequest(path, body){
 const client=supabaseReady();
 if(path==="/api/register"){
   const username=String(body.username||"").trim();
   const email=String(body.email||"").trim().toLowerCase();
   const password=String(body.password||"");
   if(!/^[A-Za-z0-9_.-]{3,32}$/.test(username))throw new Error("Le pseudo doit faire 3 à 32 caractères (lettres, chiffres, ., _ ou -).");
   if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email))throw new Error("Adresse e-mail invalide.");
   if(password.length<8||password.length>256)throw new Error("Le mot de passe doit contenir de 8 à 256 caractères.");
   const {data,error}=await client.auth.signUp({
     email,
     password,
     options:{data:{username}}
   });
   if(error)throw new Error(error.message);
   if(!data.user)throw new Error("Le compte n’a pas pu être créé.");
   // The trigger creates the profile from user metadata.
   if(!data.session)throw new Error("Compte créé. Vérifie ton e-mail pour activer le compte, puis connecte-toi avec ton pseudo.");
   return {user:await getProfileForUser(data.user)};
 }
 if(path==="/api/login"){
   const email=String(body.email||"").trim().toLowerCase();
   const password=String(body.password||"");
   if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email))throw new Error("Adresse e-mail invalide.");
   const {data,error}=await client.auth.signInWithPassword({email,password});
   if(error)throw new Error("E-mail ou mot de passe incorrect.");
   return {user:await getProfileForUser(data.user)};
 }
 if(path==="/api/logout"){
   const {error}=await client.auth.signOut();
   if(error)throw new Error(error.message);
   return {logged_out:true};
 }
 if(path==="/api/me"){
   const {data,error}=await client.auth.getUser();
   if(error||!data.user)return {user:null};
   return {user:await getProfileForUser(data.user)};
 }
 return null;
}

async function api(path,options={}){
 const method=(options.method||"GET").toUpperCase();
 if(["/api/me","/api/login","/api/register","/api/logout"].includes(path)){
   let body={};
   if(options.body){
     try{body=typeof options.body==="string"?JSON.parse(options.body):options.body}catch{}
   }
   return authRequest(path,body);
 }
 const headers=new Headers(options.headers||{});
 if(options.body&&!(options.body instanceof FormData))headers.set("Content-Type","application/json");
 headers.set("Accept","application/json");
 const response=await fetch(path,{...options,headers,credentials:"same-origin"});
 const raw=await response.text();
 let payload={};
 try{payload=raw?JSON.parse(raw):{}}catch{payload={raw}}
 if(!response.ok){
  const detail=errorMessage(payload?.error??payload?.message??payload?.detail??payload?.raw);
  const error=new Error(detail||`Erreur HTTP ${response.status}`);
  error.status=response.status;
  error.credits=payload.credits;
  throw error;
 }
 return payload;
}
$("#searchBtn").addEventListener("click",async()=>{
 const criteria={};
 document.querySelectorAll("[data-key]").forEach(input=>{if(input.value.trim())criteria[input.dataset.key]=input.value.trim()});
 if(!Object.keys(criteria).length){showState("Aucun critère","Saisis au moins un critère.");return}
 if(!currentUser){page("account");setNotice($("#accountNotice"),"Connecte-toi pour effectuer une recherche.","error");return}
 const endpoint=(window.NEXUS_CONFIG?.endpoint||"").trim();
 if(!endpoint){showState("Source non configurée","Ajoute une source de recherche autorisée dans js/config.js.");return}
 const searchButton=$("#searchBtn");
 if(searchButton.disabled)return;
 searchButton.disabled=true;
 let charged=false;
 try{
  showState("Recherche…","Interrogation de la source configurée.");
  const client=supabaseReady();
  const {data:billing,error:billingError}=await client.rpc("nexus_start_search",{p_criteria:criteria});
  if(billingError)throw Error(`Impossible de démarrer la recherche : ${billingError.message}`);
  const billingData=Array.isArray(billing)?billing[0]:billing;
  if(!billingData)throw Error("La réservation du crédit n’a pas renvoyé de réponse.");
  currentUser.credits=Number(billingData.credits);
  currentUser.unlimited_credits=Boolean(billingData.unlimited_credits);
  currentUser.credits_reset_at=billingData.next_reset_at||currentUser.credits_reset_at;
  updateCreditDisplays();
  charged=true;
  const response=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json","Accept":"application/json"},body:JSON.stringify(criteria)});
  const raw=await response.text();
  let body={};
  try{body=raw?JSON.parse(raw):{}}catch{body={raw}}
  if(!response.ok){
    const detail=errorMessage(body?.error??body?.message??body?.detail??body?.raw);
    throw Error(detail||`La source a répondu HTTP ${response.status}.`);
  }
  const results=body?.data?.results??body?.results??[];
  if(!Array.isArray(results))throw Error("La réponse de la source n’est pas une liste de résultats.");
  const {error:logError}=await client.rpc("nexus_finish_search",{p_search_id:billingData.search_id,p_result_count:results.length});
  if(logError)console.warn("Historique de recherche non enregistré :",logError.message);
  showResults(results);
 }catch(error){
  if(Number.isInteger(error.credits)){currentUser.credits=error.credits;updateCreditDisplays()}
  if(error.status===402)showState("Crédits insuffisants",error.message);
  else {
   const message=errorMessage(error);
   showState("Erreur",charged?`${message} Un crédit a été consommé pour cette tentative.`:message);
  }
 }finally{searchButton.disabled=false}
});

const creditPill=$("#creditsPill");
const creditModal=$("#creditModal");
function openCreditModal(){
 if(!creditModal)return;
 updateCreditDisplays();
 creditModal.hidden=false;
 creditModal.setAttribute("aria-hidden","false");
}
function closeCreditModal(){
 if(!creditModal)return;
 creditModal.hidden=true;
 creditModal.setAttribute("aria-hidden","true");
}
creditPill?.addEventListener("click",openCreditModal);
$("#closeCreditModal")?.addEventListener("click",closeCreditModal);
creditModal?.addEventListener("click",event=>{if(event.target===creditModal)closeCreditModal()});
document.addEventListener("keydown",event=>{if(event.key==="Escape")closeCreditModal()});

const accountNav=$("#accountNav");
const accountNotice=$("#accountNotice");
const adminNotice=$("#adminNotice");
function setNotice(element,message,kind="info"){element.textContent=message;element.dataset.kind=kind}

function renderAccount(){
 const signedIn=Boolean(currentUser);
 $("#accountForms").hidden=signedIn;
 if(!signedIn)showAuthForm("signup");
 $("#accountProfile").hidden=!signedIn;
 accountNav.textContent=signedIn?currentUser.username:"Connexion";
 document.querySelectorAll(".upload-form").forEach(form=>{form.hidden=!signedIn});
 if(signedIn)$("#profileUsername").textContent=currentUser.username;
 updateCreditDisplays();
}
async function refreshSession(){
 const client=getSupabase();
 if(!client){
  currentUser=null;
  renderAccount();
  return;
 }
 const {data,error}=await client.auth.getUser();
 if(error||!data?.user){
  currentUser=null;
  renderAccount();
  return;
 }
 try{
  currentUser=await getProfileForUser(data.user);
 }catch(error){
  console.warn("Session détectée mais profil indisponible :",error?.message||error);
  currentUser=null;
 }
 renderAccount();
 if($("#admin")?.classList.contains("active"))await openAdmin();
}


// Compteur réel des présences actives via Supabase Realtime Presence.
// Aucun historique n'est enregistré : seules les connexions actuellement actives sont comptées.
let onlineChannel=null;
let onlineReconnectTimer=null;
const onlinePresenceKey=(()=>{
 try{
  const storageKey="nexus_presence_key";
  const existing=sessionStorage.getItem(storageKey);
  if(existing)return existing;
  const next=globalThis.crypto?.randomUUID?.()||`guest-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  sessionStorage.setItem(storageKey,next);
  return next;
 }catch{return `guest-${Date.now()}-${Math.random().toString(36).slice(2)}`}
})();
function renderOnlineCount(count){
 const value=Math.max(0,Number(count)||0);
 const node=$("#onlineCount");
 if(node)node.textContent=String(value);
 $("#onlineCounter")?.classList.remove("is-loading");
}
function scheduleOnlineReconnect(){
 if(onlineReconnectTimer)return;
 onlineReconnectTimer=setTimeout(()=>{onlineReconnectTimer=null;startOnlineCounter()},1500);
}
async function stopOnlineCounter(){
 if(onlineReconnectTimer){clearTimeout(onlineReconnectTimer);onlineReconnectTimer=null}
 if(onlineChannel){try{await onlineChannel.untrack()}catch{};try{await getSupabase()?.removeChannel(onlineChannel)}catch{};onlineChannel=null}
}
async function startOnlineCounter(){
 const client=getSupabase();
 const wrapper=$("#onlineCounter");
 if(!client||!wrapper||!client.channel)return;
 if(onlineChannel)return;
 wrapper.classList.add("is-loading");
 try{
  const channel=client.channel("nexus-online-users",{config:{presence:{key:onlinePresenceKey}}});
  onlineChannel=channel;
  channel.on("presence",{event:"sync"},()=>{
   if(onlineChannel!==channel)return;
   const state=channel.presenceState()||{};
   // Each presence key represents one active browser tab/session.
   renderOnlineCount(Object.keys(state).length);
  });
  channel.on("presence",{event:"join"},()=>{
   const state=channel.presenceState()||{};
   renderOnlineCount(Object.keys(state).length);
  });
  channel.on("presence",{event:"leave"},()=>{
   const state=channel.presenceState()||{};
   renderOnlineCount(Object.keys(state).length);
  });
  channel.subscribe(async status=>{
   if(status==="SUBSCRIBED"){
    await channel.track({online:true,joined_at:new Date().toISOString()});
   }else if(status==="CHANNEL_ERROR"||status==="TIMED_OUT"||status==="CLOSED"){
    if(onlineChannel===channel)onlineChannel=null;
    wrapper.classList.add("is-loading");
    scheduleOnlineReconnect();
   }
  });
 }catch(error){
  onlineChannel=null;
  console.warn("Compteur en ligne indisponible :",error);
  scheduleOnlineReconnect();
 }
}

const initialSupabase=getSupabase();
if(initialSupabase){
 initialSupabase.auth.onAuthStateChange(async (_event,session)=>{
   try{
     currentUser=session?.user?await getProfileForUser(session.user):null;
     renderAccount();
   }catch(error){
     currentUser=null; renderAccount();
     setNotice(accountNotice,error.message,"error");
   }
 });

}

startOnlineCounter();
startCreditCountdown();

function showAuthForm(mode){
 const signup=$("#signupForm"),login=$("#loginForm");
 if(!signup||!login)return;
 const showLogin=mode==="login";
 signup.hidden=showLogin;
 login.hidden=!showLogin;
 const target=showLogin?login:signup;
 setTimeout(()=>target.querySelector("input")?.focus(),30);
}
$("#showLoginButton")?.addEventListener("click",()=>showAuthForm("login"));
$("#showSignupButton")?.addEventListener("click",()=>showAuthForm("signup"));

$("#loginForm").addEventListener("submit",async event=>{
 event.preventDefault();
 const form=event.currentTarget,button=form.querySelector('[type="submit"]');
 button.disabled=true;
 try{
  const values=new FormData(form);
  const result=await api("/api/login",{method:"POST",body:JSON.stringify({email:values.get("email"),password:values.get("password")})});
  currentUser=result.user;renderAccount();form.reset();
  setNotice(accountNotice,"Connexion réussie.","success");
 }catch(error){setNotice(accountNotice,error.message,"error")}
 finally{button.disabled=false}
});
$("#signupForm").addEventListener("submit",async event=>{
 event.preventDefault();
 const form=event.currentTarget,button=form.querySelector('[type="submit"]');
 if(!form.reportValidity())return;
 button.disabled=true;
 setNotice(accountNotice,"Création du compte…");
 try{
  const values=new FormData(form);
  const result=await api("/api/register",{method:"POST",body:JSON.stringify({email:values.get("email"),username:values.get("username"),password:values.get("password")})});
  currentUser=result.user;renderAccount();form.reset();
  setNotice(accountNotice,"Compte créé et connecté.","success");
 }catch(error){setNotice(accountNotice,error.message,"error")}
 finally{button.disabled=false}
});
$("#logoutButton").addEventListener("click",async()=>{
 try{
  await api("/api/logout",{method:"POST",body:"{}"});
  currentUser=null;renderAccount();setNotice(accountNotice,"Tu es déconnecté.","success");
 }catch(error){setNotice(accountNotice,`Déconnexion impossible : ${error.message}`,"error")}
});

function videoPublicUrl(video){
 const path=video.public_path||video.storage_path;
 return supabaseReady().storage.from("nexus-videos-public").getPublicUrl(path).data.publicUrl;
}

async function createVideoCard(video,{moderation=false}={}){
 const card=document.createElement("article");card.className="video-card";
 const player=document.createElement("video");player.controls=true;player.preload="none";player.loading="lazy";
 player.src=videoPublicUrl(video);
 player.setAttribute("aria-label",video.title);
 const body=document.createElement("div");body.className="video-card-body";
 const heading=document.createElement("h3");heading.textContent=video.title;
 const description=document.createElement("p");description.textContent=video.description||"Aucune description.";
 const meta=document.createElement("small");
 meta.textContent=moderation?`${video.category} · par ${video.username} · ${new Date(video.created_at).toLocaleString("fr-FR")} · ${(Number(video.size_bytes||0)/1024/1024).toFixed(1)} Mo`:`${video.category} · Par ${video.username} · ${new Date(video.created_at).toLocaleDateString("fr-FR")}`;
 body.append(heading,description,meta);card.append(player,body);
 if(moderation){
  const actions=document.createElement("div");actions.className="video-actions";
  if(video.status==="pending"){
   const approve=document.createElement("button");approve.type="button";approve.className="primary";approve.textContent="✓ Approuver";
   const reject=document.createElement("button");reject.type="button";reject.className="secondary-button";reject.textContent="Refuser";
   approve.addEventListener("click",()=>moderateVideo(video,"approved",approve,reject));
   reject.addEventListener("click",()=>moderateVideo(video,"rejected",reject,approve));
   actions.append(approve,reject);
  }
  const remove=document.createElement("button");remove.type="button";remove.className="secondary-button";remove.textContent="🗑 Supprimer";
  remove.addEventListener("click",()=>deleteVideo(video,remove));
  actions.append(remove);card.appendChild(actions);
 }
 return card;
}

async function moderateVideo(video,status,button,otherButton){
 if(!currentUser?.is_admin)return;
 button.disabled=true;otherButton.disabled=true;
 try{
  const client=supabaseReady();
  let publicPath=video.public_path;
  if(status==="approved" && !publicPath){
   // Les vidéos sont stockées dans le bucket public avec un chemin UUID difficile à deviner.
   // La visibilité sur le site est contrôlée par la colonne status.
   publicPath=video.storage_path;
  }
  const {data,error}=await client.from("nexus_videos").update({
   status,
   public_path:status==="approved"?publicPath:null,
   reviewed_at:new Date().toISOString(),
   reviewed_by:currentUser.id,
   rejection_reason:status==="rejected"?"Refusée par l’administrateur":null
  }).eq("id",video.id).select("*").single();
  if(error)throw new Error(error.message);
  if(status==="rejected"){
   await client.storage.from("nexus-videos-public").remove([video.storage_path]);
  }
  setNotice(adminNotice,status==="approved"?`« ${video.title} » est maintenant publiée sur l’accueil.`:`« ${video.title} » a été refusée.`,status==="approved"?"success":"info");
  await loadPendingVideos();
  await loadFeaturedVideos();
 }catch(error){setNotice(adminNotice,`Modération impossible : ${error.message}`,"error");button.disabled=false;otherButton.disabled=false}
}

async function deleteVideo(video,button){
 if(!currentUser?.is_admin)return;
 if(!window.confirm(`Supprimer définitivement « ${video.title} » ? Cette action est irréversible.`))return;
 button.disabled=true;
 try{
  const client=supabaseReady();
  if(video.storage_path){
   const {error:storageError}=await client.storage.from("nexus-videos-public").remove([video.storage_path]);
   if(storageError)throw new Error(storageError.message);
  }
  const {error}=await client.from("nexus_videos").delete().eq("id",video.id);
  if(error)throw new Error(error.message);
  setNotice(adminNotice,`« ${video.title} » a été supprimée.`,"success");
  await loadPendingVideos();
  await loadFeaturedVideos();
 }catch(error){
  setNotice(adminNotice,`Suppression impossible : ${error.message}`,"error");
  button.disabled=false;
 }
}

async function loadVideos(category){
 const container=$(`#${category.toLowerCase()}Videos`);
 try{
  const {data,error}=await supabaseReady().from("nexus_videos").select("*").eq("category",category).eq("status","approved").order("created_at",{ascending:false});
  if(error)throw new Error(error.message);
  container.replaceChildren();
  if(!data?.length){container.innerHTML='<p class="video-empty">Aucune vidéo publiée pour le moment.</p>';return}
  const cards=await Promise.all(data.map(video=>createVideoCard(video)));
  cards.forEach(card=>container.appendChild(card));
 }catch(error){container.innerHTML="";setNotice($(`#${category.toLowerCase()}Notice`),`Impossible de charger les vidéos : ${error.message}`,"error")}
}

async function loadFeaturedVideos(){
 const container=$("#featuredVideos");
 if(!container)return;
 try{
  const {data,error}=await supabaseReady().from("nexus_videos").select("id,username,category,title,description,storage_path,public_path,created_at,status").eq("status","approved").order("created_at",{ascending:false}).limit(6);
  if(error)throw new Error(error.message);
  container.replaceChildren();
  if(!data?.length){container.innerHTML='<p class="video-empty">Aucune vidéo validée pour le moment.</p>';return}
  const cards=await Promise.all(data.map(video=>createVideoCard(video)));
  cards.forEach(card=>container.appendChild(card));
 }catch(error){container.innerHTML='<p class="video-empty">Les vidéos validées seront affichées ici.</p>'}
}

async function loadPendingVideos(){
 if(!currentUser?.is_admin)return;
 try{
  const {data,error}=await supabaseReady().from("nexus_videos").select("*").in("status",["pending","approved"]).order("created_at",{ascending:false});
  if(error)throw new Error(error.message);
  const container=$("#pendingVideos");container.replaceChildren();
  if(!data?.length){container.innerHTML='<p class="video-empty">Aucune vidéo à modérer ou publiée.</p>';return}
  const cards=await Promise.all(data.map(video=>createVideoCard(video,{moderation:true})));
  cards.forEach(card=>container.appendChild(card));
 }catch(error){setNotice(adminNotice,`Impossible de charger les vidéos : ${error.message}`,"error")}
}

document.querySelectorAll(".upload-form").forEach(form=>form.addEventListener("submit",async event=>{
 event.preventDefault();
 if(!currentUser){page("account");return}
 const button=form.querySelector('[type="submit"]'),category=form.elements.category.value;
 const file=form.elements.video.files[0];
 if(!file){setNotice($(`#${category.toLowerCase()}Notice`),"Sélectionne une vidéo MP4 ou MOV.","error");return}
 if(file.size>500*1024*1024){setNotice($(`#${category.toLowerCase()}Notice`),"La vidéo dépasse la limite de 500 Mo.","error");return}
 const lowerName=file.name.toLowerCase();
 const isMp4=file.type==="video/mp4"||lowerName.endsWith(".mp4");
 const isMov=file.type==="video/quicktime"||lowerName.endsWith(".mov");
 if(!isMp4&&!isMov){setNotice($(`#${category.toLowerCase()}Notice`),"Seuls les fichiers MP4 ou MOV sont acceptés.","error");return}
 button.disabled=true;
 setNotice($(`#${category.toLowerCase()}Notice`),"Envoi de la vidéo en cours…");
 try{
  const client=supabaseReady();
  const title=String(form.elements.title.value||"").trim();
  const description=String(form.elements.description.value||"").trim();
  if(!title){throw new Error("Le titre est obligatoire.")}
  const safeName=file.name.replace(/[^A-Za-z0-9._-]+/g,"_").slice(-90)||(isMov?"video.mov":"video.mp4");
  const path=`${currentUser.id}/${crypto.randomUUID()}-${safeName}`;
  const uploadContentType=isMov?"video/quicktime":"video/mp4";
  const {error:uploadError}=await client.storage.from("nexus-videos-public").upload(path,file,{contentType:uploadContentType,upsert:false,cacheControl:"3600"});
  if(uploadError)throw new Error(`Upload impossible : ${uploadError.message}`);
  const {error:insertError}=await client.from("nexus_videos").insert({
   user_id:currentUser.id,username:currentUser.username,category,title,description,
   storage_path:path,public_path:null,status:"pending",size_bytes:file.size
  });
  if(insertError){await client.storage.from("nexus-videos-public").remove([path]);throw new Error(insertError.message)}
  form.reset();
  setNotice($(`#${category.toLowerCase()}Notice`),"Vidéo envoyée. Elle est maintenant en attente de validation par un administrateur.","success");
 }catch(error){setNotice($(`#${category.toLowerCase()}Notice`),error.message,"error")}
 finally{button.disabled=false}
}));

$("#refreshVideos").addEventListener("click",loadPendingVideos);

function appendUserRow(user){
 const row=document.createElement("article");row.className="user-row";
 const info=document.createElement("div");info.className="user-row-info";
 const username=document.createElement("strong");username.textContent=user.username;
 const created=document.createElement("small");
 created.textContent=`${user.is_admin?"Crédits illimités":`${user.credits} crédit${user.credits===1?"":"s"}`} · Inscription : ${new Date(user.created_at).toLocaleString("fr-FR")}`;
 info.append(username,created);
 const view=document.createElement("button");view.type="button";view.className="secondary-button";view.textContent="Voir l’activité";
 view.addEventListener("click",()=>openUserActivity(user));
 row.append(info,view);$("#usersList").appendChild(row);
}

async function loadAdminUsers(reset=true){
 if(!currentUser?.is_admin)return;
 try{
  const {data,error}=await supabaseReady().from("nexus_profiles").select("id,username,is_admin,credits,created_at").order("username",{ascending:true});
  if(error)throw new Error(error.message);
  const users=data||[];
  const select=$("#creditUserSelect");
  select.replaceChildren();
  const placeholder=document.createElement("option");placeholder.value="";placeholder.textContent="Choisir un pseudo…";select.appendChild(placeholder);
  users.forEach(user=>{
   const option=document.createElement("option");option.value=user.id;option.textContent=`${user.username}${user.is_admin?" · ADMIN":""} — ${user.is_admin?"∞":user.credits}`;option.dataset.credits=String(user.credits);select.appendChild(option);
  });
  $("#usersList").replaceChildren();users.forEach(appendUserRow);
  $("#loadMoreUsers").hidden=true;
  setNotice(adminNotice,`${users.length} compte${users.length===1?"":"s"} chargé${users.length===1?"":"s"}.`,"success");
 }catch(error){setNotice(adminNotice,`Impossible de charger les comptes : ${error.message}`,"error")}
}

$("#creditUserSelect").addEventListener("change",event=>{
 const option=event.target.selectedOptions[0];
 if(option?.dataset.credits)$("#setCreditsForm").elements.credits.value=option.dataset.credits;
});

$("#setCreditsForm").addEventListener("submit",async event=>{
 event.preventDefault();
 const form=event.currentTarget;
 if(!form.reportValidity())return;
 const userId=String(form.elements.user_id.value);const credits=Number(form.elements.credits.value);
 try{
  const {data,error}=await supabaseReady().rpc("nexus_admin_set_credits",{p_user_id:userId,p_credits:credits});
  if(error)throw new Error(error.message);
  const result=Array.isArray(data)?data[0]:data;
  if(!result)throw new Error("Aucun compte modifié.");
  await loadAdminUsers();
  form.elements.user_id.value=userId;
  form.elements.credits.value=String(result.credits);
  setNotice(adminNotice,`${result.username} possède maintenant ${result.credits} crédit${result.credits===1?"":"s"}.`,"success");
 }catch(error){setNotice(adminNotice,`Modification impossible : ${error.message}`,"error")}
});

async function openUserActivity(user){
 selectedAdminUser=user;
 $("#userLogsTitle").textContent=`Activité — ${user.username}`;
 $("#adminUserList").hidden=true;$("#userLogsPanel").hidden=false;$("#userLogs").replaceChildren();
 try{
  const client=supabaseReady();
  const [{data:searches,error:searchError},{data:videos,error:videoError}]=await Promise.all([
   client.from("nexus_search_logs").select("criteria,criteria_count,result_count,created_at").eq("user_id",user.id).order("created_at",{ascending:false}).limit(100),
   client.from("nexus_videos").select("category,status,title,description,created_at").eq("user_id",user.id).order("created_at",{ascending:false}).limit(100)
  ]);
  if(searchError)throw new Error(searchError.message);
  if(videoError)throw new Error(videoError.message);
  (searches||[]).forEach(item=>{
   const criteria=item.criteria&&typeof item.criteria==="object"?Object.entries(item.criteria).map(([key,value])=>`${fieldLabels[key]||key} = ${String(value)}`).join("\n"):"Critères non disponibles";
   appendActivity("Recherche",`${criteria}\n\n${item.criteria_count} critère(s) · ${item.result_count??"—"} résultat(s)`,item.created_at);
  });
  (videos||[]).forEach(item=>appendActivity(`${item.category} · ${item.status}`,`${item.title}\n${item.description||""}`,item.created_at));
  if(!(searches||[]).length&&!(videos||[]).length){const empty=document.createElement("p");empty.className="card-description";empty.textContent="Aucune activité enregistrée.";$("#userLogs").appendChild(empty)}
 }catch(error){setNotice(adminNotice,`Impossible de charger l’activité : ${error.message}`,"error")}
}

$("#backToUsers").addEventListener("click",()=>{
 selectedAdminUser=null;$("#userLogsPanel").hidden=true;$("#adminUserList").hidden=false;
});
$("#refreshUsers").addEventListener("click",()=>loadAdminUsers());
$("#loadMoreUsers").addEventListener("click",()=>loadAdminUsers());

$("#maintenanceForm").addEventListener("submit",async event=>{
 event.preventDefault();
 if(!currentUser?.is_admin)return;
 const reason=$("#maintenanceReasonInput").value.trim();
 if(!reason){setNotice(adminNotice,"Écris une raison avant de fermer le site.","error");return}
 const button=$("#closeSiteBtn");button.disabled=true;
 try{await setMaintenance(true,reason);setNotice(adminNotice,"Site fermé. Les utilisateurs voient maintenant le message de maintenance.","success");}
 catch(error){setNotice(adminNotice,`Fermeture impossible : ${error.message}`,"error");}
 finally{button.disabled=false}
});
$("#reopenSiteBtn").addEventListener("click",async()=>{
 if(!currentUser?.is_admin)return;
 const button=$("#reopenSiteBtn");button.disabled=true;
 try{await setMaintenance(false);setNotice(adminNotice,"Site rouvert avec succès.","success");}
 catch(error){setNotice(adminNotice,`Réouverture impossible : ${error.message}`,"error");}
 finally{button.disabled=false}
});

document.querySelectorAll("[data-theme-preset]").forEach(button=>button.addEventListener("click",()=>{
 const preset=SITE_THEMES[button.dataset.themePreset];
 if(!preset)return;
 applySiteTheme(preset);
}));
$("#siteThemeColor")?.addEventListener("input",event=>applySiteTheme({name:"Personnalisé",color:event.target.value}));
$("#siteThemeForm")?.addEventListener("submit",async event=>{
 event.preventDefault();
 if(!currentUser?.is_admin)return;
 const button=$("#saveSiteTheme"); if(button)button.disabled=true;
 try{await saveSiteTheme();setNotice(adminNotice,"Couleur du site mise à jour pour tout le monde.","success");}
 catch(error){setNotice(adminNotice,`Impossible de changer la couleur : ${error.message}`,"error");}
 finally{if(button)button.disabled=false;}
});

function openAdmin(){
 $("#adminDashboard").hidden=true;$("#adminGate").hidden=false;
 $("#adminUserList").hidden=false;$("#userLogsPanel").hidden=true;
 if(!currentUser){
  $("#adminGateDescription").textContent="Connecte-toi sur la page Connexion avec l’adresse e-mail du compte administrateur et son mot de passe.";
  $("#adminLoginLink").hidden=false;
  setNotice(adminNotice,"Une connexion est requise pour ouvrir la console.");return;
 }
 if(currentUser.is_admin){
  $("#adminGate").hidden=true;$("#adminDashboard").hidden=false;
  setNotice(adminNotice,"Accès administrateur vérifié.","success");
  loadSiteTheme();loadMaintenanceStatus();loadAdminUsers();loadPendingVideos();return;
 }
 $("#adminGateDescription").textContent="Ce compte n’a pas les droits administrateur.";
 $("#adminLoginLink").hidden=false;
 setNotice(adminNotice,"Accès refusé : droits administrateur requis.","error");
}

async function initialize(){
 document.querySelectorAll(".upload-form").forEach(form=>{form.hidden=true});
 // Le rendu du site ne doit jamais dépendre de la disponibilité de Supabase.
 // Les fonctions backend sont chargées en arrière-plan.
 renderAccount();
 try{await refreshSession()}catch(error){console.warn("Session indisponible :",error?.message||error)}
 try{await loadSiteTheme()}catch(error){console.warn("Thème indisponible :",error?.message||error)}
 try{await loadMaintenanceStatus()}catch(error){console.warn("Maintenance indisponible :",error?.message||error)}
 renderMaintenanceStatus();
 setNotice(accountNotice,currentUser?"Session restaurée.":"Inscris-toi ou connecte-toi pour continuer.",currentUser?"success":"info");
 try{await loadFeaturedVideos()}catch(error){console.warn("Vidéos indisponibles :",error?.message||error)}
}
updateFilters();
initialize();
page(currentRoutePage());
