const { app, BrowserWindow, session, shell, ipcMain, dialog } = require('electron');
const path = require('node:path');

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
const isHttp = value => { try { return ['http:', 'https:'].includes(new URL(value).protocol); } catch { return false; } };
function isBlocked(raw) {
  try {
    const host = new URL(raw).hostname.toLowerCase().replace(/^www\./, '');
    return [...BLOCKED_HOSTS].some(domain => host === domain || host.endsWith('.' + domain));
  } catch { return false; }
}

app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.whenReady().then(() => {
  const webSession = session.fromPartition(PARTITION);
  webSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
  webSession.setPermissionCheckHandler(() => false);
  webSession.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*'] }, (details, callback) => {
    callback({ cancel: blockingEnabled && isBlocked(details.url) });
  });
  webSession.on('will-download', (_event, item) => {
    const win = BrowserWindow.getAllWindows()[0];
    const filename = item.getFilename();
    dialog.showSaveDialog(win, { defaultPath: filename }).then(({ canceled, filePath }) => {
      if (canceled || !filePath) { item.cancel(); return; }
      item.setSavePath(filePath);
    }).catch(() => item.cancel());
  });
  createWindow();
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
    if (!isHttp(params.src || 'https://example.com')) event.preventDefault();
  });
}
ipcMain.handle('vyron:blocking:get', () => blockingEnabled);
ipcMain.handle('vyron:blocking:set', (_event, value) => {
  blockingEnabled = Boolean(value);
  return blockingEnabled;
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
