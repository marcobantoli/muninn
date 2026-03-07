import { app, BrowserWindow, ipcMain, desktopCapturer, screen } from 'electron';
import path from 'path';
import { createOverlayWindow } from './overlayWindow';
import { startBackendServer } from '../backend/server';
import type { GazePoint, GazeTrackingMode, OverlayTrackingCommand } from '../shared/types';

let mainWindow: BrowserWindow | null = null;
let overlayWindow: BrowserWindow | null = null;
let overlayTrackingActive = false;
let overlayHasVisibleNote = false;
let pendingTrackingStartResolve: ((mode: GazeTrackingMode) => void) | null = null;
let pendingTrackingStartReject: ((error: Error) => void) | null = null;
let pendingTrackingStartTimeout: NodeJS.Timeout | null = null;

const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

async function ensureOverlayWindowReady(): Promise<BrowserWindow> {
    if (!overlayWindow || overlayWindow.isDestroyed()) {
        throw new Error('Overlay window unavailable');
    }

    if (!overlayWindow.webContents.isLoading()) {
        return overlayWindow;
    }

    await new Promise<void>((resolve) => {
        overlayWindow?.webContents.once('did-finish-load', () => resolve());
    });

    return overlayWindow;
}

function setOverlayInteractive(interactive: boolean): void {
    if (!overlayWindow || overlayWindow.isDestroyed()) {
        return;
    }

    try {
        if (interactive) {
            overlayWindow.setIgnoreMouseEvents(false);
            overlayWindow.show();
            overlayWindow.focus();
            return;
        }

        overlayWindow.setIgnoreMouseEvents(true, { forward: true });

        if (overlayTrackingActive || overlayHasVisibleNote) {
            overlayWindow.showInactive();
            mainWindow?.focus();
        }
    } catch (error) {
        console.warn('[MUNINN] Failed to toggle overlay interactivity:', error);
    }
}

function syncOverlayVisibility(): void {
    if (!overlayWindow || overlayWindow.isDestroyed()) {
        return;
    }

    if (overlayTrackingActive || overlayHasVisibleNote) {
        overlayWindow.showInactive();
    } else {
        overlayWindow.hide();
    }
}

function createMainWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1024,
        minHeight: 700,
        title: 'MUNINN — Cognitive Gaze Assistant',
        backgroundColor: '#0a0e1a',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
        console.log(`[Browser] ${message}`);
    });

    if (VITE_DEV_SERVER_URL) {
        mainWindow.loadURL(VITE_DEV_SERVER_URL);
    } else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
        if (overlayWindow) {
            overlayWindow.close();
            overlayWindow = null;
        }
    });
}

ipcMain.handle('get-sources', async () => {
    const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: 1920, height: 1080 }
    });
    return sources.map(s => ({
        id: s.id,
        name: s.name,
        thumbnailDataUrl: s.thumbnail.toDataURL()
    }));
});

ipcMain.handle('get-screen-size', () => {
    const primaryDisplay = screen.getPrimaryDisplay();
    return primaryDisplay.workAreaSize;
});

ipcMain.handle('get-cursor-screen-point', () => {
    return screen.getCursorScreenPoint();
});

ipcMain.handle('start-overlay-eye-tracking', async () => {
    const overlay = await ensureOverlayWindowReady();

    if (pendingTrackingStartTimeout) {
        clearTimeout(pendingTrackingStartTimeout);
        pendingTrackingStartTimeout = null;
    }

    if (pendingTrackingStartReject) {
        pendingTrackingStartReject(new Error('Overlay eye tracking was restarted before completing.'));
        pendingTrackingStartResolve = null;
        pendingTrackingStartReject = null;
    }

    setOverlayInteractive(true);

    return new Promise<GazeTrackingMode>((resolve, reject) => {
        pendingTrackingStartTimeout = setTimeout(() => {
            pendingTrackingStartResolve = null;
            pendingTrackingStartReject = null;
            pendingTrackingStartTimeout = null;
            overlayTrackingActive = false;
            syncOverlayVisibility();
            reject(new Error('Timed out waiting for overlay eye tracking to initialize.'));
        }, 15000);

        pendingTrackingStartResolve = resolve;
        pendingTrackingStartReject = reject;
        const command: OverlayTrackingCommand = { type: 'start-eye-tracking' };
        overlay.webContents.send('overlay-tracking-command', command);
    });
});

ipcMain.handle('stop-overlay-eye-tracking', async () => {
    if (!overlayWindow || overlayWindow.isDestroyed()) {
        return false;
    }

    if (pendingTrackingStartTimeout) {
        clearTimeout(pendingTrackingStartTimeout);
        pendingTrackingStartTimeout = null;
    }

    if (pendingTrackingStartReject) {
        pendingTrackingStartReject(new Error('Overlay eye tracking was stopped before initialization completed.'));
        pendingTrackingStartResolve = null;
        pendingTrackingStartReject = null;
    }

    overlayTrackingActive = false;
    const command: OverlayTrackingCommand = { type: 'stop-eye-tracking' };
    overlayWindow.webContents.send('overlay-tracking-command', command);
    setOverlayInteractive(false);
    syncOverlayVisibility();
    return true;
});

ipcMain.on('start-overlay-calibration', async () => {
    try {
        const overlay = await ensureOverlayWindowReady();
        setOverlayInteractive(true);
        const command: OverlayTrackingCommand = { type: 'start-calibration' };
        overlay.webContents.send('overlay-tracking-command', command);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to start overlay calibration.';
        mainWindow?.webContents.send('gaze-tracking-error', message);
    }
});

ipcMain.on('show-overlay', (_event, data) => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
        overlayHasVisibleNote = Boolean(data?.visible && data?.note);
        overlayWindow.webContents.send('overlay-data', data);
        syncOverlayVisibility();
    }
});

ipcMain.on('hide-overlay', () => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
        overlayHasVisibleNote = false;
        overlayWindow.webContents.send('overlay-data', {
            visible: false,
            note: null,
            x: 0,
            y: 0
        });
        syncOverlayVisibility();
    }
});

ipcMain.on('update-overlay', (_event, data) => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
        overlayHasVisibleNote = Boolean(data?.visible && data?.note);
        overlayWindow.webContents.send('overlay-data', data);
        syncOverlayVisibility();
    }
});

ipcMain.on('overlay-gaze-data', (_event, gaze: GazePoint) => {
    mainWindow?.webContents.send('gaze-data', gaze);
});

ipcMain.on('overlay-tracking-ready', (_event, data: { mode: GazeTrackingMode }) => {
    overlayTrackingActive = true;
    if (pendingTrackingStartTimeout) {
        clearTimeout(pendingTrackingStartTimeout);
        pendingTrackingStartTimeout = null;
    }

    if (pendingTrackingStartResolve) {
        pendingTrackingStartResolve(data.mode);
        pendingTrackingStartResolve = null;
        pendingTrackingStartReject = null;
    }
    mainWindow?.webContents.send('gaze-tracking-ready', data);
    syncOverlayVisibility();
});

ipcMain.on('overlay-tracking-error', (_event, message: string) => {
    overlayTrackingActive = false;
    if (pendingTrackingStartTimeout) {
        clearTimeout(pendingTrackingStartTimeout);
        pendingTrackingStartTimeout = null;
    }

    if (pendingTrackingStartReject) {
        pendingTrackingStartReject(new Error(message));
        pendingTrackingStartResolve = null;
        pendingTrackingStartReject = null;
    }
    mainWindow?.webContents.send('gaze-tracking-error', message);
    syncOverlayVisibility();
});

ipcMain.on('overlay-calibration-complete', () => {
    setOverlayInteractive(false);
    mainWindow?.webContents.send('gaze-calibration-complete');
    syncOverlayVisibility();
});

app.whenReady().then(async () => {
    await startBackendServer();

    createMainWindow();
    overlayWindow = createOverlayWindow();

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
