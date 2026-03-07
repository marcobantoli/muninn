// ─── MUNINN Gaze Tracking Module ───
// Uses a fullscreen Electron overlay for WebGazer eye tracking and falls back to mouse tracking if needed.

import { GazePoint, GazeTrackingMode } from '../shared/types';
import { preflightWebcamAccess } from './webcamAccess';

let isInitialized = false;
let isCalibrating = false;
let latestGaze: GazePoint | null = null;
let gazeListeners: Array<(gaze: GazePoint) => void> = [];
let calibrationCompleteListeners: Array<() => void> = [];
let mouseMoveHandler: ((event: MouseEvent) => void) | null = null;
let globalCursorPollInterval: number | null = null;
let lastPreviewHoverTimestamp = 0;
let trackingMode: GazeTrackingMode | null = null;
let smoothedGaze: { x: number; y: number } | null = null;
let overlayListenersInitialized = false;

const GAZE_SMOOTHING = 0.35;

declare global {
    interface Window {
        webgazer: any;
    }
}

export async function initGazeTracking(): Promise<GazeTrackingMode> {
    if (isInitialized && trackingMode) {
        return trackingMode;
    }

    if (window.electronAPI?.startOverlayEyeTracking) {
        try {
            initializeOverlayListeners();
            const mode = await window.electronAPI.startOverlayEyeTracking();
            trackingMode = mode;
            isInitialized = true;
            isCalibrating = mode === 'webgazer';
            latestGaze = null;
            smoothedGaze = null;

            console.log('[MUNINN] Fullscreen overlay eye tracking initialized');
            return mode;
        } catch (error) {
            console.error('[MUNINN] Overlay eye tracking failed. Falling back to local tracking.', error);
        }
    }

    return new Promise((resolve) => {
        if (window.webgazer) {
            setupWebGazer()
                .then(resolve)
                .catch((error) => {
                    console.error('[MUNINN] Failed to initialize WebGazer. Falling back to mouse tracking.', error);
                    resolve(setupMouseFallback());
                });
            return;
        }

        const script = document.createElement('script');
        script.src = 'https://webgazer.cs.brown.edu/webgazer.js';
        script.async = true;
        script.onload = () => {
            setupWebGazer()
                .then(resolve)
                .catch((error) => {
                    console.error('[MUNINN] WebGazer loaded but failed to start. Falling back to mouse tracking.', error);
                    resolve(setupMouseFallback());
                });
        };
        script.onerror = () => {
            console.error('[MUNINN] Failed to load WebGazer.js');
            resolve(setupMouseFallback());
        };
        document.head.appendChild(script);
    });
}

function initializeOverlayListeners(): void {
    if (overlayListenersInitialized || !window.electronAPI) {
        return;
    }

    window.electronAPI.onGazeData((gaze: GazePoint) => {
        if (!gaze || !Number.isFinite(gaze.x) || !Number.isFinite(gaze.y)) {
            latestGaze = null;
            smoothedGaze = null;
            return;
        }

        emitGaze(gaze.x, gaze.y);
    });

    window.electronAPI.onGazeCalibrationComplete(() => {
        isCalibrating = false;
        calibrationCompleteListeners.forEach((fn) => fn());
    });

    window.electronAPI.onGazeTrackingError((message: string) => {
        console.error('[MUNINN] Overlay gaze tracking error:', message);
    });

    overlayListenersInitialized = true;
}

async function setupWebGazer(): Promise<GazeTrackingMode> {
    if (!window.webgazer) {
        throw new Error('WebGazer not available on window');
    }

    await preflightWebcamAccess();

    cleanupMouseFallback();

    const webgazer = window.webgazer
        .setRegression?.('ridge')
        ?.setGazeListener?.((data: { x: number; y: number } | null) => {
            if (!data || !Number.isFinite(data.x) || !Number.isFinite(data.y)) {
                latestGaze = null;
                smoothedGaze = null;
                return;
            }

            const mappedPoint = mapPredictionToScreen(data.x, data.y);
            if (!mappedPoint) {
                latestGaze = null;
                smoothedGaze = null;
                return;
            }

            emitGaze(mappedPoint.x, mappedPoint.y);
        });

    if (!webgazer || typeof webgazer.begin !== 'function') {
        throw new Error('WebGazer API is incomplete');
    }

    await webgazer.begin();
    configureWebGazerUi(false);

    if (typeof webgazer.saveDataAcrossSessions === 'function') {
        webgazer.saveDataAcrossSessions(false);
    }

    if (typeof webgazer.applyKalmanFilter === 'function') {
        webgazer.applyKalmanFilter(true);
    }

    trackingMode = 'webgazer';
    isInitialized = true;
    latestGaze = null;
    smoothedGaze = null;

    console.log('[MUNINN] Local WebGazer eye tracking initialized');
    return trackingMode;
}

function emitGaze(x: number, y: number): void {
    if (smoothedGaze) {
        smoothedGaze = {
            x: smoothedGaze.x + (x - smoothedGaze.x) * GAZE_SMOOTHING,
            y: smoothedGaze.y + (y - smoothedGaze.y) * GAZE_SMOOTHING
        };
    } else {
        smoothedGaze = { x, y };
    }

    const gaze: GazePoint = {
        x: smoothedGaze.x,
        y: smoothedGaze.y,
        timestamp: Date.now()
    };

    latestGaze = gaze;
    gazeListeners.forEach(fn => fn(gaze));
}

function mapPredictionToScreen(x: number, y: number): { x: number; y: number } | null {
    const canvas = document.querySelector('canvas');
    if (!canvas) {
        return null;
    }

    const rect = canvas.getBoundingClientRect();
    if (
        x < rect.left ||
        x > rect.right ||
        y < rect.top ||
        y > rect.bottom ||
        rect.width === 0 ||
        rect.height === 0
    ) {
        return null;
    }

    return {
        x: ((x - rect.left) / rect.width) * screen.width,
        y: ((y - rect.top) / rect.height) * screen.height
    };
}

function configureWebGazerUi(showCalibrationHelpers: boolean): void {
    if (!window.webgazer) {
        return;
    }

    const { webgazer } = window;

    if (typeof webgazer.showVideoPreview === 'function') {
        webgazer.showVideoPreview(showCalibrationHelpers);
    }

    if (typeof webgazer.showPredictionPoints === 'function') {
        webgazer.showPredictionPoints(showCalibrationHelpers);
    }

    if (typeof webgazer.showFaceOverlay === 'function') {
        webgazer.showFaceOverlay(showCalibrationHelpers);
    }

    if (typeof webgazer.showFaceFeedbackBox === 'function') {
        webgazer.showFaceFeedbackBox(showCalibrationHelpers);
    }
}

function cleanupMouseFallback(): void {
    if (mouseMoveHandler) {
        document.removeEventListener('mousemove', mouseMoveHandler);
        mouseMoveHandler = null;
    }

    if (globalCursorPollInterval !== null) {
        window.clearInterval(globalCursorPollInterval);
        globalCursorPollInterval = null;
    }
}

function setupMouseFallback(): GazeTrackingMode {
    console.log('[MUNINN] Using mouse fallback for gaze tracking');

    cleanupMouseFallback();

    mouseMoveHandler = (e: MouseEvent) => {
        let gazeX = e.screenX;
        let gazeY = e.screenY;

        const canvas = document.querySelector('canvas');
        if (canvas) {
            const rect = canvas.getBoundingClientRect();
            if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
                gazeX = ((e.clientX - rect.left) / rect.width) * screen.width;
                gazeY = ((e.clientY - rect.top) / rect.height) * screen.height;
                lastPreviewHoverTimestamp = Date.now();
            }
        }

        emitGaze(gazeX, gazeY);
    };

    document.addEventListener('mousemove', mouseMoveHandler);

    if (window.electronAPI?.getCursorScreenPoint) {
        globalCursorPollInterval = window.setInterval(async () => {
            if (Date.now() - lastPreviewHoverTimestamp < 100) {
                return;
            }

            try {
                const point = await window.electronAPI.getCursorScreenPoint();
                emitGaze(point.x, point.y);
            } catch (error) {
                console.warn('[MUNINN] Failed to read global cursor position:', error);
                if (globalCursorPollInterval !== null) {
                    window.clearInterval(globalCursorPollInterval);
                    globalCursorPollInterval = null;
                }
            }
        }, 50);
    }

    trackingMode = 'mouse';
    isInitialized = true;
    latestGaze = null;
    smoothedGaze = null;
    return trackingMode;
}

export function isGazeReady(): boolean {
    return isInitialized;
}

export function getLatestGaze(): GazePoint | null {
    return latestGaze;
}

export function onGaze(callback: (gaze: GazePoint) => void): () => void {
    gazeListeners.push(callback);
    return () => {
        gazeListeners = gazeListeners.filter(fn => fn !== callback);
    };
}

export function onCalibrationComplete(callback: () => void): () => void {
    calibrationCompleteListeners.push(callback);
    return () => {
        calibrationCompleteListeners = calibrationCompleteListeners.filter(fn => fn !== callback);
    };
}

export interface CalibrationPoint {
    x: number;
    y: number;
    completed: boolean;
}

export function getCalibrationPoints(screenWidth: number, screenHeight: number): CalibrationPoint[] {
    const padding = 50;
    const points: CalibrationPoint[] = [];

    for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
            points.push({
                x: padding + col * ((screenWidth - 2 * padding) / 2),
                y: padding + row * ((screenHeight - 2 * padding) / 2),
                completed: false
            });
        }
    }

    return points;
}

export async function recordCalibrationPoint(x: number, y: number): Promise<void> {
    if (window.webgazer && typeof window.webgazer.recordScreenPosition === 'function') {
        window.webgazer.recordScreenPosition(x, y, 'click');
    }
}

export function startCalibration(): void {
    isCalibrating = true;

    if (window.webgazer) {
        configureWebGazerUi(true);
        if (typeof window.webgazer.clearData === 'function') {
            window.webgazer.clearData();
        }
    }
}

export async function beginGazeCalibration(): Promise<void> {
    isCalibrating = true;
    latestGaze = null;
    smoothedGaze = null;

    if (window.electronAPI?.startOverlayCalibration && trackingMode === 'webgazer') {
        window.electronAPI.startOverlayCalibration();
        return;
    }

    startCalibration();
}

export function endCalibration(): void {
    isCalibrating = false;
    configureWebGazerUi(false);
}

export function isCalibrationActive(): boolean {
    return isCalibrating;
}

export function stopGazeTracking(): void {
    cleanupMouseFallback();

    if (window.electronAPI?.stopOverlayEyeTracking && trackingMode === 'webgazer') {
        window.electronAPI.stopOverlayEyeTracking().catch((error: unknown) => {
            console.warn('[MUNINN] Failed to stop overlay eye tracking cleanly:', error);
        });
    }

    if (window.webgazer) {
        try {
            configureWebGazerUi(false);
            window.webgazer.end();
        } catch (e) {
            // ignore
        }
    }

    isInitialized = false;
    isCalibrating = false;
    latestGaze = null;
    lastPreviewHoverTimestamp = 0;
    trackingMode = null;
    smoothedGaze = null;
}
