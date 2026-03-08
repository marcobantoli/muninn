import { app, BrowserWindow, ipcMain, desktopCapturer, screen } from 'electron';
import path from 'path';
import { createOverlayWindow } from './overlayWindow';
import { startBackendServer } from '../backend/server';

let mainWindow: BrowserWindow | null = null;
let overlayWindow: BrowserWindow | null = null;
let overlayHasVisibleNote = false;
let overlayNoteInteractive = false;

const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

function syncOverlayVisibility(): void {
    if (!overlayWindow || overlayWindow.isDestroyed()) {
        return;
    }

    if (overlayHasVisibleNote) {
        overlayWindow.showInactive();
    } else {
        overlayWindow.hide();
    }
}

function setOverlayNoteInteractive(interactive: boolean): void {
    if (!overlayWindow || overlayWindow.isDestroyed()) {
        return;
    }

    if (!overlayHasVisibleNote) {
        overlayNoteInteractive = false;
        return;
    }

    try {
        overlayNoteInteractive = interactive;

        if (interactive) {
            overlayWindow.setIgnoreMouseEvents(false);
            overlayWindow.show();
            return;
        }

        overlayWindow.setIgnoreMouseEvents(true, { forward: true });
        overlayWindow.showInactive();
    } catch (error) {
        console.warn('[MUNINN] Failed to toggle overlay note interactivity:', error);
    }
}

function createMainWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1024,
        minHeight: 700,
        title: 'MUNINN — Cognitive Context Assistant',
        backgroundColor: '#0a0e1a',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            backgroundThrottling: false,
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

ipcMain.on('show-overlay', (_event, data) => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
        overlayHasVisibleNote = Boolean(data?.visible && data?.note);
        overlayNoteInteractive = false;
        overlayWindow.setIgnoreMouseEvents(true, { forward: true });
        overlayWindow.webContents.send('overlay-data', data);
        syncOverlayVisibility();
    }
});

ipcMain.on('hide-overlay', () => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
        overlayHasVisibleNote = false;
        overlayNoteInteractive = false;
        overlayWindow.setIgnoreMouseEvents(true, { forward: true });
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
        if (!overlayHasVisibleNote && overlayNoteInteractive) {
            overlayNoteInteractive = false;
            overlayWindow.setIgnoreMouseEvents(true, { forward: true });
        }
        overlayWindow.webContents.send('overlay-data', data);
        syncOverlayVisibility();
    }
});

ipcMain.on('set-overlay-note-interactive', (_event, interactive: boolean) => {
    setOverlayNoteInteractive(Boolean(interactive));
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
