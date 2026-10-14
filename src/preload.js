const { contextBridge, ipcRenderer } = require('electron');

// Narrow, explicit bridge only. Remote websites never receive this API.
contextBridge.exposeInMainWorld('vyron', Object.freeze({
  version: () => ipcRenderer.invoke('vyron:app:version'),
  getBlocking: () => ipcRenderer.invoke('vyron:blocking:get'),
  setBlocking: enabled => ipcRenderer.invoke('vyron:blocking:set', Boolean(enabled)),
  clearBrowsingData: () => ipcRenderer.invoke('vyron:data:clear')
}));
