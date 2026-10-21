import ctypes, json, re
from pathlib import Path
from html.parser import HTMLParser
root=Path(__file__).resolve().parents[1]
j=ctypes.CDLL('/System/Library/Frameworks/JavaScriptCore.framework/JavaScriptCore'); p=ctypes.c_void_p
j.JSGlobalContextCreate.argtypes=[p];j.JSGlobalContextCreate.restype=p
j.JSStringCreateWithUTF8CString.argtypes=[ctypes.c_char_p];j.JSStringCreateWithUTF8CString.restype=p
j.JSEvaluateScript.argtypes=[p,p,p,p,ctypes.c_int,ctypes.POINTER(p)];j.JSEvaluateScript.restype=p
j.JSValueToStringCopy.argtypes=[p,p,ctypes.POINTER(p)];j.JSValueToStringCopy.restype=p
j.JSStringGetMaximumUTF8CStringSize.argtypes=[p];j.JSStringGetMaximumUTF8CStringSize.restype=ctypes.c_size_t
j.JSStringGetUTF8CString.argtypes=[p,ctypes.c_char_p,ctypes.c_size_t];j.JSStringGetUTF8CString.restype=ctypes.c_size_t
ctx=j.JSGlobalContextCreate(None)
def evaluate(source):
 exc=p(); result=j.JSEvaluateScript(ctx,j.JSStringCreateWithUTF8CString(source.encode()),None,None,1,ctypes.byref(exc))
 st=j.JSValueToStringCopy(ctx,exc if exc else result,None); n=j.JSStringGetMaximumUTF8CStringSize(st);buf=ctypes.create_string_buffer(n);j.JSStringGetUTF8CString(st,buf,n)
 if exc: raise AssertionError(buf.value.decode())
 return buf.value.decode()
for file in ['js/app.js','js/interface.js']:
 evaluate('new Function('+json.dumps((root/file).read_text())+'); "OK"')
 print('Syntax OK:',file)
class Page(HTMLParser):
 def __init__(self): super().__init__();self.ids=[];self.refs=[];self.assets=[]
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if 'id' in a:self.ids.append(a['id'])
  for key in ['aria-labelledby','aria-controls']:
   if key in a:self.refs.extend(a[key].split())
  if tag in ['script','link','img']:
   value=a.get('src',a.get('href',''))
   if value.startswith('/'):self.assets.append(value.split('?')[0])
pages=[root/'index.html',*root.glob('*/index.html')]
for path in pages:
 parser=Page();parser.feed(path.read_text())
 assert len(parser.ids)==len(set(parser.ids)),path
 assert all(ref in parser.ids for ref in parser.refs),path
 assert all((root/asset.lstrip('/')).exists() for asset in parser.assets),path
 assert path.read_text().split('<section id="search"')[1].split('<section id="discord"')[0] == pages[0].read_text().split('<section id="search"')[1].split('<section id="discord"')[0],path
print('8 HTML routes: consistent search markup, unique IDs, valid ARIA targets and local assets')
# Execute actual presentation code with a minimal in-memory DOM, without a backend.
harness=r'''
function assert(ok,message){if(!ok)throw Error(message)}
class Element {
 constructor(tag='div'){this.tagName=tag.toUpperCase();this.value='';this.textContent='';this.children=[];this.attrs={};this.events={};this.hidden=false;this.style={setProperty(){}};this.flags=new Set();this.classList={toggle:(c,on)=>{on=on===undefined?!this.flags.has(c):on;on?this.flags.add(c):this.flags.delete(c);return on},add:c=>this.flags.add(c),remove:c=>this.flags.delete(c),contains:c=>this.flags.has(c)};}
 setAttribute(k,v){this.attrs[k]=String(v)} getAttribute(k){return this.attrs[k]}
 append(...items){this.children.push(...items)} appendChild(item){if(item.tagName==='FRAGMENT')this.children.push(...item.children);else this.children.push(item);return item}
 replaceChildren(...items){this.children=items} get childElementCount(){return this.children.length}
 addEventListener(type,fn){(this.events[type]??=[]).push(fn)} dispatchEvent(e){e.target??=this;(this.events[e.type]||[]).forEach(fn=>fn(e))}
 click(){this.dispatchEvent({type:'click'})} focus(){document.activeElement=this}
 before(item){this.owner.badge=item}
 querySelectorAll(selector){if(selector==='.result')return this.children.filter(c=>c.className==='result');return []}
}
const ids={};for(const id of ['criterionTabs','criterionFinder','activeFilters','output','resultFinder','noCriteria','resultSummary','resultTools','fields','clear','searchBtn','search','state','count','results-title'])ids[id]=new Element();
ids.search.classList.add('active');ids['results-title'].closest=()=>ids.results;
ids.results=new Element();
const sections=[];
function addGroup(title,names,extra=false){
 const section=new Element();section.title=new Element();section.title.textContent=title;
 section.toggle=new Element('button');section.toggle.setAttribute('aria-expanded',sections.length===0?'true':'false');section.content=new Element();section.content.hidden=sections.length!==0;
 section.extra=extra?new Element('details'):null;if(section.extra)section.extra.open=false;
 section.chevron=new Element();section.chevron.owner=section;
 section.inputs=names.map(([label,key])=>{const input=new Element('input');input.dataset={key};input.label=new Element('label');input.label.caption=new Element();input.label.caption.textContent=label;input.label.querySelector=()=>input.label.caption;input.closest=()=>input.label;input.label.input=input;return input});
 section.querySelector=s=>({'.group-title':section.title,'.group-toggle':section.toggle,'.group-content':section.content,'details':section.extra,'.group-chevron':section.chevron,'.group-badge':section.badge})[s];
 section.querySelectorAll=s=>s==='[data-key]'?section.inputs:section.inputs.map(i=>i.label);
 sections.push(section);return section;
}
const identity=addGroup('Identité',[['Nom','nom_famille'],['Prénom','prenom']]);
const locationGroup=addGroup('Localisation',[['Ville','ville'],['Département','departement']],true);
const views=['list','grid'].map(view=>{const button=new Element('button');button.dataset={resultView:view};return button});
const document={activeElement:null,querySelector:s=>ids[s.slice(1)],querySelectorAll:s=>s==='#fields .group'?sections:s==='[data-result-view]'?views:[],createElement:tag=>new Element(tag),createTextNode:text=>({textContent:text}),createDocumentFragment:()=>new Element('fragment'),addEventListener(){}};
const window={matchMedia:()=>({matches:false})};
class Event {constructor(type,options){this.type=type}}
let searches=0;ids.searchBtn.addEventListener('click',()=>searches++);
'''
evaluate(harness+(root/'js/interface.js').read_text()+'; "Interface initialized"')
checks=r'''
assert(identity.badge.textContent===2,'Category counts');
ids.criterionTabs.children[2].click();
assert(identity.hidden&&!locationGroup.hidden&&!locationGroup.content.hidden,'Category button filters and expands');
ids.criterionTabs.children[0].click();
assert(!identity.hidden&&!locationGroup.hidden&&!identity.content.hidden&&locationGroup.content.hidden,'All categories restores expansion');
identity.inputs[0].value='Démo';
window.NexusInterface.updateFilters();
assert(ids.activeFilters.childElementCount===1&&!ids.activeFilters.hidden,'Active criterion chip');
assert(identity.flags.has('has-value'),'Filled category state');
ids.activeFilters.children[0].click();
assert(identity.inputs[0].value==='','Chip removes criterion');
ids.criterionFinder.value='departement';ids.criterionFinder.dispatchEvent(new Event('input'));
assert(identity.hidden&&!locationGroup.hidden,'Accent-insensitive criterion search');
assert(!locationGroup.content.hidden&&locationGroup.extra.open,'Matching advanced category expands');
ids.criterionFinder.value='inexistant';ids.criterionFinder.dispatchEvent(new Event('input'));
assert(!ids.noCriteria.hidden,'No criterion match');
ids.criterionFinder.value='';ids.criterionFinder.dispatchEvent(new Event('input'));
assert(!identity.content.hidden&&locationGroup.content.hidden&&!locationGroup.extra.open,'Expansion restored after filter');
views[1].click();assert(ids.output.flags.has('grid-view')&&views[1].attrs['aria-pressed']==='true','Grid switch');
const card1=new Element();card1.className='result';card1.textContent='Camille Démo Paris';
const card2=new Element();card2.className='result';card2.textContent='Alex Exemple Lyon';
ids.output.append(card1,card2);window.NexusInterface.updateResults();
ids.resultFinder.value='demo';ids.resultFinder.dispatchEvent(new Event('input'));
assert(!card1.hidden&&card2.hidden&&ids.resultSummary.textContent.includes('1 fiche'),'Local result filtering');
ids.resultFinder.value='absent';ids.resultFinder.dispatchEvent(new Event('input'));
assert(ids.resultSummary.textContent.includes('Aucune fiche'),'Empty local results');
ids.fields.dispatchEvent({type:'keydown',key:'Enter',target:{matches:()=>true},preventDefault(){}});
assert(searches===1,'Enter triggers search');
'Criterion search, chips, advanced expansion, keyboard and result views/filter: OK';
'''
print(evaluate(checks))
app=(root/'js/app.js').read_text()
functions=app[app.index('function isDisplayableResultField'):app.index('function formatResultForCopy')]
evaluate('const $=s=>document.querySelector(s); const esc=value=>String(value??"").replace(/[&<>"\']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",\'"\':"&quot;","\'":"&#39;"}[char])); let currentResults=[]; const fieldLabels={email:"Email"}; const fieldIcons={}; function makeIcon(){return new Element("svg")};'+functions+'; "Render functions loaded"')
print(evaluate(r'''
showResults([{prenom:'Camille',nom_famille:'Démo',email:'<img src=x onerror=alert(1)>',_internal:'secret',metadata:{raw:'hidden'}}]);
assert(currentResults.length===1&&ids.output.childElementCount===1,'Result card created');
const resultCard=ids.output.children[0];
assert(resultCard.innerHTML.includes('Camille Démo')&&resultCard.innerHTML.includes('CD'),'Title and initials');
const dl=resultCard.children[0];assert(dl.tagName==='DL'&&dl.childElementCount===3,'Semantic fields and hidden metadata');
assert(dl.children[2].children[1].textContent==='<img src=x onerror=alert(1)>','Result values inserted as text');
showResults([{nom_affichage:'<script>alert(1)</script>'}]);
assert(!ids.output.children[0].innerHTML.includes('<script>'),'Result title safely escaped');
showResults([]);assert(ids.output.childElementCount===0&&!ids.resultTools.hidden===false&&!ids.state.flags.has('hide'),'Empty results reset');
'Result rendering, safe text, metadata exclusion and empty state: OK';
'''))
