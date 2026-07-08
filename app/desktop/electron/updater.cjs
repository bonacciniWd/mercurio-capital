const { app, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');

const UPDATE_STATE_CHANNEL = 'desktop:update-state';
const STARTUP_RETRY_BASE_DELAY_MS = 15000;
const STARTUP_RETRY_MAX_DELAY_MS = 300000;
const STARTUP_RETRY_MAX_ATTEMPTS = 4;

const initialState = {
  channel: 'stable',
  status: 'idle',
  currentVersion: '0.0.0',
  latestVersion: null,
  message: 'Aguardando verificação automática de atualização.',
  checkReason: 'startup',
  progressPercent: 0,
  bytesPerSecond: 0,
  transferredBytes: 0,
  totalBytes: 0,
  retryAttempt: 0,
  retryMaxAttempts: STARTUP_RETRY_MAX_ATTEMPTS,
  retryNextDelayMs: null,
  lastCheckedAt: null,
  lastError: null,
  updatedAt: null,
};

let updateState = { ...initialState };
let updaterConfigured = false;
let isChecking = false;
let checkReason = 'startup';
let startupRetryAttempt = 0;
let startupRetryTimer = null;
let getWindowsRef = () => [];

function normalizeError(error) {
  if (!error) {
    return 'Falha desconhecida ao verificar atualizações.';
  }

  const raw = typeof error === 'string' ? error : error.message || String(error);
  return raw.replace(/https?:\/\/\S+/g, '[link]').slice(0, 280);
}

function nextState(patch) {
  updateState = {
    ...updateState,
    ...patch,
    updatedAt: new Date().toISOString(),
  };

  broadcastState();
  return updateState;
}

function broadcastState() {
  const windows = getWindowsRef();
  for (const win of windows) {
    if (!win || win.isDestroyed() || !win.webContents) {
      continue;
    }

    win.webContents.send(UPDATE_STATE_CHANNEL, updateState);
  }
}

function clearStartupRetry() {
  if (startupRetryTimer) {
    clearTimeout(startupRetryTimer);
    startupRetryTimer = null;
  }
}

function resetRetryCounters() {
  clearStartupRetry();
  startupRetryAttempt = 0;
  nextState({ retryAttempt: 0, retryNextDelayMs: null });
}

function getStartupRetryDelayMs(attempt) {
  const exponentialDelay = STARTUP_RETRY_BASE_DELAY_MS * 2 ** Math.max(0, attempt - 1);
  return Math.min(exponentialDelay, STARTUP_RETRY_MAX_DELAY_MS);
}

function scheduleStartupRetryIfNeeded(reason) {
  if (reason === 'manual') {
    return null;
  }

  if (startupRetryAttempt >= STARTUP_RETRY_MAX_ATTEMPTS) {
    return null;
  }

  startupRetryAttempt += 1;
  const delayMs = getStartupRetryDelayMs(startupRetryAttempt);
  clearStartupRetry();

  startupRetryTimer = setTimeout(() => {
    checkForUpdates('retry').catch(() => {
      // Mantém fallback silencioso; estado de erro já é emitido via eventos.
    });
  }, delayMs);

  return {
    attempt: startupRetryAttempt,
    maxAttempts: STARTUP_RETRY_MAX_ATTEMPTS,
    delayMs,
  };
}

function handleUpdaterError(error, reason) {
  isChecking = false;

  const retryInfo = scheduleStartupRetryIfNeeded(reason);
  const retryMessage = retryInfo
    ? `Nova tentativa automática em ${Math.ceil(retryInfo.delayMs / 1000)}s (${retryInfo.attempt}/${retryInfo.maxAttempts}).`
    : 'Use "Verificar agora" para tentar novamente.';

  nextState({
    status: 'error',
    lastError: normalizeError(error),
    message: `Falha ao verificar atualização. ${retryMessage}`,
    retryAttempt: retryInfo ? retryInfo.attempt : startupRetryAttempt,
    retryMaxAttempts: STARTUP_RETRY_MAX_ATTEMPTS,
    retryNextDelayMs: retryInfo ? retryInfo.delayMs : null,
    lastCheckedAt: new Date().toISOString(),
  });
}

async function checkForUpdates(reason = 'manual') {
  if (!app.isPackaged) {
    return nextState({
      status: 'unsupported',
      message: 'Auto update disponível apenas no app desktop empacotado.',
      checkReason: reason,
    });
  }

  if (isChecking) {
    return {
      ok: false,
      reason: 'busy',
      state: updateState,
    };
  }

  if (reason === 'manual') {
    resetRetryCounters();
  }

  checkReason = reason;
  isChecking = true;
  nextState({
    status: 'checking',
    checkReason: reason,
    message:
      reason === 'manual'
        ? 'Verificando atualizações manualmente...'
        : 'Verificando atualizações no startup...',
    progressPercent: 0,
    lastError: null,
    retryNextDelayMs: null,
  });

  try {
    await autoUpdater.checkForUpdates();
    return { ok: true, state: updateState };
  } catch (error) {
    handleUpdaterError(error, reason);
    return { ok: false, error: normalizeError(error), state: updateState };
  }
}

function configureAutoUpdater(channel) {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowPrerelease = false;
  autoUpdater.allowDowngrade = false;
  autoUpdater.channel = channel;

  autoUpdater.on('checking-for-update', () => {
    nextState({
      status: 'checking',
      checkReason,
      message: 'Buscando nova versão no canal Stable...',
    });
  });

  autoUpdater.on('update-available', (info) => {
    nextState({
      status: 'available',
      latestVersion: info?.version ?? null,
      message: `Atualização ${info?.version ?? ''} disponível. Iniciando download...`.trim(),
    });
  });

  autoUpdater.on('update-not-available', () => {
    isChecking = false;
    resetRetryCounters();
    nextState({
      status: 'no-update',
      latestVersion: null,
      message: 'Você já está na versão mais recente do canal Stable.',
      lastCheckedAt: new Date().toISOString(),
    });
  });

  autoUpdater.on('download-progress', (progress) => {
    const percent = Number.isFinite(progress?.percent) ? Number(progress.percent.toFixed(1)) : 0;

    nextState({
      status: 'downloading',
      progressPercent: Math.min(100, Math.max(0, percent)),
      bytesPerSecond: progress?.bytesPerSecond ?? 0,
      totalBytes: progress?.total ?? 0,
      transferredBytes: progress?.transferred ?? 0,
      message: `Baixando atualização... ${Math.min(100, Math.max(0, percent)).toFixed(1)}%`,
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    isChecking = false;
    resetRetryCounters();

    nextState({
      status: 'downloaded',
      latestVersion: info?.version ?? null,
      message: 'Atualização pronta para instalar. Clique em "Instalar" para reiniciar.',
      progressPercent: 100,
      lastCheckedAt: new Date().toISOString(),
    });
  });

  autoUpdater.on('error', (error) => {
    handleUpdaterError(error, checkReason);
  });
}

function registerUpdaterIpcHandlers() {
  ipcMain.handle('desktop:update:get-state', async () => updateState);

  ipcMain.handle('desktop:update:check', async () => checkForUpdates('manual'));

  ipcMain.handle('desktop:update:install', async () => {
    if (!app.isPackaged) {
      return { ok: false, reason: 'not-packaged' };
    }

    if (updateState.status !== 'downloaded') {
      return { ok: false, reason: 'not-ready', state: updateState };
    }

    nextState({
      status: 'installing',
      message: 'Instalando atualização e reiniciando aplicativo...',
    });
    setImmediate(() => {
      autoUpdater.quitAndInstall(false, true);
    });

    return { ok: true };
  });
}

function setupDesktopUpdater({ channel, getWindows }) {
  if (updaterConfigured) {
    return;
  }

  updaterConfigured = true;
  getWindowsRef = getWindows;
  updateState = {
    ...initialState,
    channel,
    currentVersion: app.getVersion(),
    updatedAt: new Date().toISOString(),
  };

  registerUpdaterIpcHandlers();

  if (!app.isPackaged) {
    nextState({
      status: 'unsupported',
      message: 'Auto update disponível apenas no app desktop empacotado.',
      checkReason: 'startup',
    });
    return;
  }

  configureAutoUpdater(channel);

  checkForUpdates('startup').catch(() => {
    // Estado de erro tratado via eventos do updater.
  });
}

function sendUpdateStateToWindow(win) {
  if (!win || win.isDestroyed() || !win.webContents) {
    return;
  }

  win.webContents.send(UPDATE_STATE_CHANNEL, updateState);
}

module.exports = {
  setupDesktopUpdater,
  sendUpdateStateToWindow,
};
