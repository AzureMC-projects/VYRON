const { app, BrowserWindow, session, shell, ipcMain, dialog } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const { ElectronBlocker } = require('@ghostery/adblocker-electron');
const fetch = require('cross-fetch');

const PARTITION = 'persist:vyron';
const BLOCKED_HOSTS = new Set([
  'doubleclick.net', 'googlesyndication.com', 'googleadservices.com',
  'google-analytics.com', 'googletagmanager.com', 'adservice.google.com',
  'facebook.net', 'connect.facebook.net', 'adnxs.com', 'adsrvr.org',
  'hotjar.com', 'taboola.com', 'outbrain.com', 'scorecardresearch.com',
  'criteo.com', 'casalemedia.com', 'quantserve.com', 'moatads.com',
  'rubiconproject.com', 'pubmatic.com', 'openx.net', 'adform.net'
]);
let blockingEnabled = true;
let adblocker = null;
let usingFullFilterLists = false;
const isHttp = value => { try { return ['http:', 'https:'].includes(new URL(value).protocol); } catch { return false; } };
function isBlocked(raw) {
  try {
    const host = new URL(raw).hostname.toLowerCase().replace(/^www\./, '');
    return [...BLOCKED_HOSTS].some(domain => host === domain || host.endsWith('.' + domain));
  } catch { return false; }
}
function installFallbackBlocking(webSession) {
  webSession.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*'] }, (details, callback) => {
    callback({ cancel: blockingEnabled && isBlocked(details.url) });
  });
}
async function initialiseBlocking(webSession) {
  installFallbackBlocking(webSession);
  try {
    // Load maintained, prebuilt advertising and tracking filter lists.
    const blocker = await ElectronBlocker.fromPrebuiltAdsAndTracking(fetch, {\n      path: path.join(app.getPath('userData'), 'adblock-engine.bin'),\n      read: fs.readFile,\n      write: fs.writeFile\n    });
    webSession.webRequest.onBeforeRequest(null);
    if (blockingEnabled) blocker.enableBlockingInSession(webSession);
    adblocker = blocker;
    usingFullFilterLists = true;
    for (const win of BrowserWindow.getAllWindows()) win.webContents.send('vyron:blocking:status', { enabled: blockingEnabled, fullFilterLists: true });
  } catch (error) {
    // Offline startup remains functional with the bundled emergency domain list.
    console.warn('VYRON filter lists unavailable; using built-in domain list.', error?.message || error);
    for (const win of BrowserWindow.getAllWindows()) win.webContents.send('vyron:blocking:status', { enabled: blockingEnabled, fullFilterLists: false });
  }
}
app.whenReady().then(async () => {
  const webSession = session.fromPartition(PARTITION);
  webSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
  webSession.setPermissionCheckHandler(() => false);
  webSession.on('will-download', (_event, item) => {
    const win = BrowserWindow.getAllWindows()[0];
    const filename = item.getFilename();
    dialog.showSaveDialog(win, { defaultPath: filename }).then(({ canceled, filePath }) => {
      if (canceled || !filePath) { item.cancel(); return; }
      item.setSavePath(filePath);
    }).catch(() => item.cancel());
  });
  createWindow();
  initialiseBlocking(webSession).catch(error => console.error('Blocking setup failed:', error));
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
function createWindow() {
  const win = new BrowserWindow({
    width: 1440, height: 920, minWidth: 780, minHeight: 580,
    backgroundColor: '#0b0d12', title: 'VYRON',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false, sandbox: true,
      webviewTag: true, webSecurity: true, allowRunningInsecureContent: false
    }
  });
  win.loadFile(path.join(__dirname, 'index.html'));
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isHttp(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file://')) event.preventDefault();
  });
  win.webContents.on('will-attach-webview', (event, prefs, params) => {
    delete prefs.preload;
    prefs.nodeIntegration = false;
    prefs.contextIsolation = true;
    prefs.sandbox = true;
    prefs.webSecurity = true;
    prefs.allowRunningInsecureContent = false;
    prefs.plugins = false;
    if (params.src !== 'about:blank' && !isHttp(params.src || '')) event.preventDefault();
  });
}
ipcMain.handle('vyron:blocking:get', () => ({ enabled: blockingEnabled, fullFilterLists: usingFullFilterLists }));
ipcMain.handle('vyron:blocking:set', (_event, value) => {
  blockingEnabled = Boolean(value);
  const webSession = session.fromPartition(PARTITION);
  if (adblocker) {
    if (blockingEnabled) adblocker.enableBlockingInSession(webSession);
    else adblocker.disableBlockingInSession(webSession);
  }
  return { enabled: blockingEnabled, fullFilterLists: usingFullFilterLists };
});
ipcMain.handle('vyron:data:clear', async () => {
  const ses = session.fromPartition(PARTITION);
  await ses.clearStorageData();
  await ses.clearCache();
  return true;
});
ipcMain.handle('vyron:app:version', () => app.getVersion());
app.on('web-contents-created', (_event, contents) => {
  contents.on('will-attach-webview', (event, prefs) => {
    delete prefs.preload;
    prefs.nodeIntegration = false;
    prefs.contextIsolation = true;
    prefs.sandbox = true;
  });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
