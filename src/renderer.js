const $ = id => document.getElementById(id);
const viewport = $('viewport');
const tabsNode = $('tabs');
const settings = $('settingsPanel');
const status = $('statusText');
const PREFS_KEY = 'vyron-preferences-v1';
const BOOKMARKS_KEY = 'vyron-bookmarks-v1';
const HISTORY_KEY = 'vyron-history-v1';
const defaults = { theme: 'midnight', accent: '#8b7cff', density: 'comfortable', reduceMotion: false, searchEngine: 'duckduckgo' };
let prefs = { ...defaults };
let bookmarks = [];
let historyItems = [];
let tabs = [];
let activeId = 0;
let nextId = 1;
let blockingEnabled = true;
try { prefs = { ...defaults, ...JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') }; } catch {}
try { bookmarks = JSON.parse(localStorage.getItem(BOOKMARKS_KEY) || '[]'); if (!Array.isArray(bookmarks)) bookmarks = []; } catch {}
try { historyItems = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); if (!Array.isArray(historyItems)) historyItems = []; } catch {}

function persistPrefs() { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); }
function applyPrefs() {
  document.body.dataset.theme = prefs.theme === 'midnight' ? '' : prefs.theme;
  document.body.dataset.density = prefs.density;
  document.body.classList.toggle('reduce-motion', !!prefs.reduceMotion);
  document.documentElement.style.setProperty('--accent', prefs.accent);
  $('themeSelect').value = prefs.theme;
  $('accentSelect').value = prefs.accent;
  $('densitySelect').value = prefs.density;
  $('motionToggle').checked = !!prefs.reduceMotion;
  if ($('searchEngine')) $('searchEngine').value = prefs.searchEngine;
}
function searchUrl(query) {
  const engines = {
    duckduckgo: 'https://duckduckgo.com/?q=',
    google: 'https://www.google.com/search?q=',
    bing: 'https://www.bing.com/search?q='
  };
  return (engines[prefs.searchEngine] || engines.duckduckgo) + encodeURIComponent(query);
}
function parseAddress(input) {
  const value = input.trim();
  if (!value || /^(javascript|data|file|vbscript):/i.test(value)) return null;
  if (/^https?:\/\//i.test(value)) {
    try { const u = new URL(value); return ['http:', 'https:'].includes(u.protocol) ? u.href : null; } catch { return null; }
  }
  if (!value.includes(' ') && /^[\w.-]+\.[a-z]{2,}(:\d+)?([/?#].*)?$/i.test(value)) return 'https://' + value;
  return searchUrl(value);
}
function current() { return tabs.find(t => t.id === activeId); }
function safeHost(url) { try { return new URL(url).hostname; } catch { return url; } }
function renderTabs() {
  tabsNode.replaceChildren();
  for (const tab of tabs) {
    const button = document.createElement('button');
    button.className = 'tab' + (tab.id === activeId ? ' active' : '');
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-selected', String(tab.id === activeId));
    const label = document.createElement('span');
    label.className = 'tab-title';
    label.textContent = tab.title;
    const close = document.createElement('span');
    close.className = 'tab-close';
    close.textContent = '×';
    close.title = 'Close tab';
    close.onclick = event => { event.stopPropagation(); closeTab(tab.id); };
    button.append(label, close);
    button.onclick = () => activate(tab.id);
    tabsNode.appendChild(button);
  }
}
function renderBookmarks() {
  const list = $('bookmarkList');
  if (!list) return;
  list.replaceChildren();
  if (!bookmarks.length) {
    const empty = document.createElement('span');
    empty.className = 'muted';
    empty.textContent = 'Pages you save will appear here.';
    list.appendChild(empty);
    return;
  }
  for (const item of bookmarks) {
    const button = document.createElement('button');
    button.className = 'bookmark-item';
    button.title = item.url;
    const title = document.createElement('strong');
    title.textContent = item.title || safeHost(item.url);
    const host = document.createElement('small');
    host.textContent = safeHost(item.url);
    button.append(title, host);
    button.onclick = () => navigate(current(), item.url);
    list.appendChild(button);
  }
}
function persistBookmarks() {
  localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(bookmarks));
  renderBookmarks();
}
function toggleBookmark() {
  const tab = current();
  if (!tab || tab.start || !/^https?:\/\//i.test(tab.url)) {
    status.textContent = 'Open a web page before bookmarking it';
    return;
  }
  const index = bookmarks.findIndex(b => b.url === tab.url);
  if (index >= 0) {
    bookmarks.splice(index, 1);
    status.textContent = 'Bookmark removed';
  } else {
    bookmarks.unshift({ title: tab.title || safeHost(tab.url), url: tab.url });
    status.textContent = 'Bookmark saved';
  }
  persistBookmarks();
  updateBookmarkButton();
}
function updateBookmarkButton() {
  const tab = current();
  const saved = !!tab && bookmarks.some(b => b.url === tab.url);
  $('bookmarkButton').textContent = saved ? '★' : '☆';
  $('bookmarkButton').style.color = saved ? 'var(--accent)' : '';
}
function addHistory(url, title) {
  if (!/^https?:\/\//i.test(url)) return;
  historyItems = [{ url, title: title || safeHost(url), visitedAt: Date.now() }, ...historyItems.filter(item => item.url !== url)].slice(0, 500);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(historyItems));
}
function activate(id) {
  activeId = id;
  for (const t of tabs) t.view.style.display = t.id === id && !t.start ? 'flex' : 'none';
  const tab = current();
  viewport.classList.toggle('has-page', !!tab && !tab.start);
  $('startPage').style.display = tab && tab.start ? 'flex' : 'none';
  $('address').value = tab && tab.url ? tab.url : '';
  $('securityIcon').textContent = tab && tab.url && tab.url.startsWith('https://') ? '▣' : '◈';
  renderTabs();
  updateBookmarkButton();
}
function createTab(url) {
  const id = nextId++;
  const view = document.createElement('webview');
  view.className = 'browser-view';
  view.setAttribute('partition', 'persist:vyron');
  view.setAttribute('allowpopups', 'false');
  view.setAttribute('webpreferences', 'contextIsolation=yes,sandbox=yes,nodeIntegration=no');
  view.setAttribute('src', 'about:blank');
  view.style.display = 'none';
  viewport.appendChild(view);
  const tab = { id, view, title: 'New tab', url: '', start: true };
  tabs.push(tab);
  view.addEventListener('page-title-updated', e => {
    tab.title = e.title || safeHost(tab.url) || 'New tab';
    renderTabs();
    if (id === activeId) updateBookmarkButton();
  });
  view.addEventListener('did-navigate', e => {
    tab.url = e.url;
    if (id === activeId) { $('address').value = e.url; updateBookmarkButton(); }
    addHistory(e.url, tab.title);
  });
  view.addEventListener('did-navigate-in-page', e => {
    tab.url = e.url;
    if (id === activeId) { $('address').value = e.url; updateBookmarkButton(); }
  });
  view.addEventListener('did-start-loading', () => { if (id === activeId) status.textContent = 'Loading…'; });
  view.addEventListener('did-stop-loading', () => { if (id === activeId) status.textContent = 'Ready'; });
  view.addEventListener('did-fail-load', e => {
    if (id === activeId && e.errorCode !== -3) status.textContent = 'Could not load page. Check the address or connection.';
  });
  view.addEventListener('will-navigate', e => { if (!/^https?:\/\//i.test(e.url)) e.preventDefault(); });
  view.addEventListener('new-window', e => { const safe = parseAddress(e.url); if (safe) createTab(safe); });
  activate(id);
  if (url) navigate(tab, url);
  return tab;
}
function navigate(tab, url) {
  if (!tab || !url || !/^https?:\/\//i.test(url)) {
    status.textContent = 'Only HTTP and HTTPS addresses are allowed';
    return;
  }
  tab.start = false;
  tab.url = url;
  tab.title = safeHost(url);
  activate(tab.id);
  tab.view.style.display = 'flex';
  tab.view.loadURL(url);
  status.textContent = 'Opening page…';
}
function submit(value) {
  const url = parseAddress(value);
  if (!url) { status.textContent = 'Enter a valid address or search'; return; }
  navigate(current(), url);
}
function closeTab(id) {
  const i = tabs.findIndex(t => t.id === id);
  if (i < 0) return;
  tabs[i].view.remove();
  tabs.splice(i, 1);
  if (!tabs.length) { createTab(); return; }
  if (id === activeId) activate(tabs[Math.max(0, i - 1)].id);
  renderTabs();
}
$('addressForm').addEventListener('submit', e => { e.preventDefault(); submit($('address').value); });
$('startSearch').addEventListener('submit', e => { e.preventDefault(); submit($('startAddress').value); });
$('newTab').addEventListener('click', () => createTab());
$('homeButton').addEventListener('click', () => {
  const tab = current(); if (!tab) return;
  tab.start = true; tab.url = ''; tab.title = 'New tab'; tab.view.stop();
  activate(tab.id); status.textContent = 'Start page';
});
$('back').addEventListener('click', () => { const t = current(); if (t && t.view.canGoBack()) t.view.goBack(); });
$('forward').addEventListener('click', () => { const t = current(); if (t && t.view.canGoForward()) t.view.goForward(); });
$('reload').addEventListener('click', () => { const t = current(); if (t && !t.start) t.view.reload(); });
$('bookmarkButton').addEventListener('click', toggleBookmark);
$('clearBookmarks').addEventListener('click', () => { bookmarks = []; persistBookmarks(); updateBookmarkButton(); status.textContent = 'Bookmarks cleared'; });
$('settingsButton').addEventListener('click', () => { settings.hidden = !settings.hidden; });
$('closeSettings').addEventListener('click', () => { settings.hidden = true; });
$('themeSelect').addEventListener('change', e => { prefs.theme = e.target.value; persistPrefs(); applyPrefs(); });
$('accentSelect').addEventListener('input', e => { prefs.accent = e.target.value; persistPrefs(); applyPrefs(); });
$('densitySelect').addEventListener('change', e => { prefs.density = e.target.value; persistPrefs(); applyPrefs(); });
$('motionToggle').addEventListener('change', e => { prefs.reduceMotion = e.target.checked; persistPrefs(); applyPrefs(); });
if ($('searchEngine')) $('searchEngine').addEventListener('change', e => { prefs.searchEngine = e.target.value; persistPrefs(); });
$('resetSettings').addEventListener('click', () => { prefs = { ...defaults }; persistPrefs(); applyPrefs(); });
$('blockerToggle').addEventListener('click', async () => {
  const result = await window.vyron.setBlocking(!blockingEnabled);
  blockingEnabled = result.enabled;
  syncBlockingUI(result);
});
$('blockerSetting').addEventListener('change', async e => {
  const result = await window.vyron.setBlocking(e.target.checked);
  blockingEnabled = result.enabled;
  syncBlockingUI(result);
});
function syncBlockingUI(result = { enabled: blockingEnabled, fullFilterLists: false }) {
  blockingEnabled = result.enabled;
  $('blockerSetting').checked = blockingEnabled;
  $('blockerStatus').textContent = !blockingEnabled ? 'Request blocking is paused' : result.fullFilterLists ? 'Advertising and tracking filter lists active' : 'Basic domain list active (offline fallback)';
  $('blockerToggle').style.color = blockingEnabled ? 'var(--accent)' : 'var(--muted)';
  $('blockerToggle').title = blockingEnabled ? 'Tracker blocking is on' : 'Tracker blocking is off';
  status.textContent = blockingEnabled ? (result.fullFilterLists ? 'Ad and tracker blocking enabled' : 'Basic blocking enabled') : 'Tracker blocking paused';
}
$('clearData').addEventListener('click', async () => {
  const button = $('clearData');
  button.disabled = true;
  try {
    await window.vyron.clearBrowsingData();
    $('privacyFeedback').textContent = 'Cookies, site storage and cache cleared.';
    status.textContent = 'Browsing data cleared';
  } catch {
    $('privacyFeedback').textContent = 'Could not clear browsing data. Please restart and try again.';
  } finally { button.disabled = false; }
});
for (const button of document.querySelectorAll('.quick-links button')) button.addEventListener('click', () => submit(button.dataset.url));
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'l') { e.preventDefault(); $('address').focus(); $('address').select(); }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 't') { e.preventDefault(); createTab(); }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'w') { e.preventDefault(); closeTab(activeId); }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') { e.preventDefault(); toggleBookmark(); }
});
applyPrefs();
renderBookmarks();
window.vyron.getBlocking().then(result => { blockingEnabled = result.enabled; syncBlockingUI(result); }).catch(() => { status.textContent = 'Privacy controls unavailable'; });
window.vyron.onBlockingStatus(result => { blockingEnabled = result.enabled; syncBlockingUI(result); });
createTab();
