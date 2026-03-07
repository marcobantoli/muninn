import { BrowserWindow, screen } from 'electron';
import path from 'path';

const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

export function createOverlayWindow(): BrowserWindow {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { x, y, width, height } = primaryDisplay.bounds;

    const overlay = new BrowserWindow({
        x,
        y,
        width,
        height,
        transparent: true,
        frame: false,
        alwaysOnTop: true,
        skipTaskbar: true,
        resizable: false,
        focusable: true,
        show: false,
        backgroundColor: '#00000000',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    // Enable click-through
    overlay.setIgnoreMouseEvents(true, { forward: true });
    overlay.setFocusable(false);

    if (VITE_DEV_SERVER_URL) {
        overlay.loadURL(`${VITE_DEV_SERVER_URL}/overlay.html`);
    } else {
        overlay.loadFile(path.join(__dirname, '../dist/overlay.html'));
    }

    return overlay;
}
