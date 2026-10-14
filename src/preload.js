const { contextBridge } = require('electron');

// Intentionally expose no Node APIs or privileged IPC to page content.
contextBridge.exposeInMainWorld('vyron', Object.freeze({
  version: '0.1.0'
}));
