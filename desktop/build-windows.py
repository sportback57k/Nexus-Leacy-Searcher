#!/usr/bin/env python3
"""Package a portable Windows x64 app from the official pinned Electron runtime."""
import hashlib
import json
import shutil
import struct
import subprocess
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PROJECT = ROOT.parent
CONFIG = json.loads((ROOT / 'electron-windows-runtime.json').read_text())
CACHE = Path.home() / 'Library/Caches/Nexus-Legacy-build'
DESKTOP = Path.home() / 'Desktop'
DIST = DESKTOP / 'Nexus-Legacy-Windows-x64'
APP = DIST / 'Nexus Legacy'
ARCHIVE = CACHE / CONFIG['archive']


def main():
    CACHE.mkdir(parents=True, exist_ok=True)
    if not ARCHIVE.exists():
        print('Téléchargement du moteur Windows officiel…', flush=True)
        subprocess.run([
            'curl', '-fLSs', '--retry', '2',
            f"https://github.com/electron/electron/releases/download/v{CONFIG['version']}/{CONFIG['archive']}",
            '-o', str(ARCHIVE)
        ], check=True)
    digest = hashlib.sha256(ARCHIVE.read_bytes()).hexdigest()
    if digest != CONFIG['sha256']:
        raise RuntimeError('La vérification SHA-256 du moteur Electron Windows a échoué.')
    print('Archive Electron Windows authentique et vérifiée.', flush=True)

    if DIST.exists():
        shutil.rmtree(DIST)
    APP.mkdir(parents=True)
    with zipfile.ZipFile(ARCHIVE) as archive:
        for member in archive.infolist():
            target = (APP / member.filename).resolve()
            if target != APP.resolve() and APP.resolve() not in target.parents:
                raise RuntimeError('Chemin inattendu dans l’archive Electron.')
        archive.extractall(APP)
    shutil.copytree(ROOT / 'app', APP / 'resources' / 'app')
    shutil.copy2(PROJECT / 'assets' / 'nexus-logo.png', APP / 'resources' / 'app' / 'nexus-logo.png')

    # Package the site's monochrome app icon as a standard Windows PNG-backed ICO.
    icon_png = DIST / 'nexus-icon.png'
    subprocess.run(['xcrun', 'swift', str(ROOT / 'icon.swift'),
                    str(PROJECT / 'assets/nexus-logo.png'), str(icon_png)], check=True,
                   stdout=subprocess.DEVNULL)
    icon_256 = DIST / 'nexus-icon-256.png'
    subprocess.run(['sips', '-z', '256', '256', str(icon_png), '--out', str(icon_256)],
                   check=True, stdout=subprocess.DEVNULL)
    png_data = icon_256.read_bytes()
    ico = struct.pack('<HHH', 0, 1, 1)
    ico += struct.pack('<BBBBHHII', 0, 0, 0, 0, 1, 32, len(png_data), 22)
    (APP / 'resources/app/nexus.ico').write_bytes(ico + png_data)
    icon_png.unlink()
    icon_256.unlink()

    electron = APP / 'electron.exe'
    if not electron.is_file():
        raise RuntimeError('electron.exe absent du moteur Windows officiel.')
    default_app = APP / 'resources' / 'default_app.asar'
    if default_app.exists():
        default_app.unlink()
    electron.rename(APP / 'Nexus Legacy.exe')

    (DIST / 'LIRE AVANT.txt').write_text('''NEXUS LEGACY — VERSION PORTABLE WINDOWS

Lance « Nexus Legacy.exe » pour ouvrir l’application.
Garde tout le dossier « Nexus Legacy » ensemble : le programme utilise
les fichiers Electron et les bibliothèques qui s’y trouvent.

Version 1.0.0 — Windows 10/11 64 bits.
Une connexion Internet et le code de connexion envoyé à ton adresse e-mail
sont nécessaires. Les comptes, crédits et fonctions admin sont ceux de
https://nexussearcher.vercel.app.

Cette version portable n’est pas signée par Microsoft. Windows SmartScreen
peut afficher un avertissement lors du premier lancement.
''', encoding='utf-8')
    archive_path = DESKTOP / 'Nexus-Legacy-1.0.0-Windows-x64-Portable.zip'
    if archive_path.exists():
        archive_path.unlink()
    shutil.make_archive(str(archive_path.with_suffix('')), 'zip', root_dir=DESKTOP,
                        base_dir=DIST.name)
    print(f'Application : {APP / "Nexus Legacy.exe"}', flush=True)
    print(f'Paquet portable : {archive_path}', flush=True)


if __name__ == '__main__':
    main()
