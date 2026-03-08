import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
    // Screen capture
    getSources: () => ipcRenderer.invoke('get-sources'),
    getScreenSize: () => ipcRenderer.invoke('get-screen-size'),
    getCursorScreenPoint: () => ipcRenderer.invoke('get-cursor-screen-point'),

    // Overlay control
    showOverlay: (data: any) => ipcRenderer.send('show-overlay', data),
    hideOverlay: () => ipcRenderer.send('hide-overlay'),
    updateOverlay: (data: any) => ipcRenderer.send('update-overlay', data),
    setOverlayNoteInteractive: (interactive: boolean) => ipcRenderer.send('set-overlay-note-interactive', interactive),

    // Overlay listener (for overlay window)
    onOverlayData: (callback: (data: any) => void) => {
        ipcRenderer.on('overlay-data', (_event, data) => callback(data));
    },
});
