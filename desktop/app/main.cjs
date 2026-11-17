'use strict';
const { app, BrowserWindow, Menu, nativeTheme, session, shell, screen } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const { SITE_URL, SITE_ORIGIN, isSiteURL, isExternalURL } = require('./policy.cjs');
const OFFLINE_PATH = path.join(__dirname, 'offline.html');
const OFFLINE_URL = pathToFileURL(OFFLINE_PATH).href;
let mainWindow = null;
let offlineLoading = false;

app.setName('Nexus Legacy');
if (process.env.NEXUS_TEST_USER_DATA) {
  fs.mkdirSync(process.env.NEXUS_TEST_USER_DATA, { recursive: true });
  app.setPath('userData', process.env.NEXUS_TEST_USER_DATA);
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => {
    if (!mainWindow) createWindow();
    if (mainWindow?.isMinimized()) mainWindow.restore();
    mainWindow?.focus();
  });
  app.whenReady().then(() => {
    nativeTheme.themeSource = 'dark';
    app.setAboutPanelOptions({
      applicationName: 'Nexus Legacy', applicationVersion: app.getVersion(),
      copyright: 'Nexus Legacy',
      credits: 'Le site Nexus Legacy dans une application macOS.\nUne connexion Internet est nécessaire.'
    });
    installMenu();
    createWindow();
    app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
  });
}
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

function openExternal(url) {
  if (isExternalURL(url)) shell.openExternal(url).catch(() => {});
}
function showOffline() {
  if (!mainWindow || mainWindow.isDestroyed() || offlineLoading) return;
  offlineLoading = true;
  mainWindow.loadFile(OFFLINE_PATH).catch(() => {}).finally(() => { offlineLoading = false; });
}
function goHome() { mainWindow?.loadURL(SITE_URL).catch(showOffline); }
function createWindow() {
  const work = screen.getPrimaryDisplay().workAreaSize;
  const browserSession = session.fromPartition('persist:nexus-legacy');
  browserSession.setPermissionRequestHandler((contents, permission, callback) => {
    callback(isSiteURL(contents.getURL()) && ['clipboard-sanitized-write', 'fullscreen'].includes(permission));
  });
  browserSession.setPermissionCheckHandler((contents, permission, requestingOrigin) => {
    return isSiteURL(requestingOrigin) && ['clipboard-sanitized-write', 'fullscreen'].includes(permission);
  });
  browserSession.webRequest.onHeadersReceived({ urls: [`${SITE_ORIGIN}/*`] }, (details, callback) => {
    callback({ responseHeaders: {
      ...details.responseHeaders,
      'Content-Security-Policy': [
        "default-src 'self' https: data: blob:; script-src 'self' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https:; connect-src 'self' https: wss:; img-src 'self' https: data: blob:; media-src 'self' https: blob:; font-src 'self' https: data:; object-src 'none'; base-uri 'self'; frame-src 'none'"
      ]
    }});
  });
  const win = new BrowserWindow({
    title: 'Nexus Legacy', width: Math.min(1360, work.width - 40), height: Math.min(900, work.height - 60),
    minWidth: 760, minHeight: 560, show: false, backgroundColor: '#080808',
    ...(process.platform === 'win32' ? { icon: path.join(__dirname, 'nexus.ico') } : {}),
    autoHideMenuBar: true,
    webPreferences: {
      session: browserSession, nodeIntegration: false, contextIsolation: true,
      sandbox: true, webSecurity: true, allowRunningInsecureContent: false,
      webviewTag: false, spellcheck: true, navigateOnDragDrop: false
    }
  });
  mainWindow = win;
  win.once('ready-to-show', () => win.show());
  win.on('closed', () => { if (mainWindow === win) mainWindow = null; });
  win.webContents.on('page-title-updated', event => { event.preventDefault(); win.setTitle('Nexus Legacy'); });
  win.webContents.on('will-navigate', (event, url) => {
    url = event.url || url;
    if (!isSiteURL(url) && url !== OFFLINE_URL) { event.preventDefault(); openExternal(url); }
  });
  win.webContents.on('will-redirect', (event, url) => {
    url = event.url || url;
    if (!isSiteURL(url)) { event.preventDefault(); openExternal(url); }
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isSiteURL(url)) win.loadURL(url).catch(showOffline);
    else openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-attach-webview', event => event.preventDefault());
  win.webContents.on('did-fail-load', (_event, errorCode, _description, _url, isMainFrame) => {
    if (isMainFrame && errorCode !== -3) showOffline();
  });
  goHome();
}
function installMenu() {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'Nexus Legacy', submenu: [
      { label: 'À propos de Nexus Legacy', role: 'about' }, { type: 'separator' },
      { label: 'Masquer Nexus Legacy', role: 'hide' }, { label: 'Masquer les autres', role: 'hideOthers' },
      { label: 'Tout afficher', role: 'unhide' }, { type: 'separator' }, { label: 'Quitter Nexus Legacy', role: 'quit' }
    ]},
    { label: 'Édition', submenu: [
      { label: 'Annuler', role: 'undo' }, { label: 'Rétablir', role: 'redo' }, { type: 'separator' },
      { label: 'Couper', role: 'cut' }, { label: 'Copier', role: 'copy' }, { label: 'Coller', role: 'paste' },
      { label: 'Tout sélectionner', role: 'selectAll' }
    ]},
    { label: 'Navigation', submenu: [
      { label: 'Accueil Nexus', accelerator: 'CmdOrCtrl+Shift+H', click: goHome },
      { label: 'Recharger', accelerator: 'CmdOrCtrl+R', click: () => mainWindow?.webContents.reload() },
      { label: 'Précédent', accelerator: 'Alt+Left', click: () => {
        if (mainWindow?.webContents.navigationHistory.canGoBack()) mainWindow.webContents.navigationHistory.goBack();
      }},
      { label: 'Suivant', accelerator: 'Alt+Right', click: () => {
        if (mainWindow?.webContents.navigationHistory.canGoForward()) mainWindow.webContents.navigationHistory.goForward();
      }},
      { type: 'separator' },
      { label: 'Ouvrir dans le navigateur', click: () => openExternal(SITE_URL) }
    ]},
    { label: 'Affichage', submenu: [
      { label: 'Taille réelle', role: 'resetZoom' }, { label: 'Agrandir', role: 'zoomIn' },
      { label: 'Réduire', role: 'zoomOut' }, { label: 'Plein écran', role: 'togglefullscreen' }
    ]},
    { label: 'Fenêtre', submenu: [{ label: 'Réduire', role: 'minimize' }, { label: 'Fermer', role: 'close' }, { role: 'front' }] }
  ]));
}
