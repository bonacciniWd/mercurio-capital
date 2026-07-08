const { contextBridge, ipcRenderer } = require('electron');

const UPDATE_STATE_CHANNEL = 'desktop:update-state';

function onUpdateStateChange(callback) {
  if (typeof callback !== 'function') {
    return () => {};
  }

  const listener = (_event, payload) => callback(payload);
  ipcRenderer.on(UPDATE_STATE_CHANNEL, listener);
  return () => ipcRenderer.removeListener(UPDATE_STATE_CHANNEL, listener);
}

contextBridge.exposeInMainWorld('desktop', {
  platform: process.platform,
  updateChannel: process.env.ELECTRON_UPDATE_CHANNEL || 'stable',
  updates: {
    getState: () => ipcRenderer.invoke('desktop:update:get-state'),
    checkNow: () => ipcRenderer.invoke('desktop:update:check'),
    installNow: () => ipcRenderer.invoke('desktop:update:install'),
    onStateChange: onUpdateStateChange,
  },
});
