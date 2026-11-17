"""Run the real macOS app with isolated data and inspect it through local CDP.
Requires playwright (already used for the website verification). No emails are sent.
"""
import re,json,os,subprocess,tempfile,time,urllib.request,shutil,sys
from pathlib import Path
from playwright.sync_api import sync_playwright, Error
ROOT=Path(__file__).resolve().parents[1]
BUNDLE=ROOT/'build/image/Nexus Legacy.app'
BINARY=BUNDLE/'Contents/MacOS/Nexus Legacy'
profile=Path(tempfile.mkdtemp(prefix='nexus-desktop-test-'))
log=profile/'electron.log'
process=None
passed=False
try:
 with log.open('w') as stream:
  process=subprocess.Popen([str(BINARY),'--remote-debugging-port=19327'],env={**os.environ,'NEXUS_TEST_USER_DATA':str(profile)},stdout=stream,stderr=stream)
  for attempt in range(60):
   if process.poll() is not None:raise RuntimeError('Application stopped before startup: '+log.read_text()[-1500:])
   try:
    with urllib.request.urlopen('http://127.0.0.1:19327/json/version',timeout=1) as r:
     endpoint=json.load(r)['webSocketDebuggerUrl']
    break
   except Exception:time.sleep(.5)
  else:raise RuntimeError('CDP not available: '+log.read_text()[-1500:])
  with sync_playwright() as p:
   browser=p.chromium.connect_over_cdp(endpoint)
   context=browser.contexts[0]
   page=context.pages[0] if context.pages else context.new_page()
   errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
   page.wait_for_url('https://nexussearcher.vercel.app/**',timeout=30000)
   page.wait_for_selector('#fields [data-key]',state='attached',timeout=30000)
   assert page.evaluate('typeof require')=='undefined'
   assert page.evaluate('typeof process')=='undefined'
   assert page.evaluate('typeof window.electron')=='undefined'
   if page.locator('#accountResetDialog').evaluate('(d)=>d.open'):page.locator('#resetUnderstood').click()
   page.screenshot(path='/tmp/nexus-legacy-mac-app.png')
   page.get_by_role('button',name='Connexion',exact=True).click()
   page.wait_for_url(re.compile(r'https://nexussearcher\.vercel\.app/connexion/?$'))
   page.wait_for_selector('#signupForm:not([hidden])')
   page.get_by_role('button',name='Admin',exact=True).click()
   page.wait_for_url(re.compile(r'https://nexussearcher\.vercel\.app/admin/?$'))
   page.wait_for_selector('#adminGate:not([hidden])')
   assert page.locator('#adminDashboard').is_hidden()
   # Persistent partition survives ordinary route changes.
   page.evaluate("localStorage.setItem('nexus_desktop_smoke','ok')")
   page.goto('https://nexussearcher.vercel.app/recherche/')
   assert page.evaluate("localStorage.getItem('nexus_desktop_smoke')")=='ok'
   # A canceled request sends the main frame to the packaged offline screen.
   page.route('https://nexussearcher.vercel.app/offline-smoke-test',lambda r:r.abort('internetdisconnected'))
   try:page.goto('https://nexussearcher.vercel.app/offline-smoke-test',timeout=15000)
   except Error:pass
   page.wait_for_url('file://**/offline.html',timeout=15000)
   assert page.get_by_role('heading',name='Retrouvons la connexion.').is_visible()
   page.unroute('https://nexussearcher.vercel.app/offline-smoke-test')
   page.get_by_role('link',name='Réessayer').click()
   page.wait_for_url(re.compile(r'https://nexussearcher\.vercel\.app/accueil/?$'),timeout=30000)
   page.wait_for_selector('#fields [data-key]',state='attached')
   assert not errors,errors
   browser.close()
 passed=True
 print('PASS: app Monterey/Intel, site réel, formulaires, navigation, session persistante, sandbox Node et reconnexion')
finally:
 if process and process.poll() is None:
  process.terminate()
  try:process.wait(timeout=15)
  except subprocess.TimeoutExpired:process.kill();process.wait()
 if passed:shutil.rmtree(profile,ignore_errors=True)
 else:print('Diagnostic conservé dans :',profile)
