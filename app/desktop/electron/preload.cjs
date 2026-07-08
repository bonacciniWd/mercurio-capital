const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  platform: process.platform,
  updateChannel: process.env.ELECTRON_UPDATE_CHANNEL || 'stable',
});
