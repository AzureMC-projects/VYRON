const $ = (id) => document.getElementById(id);
const viewport = $('viewport');
const tabsNode = $('tabs');
const settings = $('settingsPanel');
const status = $('statusText');
const key = 'vyron-preferences-v1';
const defaults = { theme: 'midnight', accent: '#8b7cff', density: 'comfortable', reduceMotion: false };
let prefs = { ...defaults };
try { prefs = { ...defaults, ...JSON.parse(localStorage.getItem(key) || '{}') }; } catch {}
let tabs = [];
let activeId = 0;
let nextId = 1;

function savePrefs() { localStorage.setItem(key, JSON.stringify(prefs)); }
function applyPrefs() {
  document.body.dataset.theme = prefs.theme === 'midnight' ? '' : prefs.theme;
  document.body.dataset.density = prefs.density;
  document.body.classList.toggle('reduce-motion', !!prefs.reduceMotion);
  document.documentElement.style.setProperty('--accent', prefs.accent);
  $('themeSelect').value = prefs.theme;
  $('accentSelect').value = prefs.accent;
  $('densitySelect').value = prefs.density;
  $('motionToggle').checked = !!prefs.reduceMotion;
}
function parseAddress(input) {
  const value = input.trim();
  if (!value || /^(javascript|data|file|vbscript):/i.test(value)) return null;
  if (/^https?:\/\//i.test(value)) {
    try { const u = new URL(value); return ['http:', 'https:'].includes(u.protocol) ? u.href : null; } catch { return null; }
  }
  if (!value.includes(' ') && /^[\w.-]+\.[a-z]{2,}(:\d+)?([/?#].*)?$/i.test(value)) return 'https://' + value;
  return 'https://www.google.com/search?q=' + encodeURIComponent(value);
}
function current() { return tabs.find(t => t.id === activeId); }
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
    close.onclick = (event) => { event.stopPropagation(); closeTab(tab.id); };
    button.append(label, close);
    button.onclick = () => activate(tab.id);
    tabsNode.appendChild(button);
  }
}
function activate(id) {
  activeId = id;
  for (const t of tabs) t.view.style.display = t.id === id && !t.start ? 'flex' : 'none';
  const t = current();
  viewport.classList.toggle('has-page', !!t && !t.start);
  $('startPage').style.display = t && t.start ? 'flex' : 'none';
  $('address').value = t && t.url ? t.url : '';
  $('securityIcon').textContent = t && t.url && t.url.startsWith('https://') ? '▣' : '◈';
  renderTabs();
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
  view.addEventListener('page-title-updated', e => { tab.title = e.title || 'New tab'; renderTabs(); });
  view.addEventListener('did-navigate', e => { tab.url = e.url; if (id === activeId) $('address').value = e.url; });
  view.addEventListener('did-navigate-in-page', e => { tab.url = e.url; if (id === activeId) $('address').value = e.url; });
  view.addEventListener('did-start-loading', () => { if (id === activeId) status.textContent = 'Loading…'; });
  view.addEventListener('did-stop-loading', () => { if (id === activeId) status.textContent = 'Ready'; });
  view.addEventListener('will-navigate', e => { if (!/^https?:\/\//i.test(e.url)) e.preventDefault(); });
  view.addEventListener('new-window', e => { const safe = parseAddress(e.url); if (safe) createTab(safe); });
  activate(id);
  if (url) navigate(tab, url);
  return tab;
}
function navigate(tab, url) {
  if (!tab || !url || !/^https?:\/\//i.test(url)) { status.textContent = 'Only HTTP and HTTPS addresses are allowed'; return; }
  tab.start = false;
  tab.url = url;
  try { tab.title = new URL(url).hostname; } catch {}
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
  const t = current(); if (!t) return;
  t.start = true; t.url = ''; t.title = 'New tab'; t.view.stop();
  activate(t.id); status.textContent = 'Start page';
});
$('back').addEventListener('click', () => { const t = current(); if (t && t.view.canGoBack()) t.view.goBack(); });
$('forward').addEventListener('click', () => { const t = current(); if (t && t.view.canGoForward()) t.view.goForward(); });
$('reload').addEventListener('click', () => { const t = current(); if (t && !t.start) t.view.reload(); });
$('settingsButton').addEventListener('click', () => { settings.hidden = !settings.hidden; });
$('closeSettings').addEventListener('click', () => { settings.hidden = true; });
$('themeSelect').addEventListener('change', e => { prefs.theme = e.target.value; savePrefs(); applyPrefs(); });
$('accentSelect').addEventListener('input', e => { prefs.accent = e.target.value; savePrefs(); applyPrefs(); });
$('densitySelect').addEventListener('change', e => { prefs.density = e.target.value; savePrefs(); applyPrefs(); });
$('motionToggle').addEventListener('change', e => { prefs.reduceMotion = e.target.checked; savePrefs(); applyPrefs(); });
$('resetSettings').addEventListener('click', () => { prefs = { ...defaults }; savePrefs(); applyPrefs(); });
for (const button of document.querySelectorAll('.quick-links button')) button.addEventListener('click', () => submit(button.dataset.url));
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'l') { e.preventDefault(); $('address').focus(); $('address').select(); }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 't') { e.preventDefault(); createTab(); }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'w') { e.preventDefault(); closeTab(activeId); }
});
applyPrefs();
createTab();
