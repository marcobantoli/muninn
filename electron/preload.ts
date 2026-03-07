import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
    // Screen capture
    getSources: () => ipcRenderer.invoke('get-sources'),
    getScreenSize: () => ipcRenderer.invoke('get-screen-size'),
    getCursorScreenPoint: () => ipcRenderer.invoke('get-cursor-screen-point'),
    startOverlayEyeTracking: () => ipcRenderer.invoke('start-overlay-eye-tracking'),
    stopOverlayEyeTracking: () => ipcRenderer.invoke('stop-overlay-eye-tracking'),
    startOverlayCalibration: () => ipcRenderer.send('start-overlay-calibration'),

    // Overlay control
    showOverlay: (data: any) => ipcRenderer.send('show-overlay', data),
    hideOverlay: () => ipcRenderer.send('hide-overlay'),
    updateOverlay: (data: any) => ipcRenderer.send('update-overlay', data),

    // Overlay listener (for overlay window)
    onOverlayData: (callback: (data: any) => void) => {
        ipcRenderer.on('overlay-data', (_event, data) => callback(data));
    },
    onOverlayTrackingCommand: (callback: (command: any) => void) => {
        ipcRenderer.on('overlay-tracking-command', (_event, command) => callback(command));
    },
    onGazeData: (callback: (gaze: any) => void) => {
        ipcRenderer.on('gaze-data', (_event, gaze) => callback(gaze));
    },
    onGazeCalibrationComplete: (callback: () => void) => {
        ipcRenderer.on('gaze-calibration-complete', () => callback());
    },
    onGazeTrackingError: (callback: (message: string) => void) => {
        ipcRenderer.on('gaze-tracking-error', (_event, message) => callback(message));
    },
    emitGazeData: (gaze: any) => ipcRenderer.send('overlay-gaze-data', gaze),
    emitOverlayTrackingReady: (data: any) => ipcRenderer.send('overlay-tracking-ready', data),
    emitOverlayTrackingError: (message: string) => ipcRenderer.send('overlay-tracking-error', message),
    emitGazeCalibrationComplete: () => ipcRenderer.send('overlay-calibration-complete')
});
