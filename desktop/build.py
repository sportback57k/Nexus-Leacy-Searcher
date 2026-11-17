#!/usr/bin/env python3
"""Build the Monterey/Intel DMG using Apple's tools and a pinned Electron binary."""
import hashlib,json,os,plistlib,shutil,subprocess,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parent
CONFIG=json.loads((ROOT/'electron-runtime.json').read_text())
NAME='Nexus Legacy';BUNDLE_ID='com.nexuslegacy.desktop';VERSION='1.0.0'
BUILD=ROOT/'build';DIST=ROOT/'dist'
CACHE=Path.home()/'Library/Caches/Nexus-Legacy-build'

def run(*args,quiet=False,env=None):
 subprocess.run([str(a) for a in args],check=True,stdout=subprocess.DEVNULL if quiet else None,env=env)
def plist_update(path,values):
 data=plistlib.loads(path.read_bytes());data.update(values);path.write_bytes(plistlib.dumps(data))
def main():
 CACHE.mkdir(parents=True,exist_ok=True);BUILD.mkdir(exist_ok=True);DIST.mkdir(exist_ok=True)
 archive=CACHE/CONFIG['archive']
 if not archive.exists():
  print('Téléchargement du moteur Electron…',flush=True)
  run('curl','-fLSs','--retry','2',f"https://github.com/electron/electron/releases/download/v{CONFIG['version']}/{CONFIG['archive']}",'-o',archive)
 if hashlib.sha256(archive.read_bytes()).hexdigest()!=CONFIG['sha256']:raise RuntimeError('Checksum Electron incorrect')
 print('Archive officielle Electron vérifiée.',flush=True)
 unpacked=BUILD/'runtime'
 if not (unpacked/'Electron.app').exists():
  unpacked.mkdir(exist_ok=True);run('ditto','-x','-k',archive,unpacked,quiet=True)
 binary=unpacked/'Electron.app/Contents/MacOS/Electron'
 env={**os.environ,'ELECTRON_RUN_AS_NODE':'1'}
 actual=subprocess.check_output([str(binary),'-p','process.versions.electron'],env=env,text=True).strip()
 if actual!=CONFIG['version']:raise RuntimeError('Version Electron inattendue : '+actual)
 print('Moteur compatible avec ce Mac : Electron '+actual,flush=True)
 master=BUILD/'NexusIcon.png';iconset=BUILD/'NexusIcon.iconset';iconset.mkdir(exist_ok=True)
 run('xcrun','swift',ROOT/'icon.swift',ROOT.parent/'assets/nexus-logo.png',master,quiet=True)
 for size in [16,32,128,256,512]:
  for scale in [1,2]:
   filename=f'icon_{size}x{size}'+('@2x' if scale==2 else '')+'.png'
   run('sips','-z',str(size*scale),str(size*scale),master,'--out',iconset/filename,quiet=True)
 icon=BUILD/'NexusIcon.icns';run('iconutil','-c','icns',iconset,'-o',icon,quiet=True)
 staging=BUILD/'image';app=staging/(NAME+'.app')
 if staging.exists():shutil.rmtree(staging)
 staging.mkdir();run('ditto',unpacked/'Electron.app',app,quiet=True)
 contents=app/'Contents';main_plist=contents/'Info.plist'
 original=plistlib.loads(main_plist.read_bytes());old_executable=original['CFBundleExecutable']
 (contents/'MacOS'/old_executable).rename(contents/'MacOS'/NAME)
 plist_update(main_plist,{'CFBundleExecutable':NAME,'CFBundleDisplayName':NAME,'CFBundleName':NAME,
  'CFBundleIdentifier':BUNDLE_ID,'CFBundleShortVersionString':VERSION,'CFBundleVersion':'100',
  'CFBundleIconFile':'NexusIcon.icns','LSMinimumSystemVersion':CONFIG['minimumMacOS'],
  'LSApplicationCategoryType':'public.app-category.utilities','NSHighResolutionCapable':True,
  'NSHumanReadableCopyright':'Nexus Legacy'})
 resources=contents/'Resources'
 for leftover in ['default_app.asar','electron.icns']:
  candidate=resources/leftover
  if candidate.exists():candidate.unlink()
 shutil.copy2(icon,resources/'NexusIcon.icns')
 shutil.copytree(ROOT/'app',resources/'app')
 shutil.copy2(ROOT.parent/'assets/nexus-logo.png',resources/'app/nexus-logo.png')
 for license_name in ['LICENSE','LICENSES.chromium.html']:
  source=unpacked/license_name
  if source.exists():shutil.copy2(source,resources/('Electron-'+license_name))
 for helper in list((contents/'Frameworks').glob('Electron Helper*.app')):
  helper_info=helper/'Contents/Info.plist';data=plistlib.loads(helper_info.read_bytes())
  new_name=helper.stem.replace('Electron','Nexus Legacy',1)
  executable=helper/'Contents/MacOS'/data.get('CFBundleExecutable',helper.stem)
  executable.rename(executable.with_name(new_name))
  suffix=helper.stem.replace('Electron Helper','').strip().strip('()').lower()
  plist_update(helper_info,{'CFBundleExecutable':new_name,'CFBundleName':new_name,'CFBundleDisplayName':new_name,
   'CFBundleIdentifier':BUNDLE_ID+'.helper'+('.'+suffix if suffix else '')})
  helper.rename(helper.with_name(new_name+'.app'))
 print('Signature locale de l’application…',flush=True)
 run('codesign','--force','--deep','--sign','-','--timestamp=none',app,quiet=True)
 run('codesign','--verify','--deep','--strict',app,quiet=True)
 (staging/'Applications').symlink_to('/Applications',target_is_directory=True)
 bgimage=BUILD/'Nexus-Installer.png'
 run('xcrun','swift',ROOT/'dmg-background.swift',bgimage,quiet=True)
 (staging/'Installer Nexus Legacy.txt').write_text('''NEXUS LEGACY — INSTALLATION

1. Glisse « Nexus Legacy » dans « Applications ».
2. Ouvre Nexus Legacy depuis Applications ou Spotlight.
3. Connecte-toi avec ton adresse e-mail et le code reçu.

Version 1.0.0 — Mac Intel, macOS Monterey 12 ou ultérieur.
Une connexion Internet est nécessaire. L’application charge le site en ligne :
les comptes, crédits et fonctions admin sont ceux de nexussearcher.vercel.app.

Cette version personnelle dispose d’une signature locale. Elle n’est pas
notarisée par Apple. Si macOS bloque une copie transférée depuis Internet,
utilise clic droit → Ouvrir, ou l’option Ouvrir quand même dans
Préférences Système → Sécurité et confidentialité → Général.
Ne désactive pas les protections de macOS.
''')
 dmg=DIST/f'Nexus-Legacy-{VERSION}-macOS-Intel.dmg'
 print('Préparation de la fenêtre d’installation…',flush=True)
 working=BUILD/'Nexus-Legacy-layout.dmg'
 if working.exists():working.unlink()
 run('hdiutil','create','-volname',NAME,'-srcfolder',staging,'-fs','HFS+','-format','UDRW','-ov',working,quiet=True)
 attached=subprocess.check_output(['hdiutil','attach','-readwrite','-noverify','-nobrowse','-plist',str(working)])
 info=plistlib.loads(attached)
 mountpoint=next(Path(item['mount-point']) for item in info['system-entities'] if 'mount-point' in item)
 device=next(item['dev-entry'] for item in info['system-entities'] if 'mount-point' in item)
 try:
  background=mountpoint/'.background';background.mkdir()
  shutil.copy2(bgimage,background/'Nexus-Installer.png')
  run('chflags','hidden',background,quiet=True)
  apple_script='''tell application "Finder"
  tell disk "Nexus Legacy"
   open
   set theWindow to container window
   set current view of theWindow to icon view
   set toolbar visible of theWindow to false
   set statusbar visible of theWindow to false
   set bounds of theWindow to {120, 80, 1020, 700}
   set icon size of icon view options of theWindow to 128
   set text size of icon view options of theWindow to 14
   set arrangement of icon view options of theWindow to not arranged
   set viewOptions to the icon view options of theWindow
   set background picture of viewOptions to file ".background:Nexus-Installer.png"
   set position of item "Nexus Legacy.app" of theWindow to {265, 360}
   set position of item "Applications" of theWindow to {755, 360}
   delay 2
   close
   open
   update without registering applications
  end tell
 end tell'''
  run('osascript','-e',apple_script,quiet=True)
 finally:run('hdiutil','detach',device,quiet=True)
 print('Compression et vérification du DMG…',flush=True)
 if dmg.exists():dmg.unlink()
 run('hdiutil','convert',working,'-format','UDZO','-imagekey','zlib-level=9','-o',dmg,quiet=True)
 run('hdiutil','verify',dmg,quiet=True)
 digest=hashlib.sha256(dmg.read_bytes()).hexdigest()
 dmg.with_suffix('.dmg.sha256').write_text(digest+'  '+dmg.name+'\n')
 desktop=Path.home()/'Desktop'/dmg.name;shutil.copy2(dmg,desktop)
 working.unlink()
 print('DMG vérifié : '+str(desktop),flush=True)
 print('Application : '+str(app),flush=True)
if __name__=='__main__':main()
