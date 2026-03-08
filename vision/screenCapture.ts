// ─── MUNINN Screen Capture Module ───
// Uses Electron's desktopCapturer API to capture screen frames

import { GazePoint, GazeTrackingMode, OverlayTrackingCommand } from '../shared/types';

declare global {
    interface Window {
        electronAPI: {
            getSources: () => Promise<Array<{ id: string; name: string; thumbnailDataUrl: string }>>;
            getScreenSize: () => Promise<{ width: number; height: number }>;
            getCursorScreenPoint: () => Promise<{ x: number; y: number }>;
            startOverlayEyeTracking: () => Promise<GazeTrackingMode>;
            stopOverlayEyeTracking: () => Promise<boolean>;
            startOverlayCalibration: () => void;
            showOverlay: (data: any) => void;
            hideOverlay: () => void;
            updateOverlay: (data: any) => void;
            setOverlayNoteInteractive: (interactive: boolean) => void;
            onOverlayData: (callback: (data: any) => void) => void;
            onOverlayTrackingCommand: (callback: (command: OverlayTrackingCommand) => void) => void;
            onGazeData: (callback: (gaze: GazePoint) => void) => void;
            onGazeCalibrationComplete: (callback: () => void) => void;
            onGazeTrackingError: (callback: (message: string) => void) => void;
            emitGazeData: (gaze: GazePoint) => void;
            emitOverlayTrackingReady: (data: { mode: GazeTrackingMode }) => void;
            emitOverlayTrackingError: (message: string) => void;
            emitGazeCalibrationComplete: () => void;
        };
    }
}

let mediaStream: MediaStream | null = null;
let captureInterval: number | null = null;
let videoElement: HTMLVideoElement | null = null;

export async function startScreenCapture(): Promise<HTMLVideoElement> {
    try {
        // Get available screen sources via Electron IPC
        const sources = await window.electronAPI.getSources();

        if (sources.length === 0) {
            throw new Error('No screen sources available');
        }

        // Use the first screen source
        const sourceId = sources[0].id;

        // Request media stream using Electron's desktopCapturer
        mediaStream = await (navigator.mediaDevices as any).getUserMedia({
            audio: false,
            video: {
                mandatory: {
                    chromeMediaSource: 'desktop',
                    chromeMediaSourceId: sourceId,
                    maxWidth: 1920,
                    maxHeight: 1080,
                    maxFrameRate: 10
                }
            }
        });

        // Create video element to hold the stream
        videoElement = document.createElement('video');
        videoElement.srcObject = mediaStream;
        videoElement.muted = true;
        await videoElement.play();

        console.log('[MUNINN] Screen capture started');
        return videoElement;
    } catch (err) {
        console.error('[MUNINN] Screen capture failed:', err);
        throw err;
    }
}

export function getVideoElement(): HTMLVideoElement | null {
    return videoElement;
}

export function stopScreenCapture(): void {
    if (captureInterval) {
        clearInterval(captureInterval);
        captureInterval = null;
    }

    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
        mediaStream = null;
    }

    if (videoElement) {
        videoElement.pause();
        videoElement.srcObject = null;
        videoElement = null;
    }

    console.log('[MUNINN] Screen capture stopped');
}

// Capture a single frame as a canvas
export function captureFrame(): HTMLCanvasElement | null {
    if (!videoElement) return null;

    const canvas = document.createElement('canvas');
    canvas.width = videoElement.videoWidth || 1920;
    canvas.height = videoElement.videoHeight || 1080;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
    return canvas;
}

export function isCapturing(): boolean {
    return mediaStream !== null && mediaStream.active;
}
