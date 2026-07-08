const path = require('node:path');
const { app, BrowserWindow, shell } = require('electron');
const {
  setupDesktopUpdater,
  sendUpdateStateToWindow,
} = require('./updater.cjs');

const UPDATE_CHANNEL = 'stable';
const DEV_SERVER_URL = process.env.ELECTRON_START_URL;

function createMainWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1200,
    minHeight: 760,
    show: false,
    autoHideMenuBar: true,
    title: 'Mercurio Capital',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.once('ready-to-show', () => {
    win.show();
  });

  win.webContents.on('did-finish-load', () => {
    sendUpdateStateToWindow(win);
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (event, url) => {
    const isInternalUrl = url.startsWith('file://') || (DEV_SERVER_URL && url.startsWith(DEV_SERVER_URL));
    if (!isInternalUrl) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  if (!app.isPackaged && DEV_SERVER_URL) {
    win.loadURL(DEV_SERVER_URL);
    win.webContents.openDevTools({ mode: 'detach' });
    return;
  }

  const indexHtml = path.join(__dirname, '..', '..', 'dist', 'index.html');
  win.loadFile(indexHtml);
}

app.whenReady().then(() => {
  app.setAppUserModelId('br.com.mercuriocapital.desktop');
  process.env.ELECTRON_UPDATE_CHANNEL = UPDATE_CHANNEL;

  setupDesktopUpdater({
    channel: UPDATE_CHANNEL,
    getWindows: () => BrowserWindow.getAllWindows(),
  });

  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
