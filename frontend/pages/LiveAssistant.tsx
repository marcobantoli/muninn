import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GazePoint, PersonhoodNote, AppState } from '../../shared/types';
import { startScreenCapture, stopScreenCapture, getVideoElement } from '../../vision/screenCapture';
import { detectFaces, initFaceDetection } from '../../vision/faceDetection';
import {
    processCursorFaceIntersection, onRecognition, resetRecognitionEngine,
    setHcpMode, getDwellProgress,
    updateFaceMatcher, FaceScreenPosition, getActiveHoveredFaceId
} from '../../vision/recognitionEngine';
import { HcpBanner } from '../components/HcpBanner';

const API_BASE = 'http://localhost:3001/api';
const RECOGNITION_LOOP_INTERVAL_MS = 100;

export function LiveAssistant() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const overlayHideTimeoutRef = useRef<number | null>(null);
    const recognitionLoopActiveRef = useRef(false);
    const [appState, setAppState] = useState<AppState>({
        isCapturing: false,
        isCalibrated: true,
        hcpMode: false,
        detectedFaces: [],
        gazePoint: null,
        activeRecognition: null,
    });
    const [statusMessage, setStatusMessage] = useState('Ready to start');
    const loopRef = useRef<number | null>(null);

    // Recognition callback
    useEffect(() => {
        const unsub = onRecognition((note: PersonhoodNote, facePosition) => {
            setAppState((prev: AppState) => ({ ...prev, activeRecognition: note }));

            if (overlayHideTimeoutRef.current !== null) {
                window.clearTimeout(overlayHideTimeoutRef.current);
            }

            if (window.electronAPI) {
                window.electronAPI.showOverlay({
                    visible: true,
                    note,
                    x: Math.max(16, screen.width - 356),
                    y: 16
                });
            }

            // Auto-hide after 15 seconds
            overlayHideTimeoutRef.current = window.setTimeout(() => {
                setAppState((prev: AppState) => ({ ...prev, activeRecognition: null }));
                if (window.electronAPI) {
                    window.electronAPI.hideOverlay();
                }
                overlayHideTimeoutRef.current = null;
            }, 15000);
        });

        return () => {
            if (overlayHideTimeoutRef.current !== null) {
                window.clearTimeout(overlayHideTimeoutRef.current);
                overlayHideTimeoutRef.current = null;
            }
            unsub();
        };
    }, []);

    const startLoop = useCallback(async () => {
        try {
            recognitionLoopActiveRef.current = true;
            setStatusMessage('Initializing AI Face Models (downloading weights if first run)...');
            await initFaceDetection();

            setStatusMessage('Loading profiles and building Face Matcher...');
            const res = await fetch(`${API_BASE}/profiles`);
            if (res.ok) {
                const profiles = await res.json();
                console.log(`[MUNINN] Fetched ${profiles.length} profiles from API. Building Face Matcher...`);
                updateFaceMatcher(profiles);
            } else {
                console.warn('[MUNINN] Failed to fetch profiles from API. Face Matcher might not work.');
            }

            let videoEl: HTMLVideoElement;
            try {
                videoEl = await startScreenCapture();
            } catch {
                setStatusMessage('Screen capture unavailable — using demo mode');
                setAppState((prev: AppState) => ({ ...prev, isCapturing: true }));
                return;
            }

            setAppState((prev: AppState) => ({
                ...prev,
                isCapturing: true,
                isCalibrated: true,
            }));

            setStatusMessage('Recognition loop active — hover your cursor over a face to recognize it');

            const scheduleNextLoop = () => {
                if (!recognitionLoopActiveRef.current) {
                    return;
                }

                loopRef.current = window.setTimeout(() => {
                    void runLoop();
                }, RECOGNITION_LOOP_INTERVAL_MS);
            };

            // Main recognition loop (~10 fps) that stays active while the window is minimized.
            const runLoop = async () => {
                if (!recognitionLoopActiveRef.current) {
                    return;
                }

                const video = getVideoElement();
                if (!video) {
                    scheduleNextLoop();
                    return;
                }

                try {
                    // Detect faces
                    const faces = await detectFaces(video);

                    if (!recognitionLoopActiveRef.current) {
                        return;
                    }

                    let cursorPoint: GazePoint | null = null;
                    try {
                        const cursor = await window.electronAPI.getCursorScreenPoint();
                        cursorPoint = {
                            x: cursor.x,
                            y: cursor.y,
                            timestamp: Date.now(),
                        };
                    } catch (error) {
                        console.warn('[MUNINN] Failed to read cursor position:', error);
                    }

                    if (!recognitionLoopActiveRef.current) {
                        return;
                    }

                    processCursorFaceIntersection(cursorPoint, faces, {
                        width: video.videoWidth || 1920,
                        height: video.videoHeight || 1080,
                    });

                    setAppState((prev: AppState) => ({
                        ...prev,
                        detectedFaces: faces,
                    }));

                    // Draw on canvas when the UI is visible; recognition continues even if paint is throttled.
                    drawVisualization(faces, {
                        width: video.videoWidth || 1920,
                        height: video.videoHeight || 1080,
                    });
                } catch (error) {
                    console.error('[MUNINN] Recognition loop tick failed:', error);
                }

                scheduleNextLoop();
            };

            void runLoop();
        } catch (err) {
            recognitionLoopActiveRef.current = false;
            console.error('Loop start failed:', err);
            setStatusMessage('Error starting recognition loop');
        }
    }, []);

    const stopLoop = useCallback(() => {
        recognitionLoopActiveRef.current = false;
        if (loopRef.current) {
            window.clearTimeout(loopRef.current);
            loopRef.current = null;
        }
        if (overlayHideTimeoutRef.current !== null) {
            window.clearTimeout(overlayHideTimeoutRef.current);
            overlayHideTimeoutRef.current = null;
        }
        stopScreenCapture();
        resetRecognitionEngine();
        setAppState((prev: AppState) => ({
            ...prev,
            isCapturing: false,
            detectedFaces: [],
            activeRecognition: null,
        }));
        setStatusMessage('Stopped');
        if (window.electronAPI) {
            window.electronAPI.hideOverlay();
        }
    }, []);


    function drawVisualization(
        faces: import('../../vision/faceDetection').FaceWithDescriptor[],
        captureSize?: { width: number; height: number }
    ) {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw the screen capture video frame as the background
        const video = getVideoElement();
        if (video && video.readyState >= 2) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        }

        const captureWidth = captureSize?.width || video?.videoWidth || 1920;
        const captureHeight = captureSize?.height || video?.videoHeight || 1080;
        const activeHoveredFaceId = getActiveHoveredFaceId();

        // Draw face bounding boxes
        faces.forEach((f: any) => {
            const face = f;
            const progress = getDwellProgress(face.id);
            const isHovered = face.id === activeHoveredFaceId;
            const color = progress > 0.8 ? '#00b894' : progress > 0.3 ? '#fdcb6e' : '#6c5ce7';
            const x = face.x * (canvas.width / captureWidth);
            const y = face.y * (canvas.height / captureHeight);
            const width = face.width * (canvas.width / captureWidth);
            const height = face.height * (canvas.height / captureHeight);

            ctx.strokeStyle = color;
            ctx.lineWidth = isHovered ? 4 : 2;
            ctx.strokeRect(x, y, width, height);

            if (isHovered) {
                ctx.save();
                ctx.shadowColor = 'rgba(253, 203, 110, 0.7)';
                ctx.shadowBlur = 16;
                ctx.strokeStyle = '#fdcb6e';
                ctx.lineWidth = 4;
                ctx.strokeRect(x - 2, y - 2, width + 4, height + 4);
                ctx.restore();
            }

            // Recognition progress bar
            if (progress > 0) {
                const barWidth = width;
                ctx.fillStyle = color;
                ctx.fillRect(
                    x,
                    y + height + 4,
                    barWidth * progress,
                    3
                );
            }
        });
    }

    function toggleHcpMode() {
        const newMode = !appState.hcpMode;
        setHcpMode(newMode);
        setAppState((prev: AppState) => ({ ...prev, hcpMode: newMode }));
    }

    return (
        <div className="p-8 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
                        <span className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-muninn-accent/15 text-base font-semibold text-muninn-accent ${appState.isCapturing ? 'animate-pulse' : ''}`}>LA</span>
                        Live Assistant
                    </h1>
                    <p className="mt-1 text-muninn-text-dim">{statusMessage}</p>
                </div>

                <div className="flex items-center gap-3">
                    {/* HCP Mode Toggle */}
                    <button
                        id="hcp-toggle"
                        onClick={toggleHcpMode}
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${appState.hcpMode
                            ? 'bg-muninn-success/20 text-muninn-success border border-muninn-success/30'
                            : 'bg-muninn-surface text-muninn-text-dim border border-muninn-border hover:border-muninn-success/30'
                            }`}
                    >
                        {appState.hcpMode ? 'HCP Mode ON' : 'HCP Mode'}
                    </button>

                    {/* Start/Stop */}
                    {appState.isCapturing ? (
                        <button id="stop-btn" onClick={stopLoop} className="btn-danger text-sm">
                            Stop
                        </button>
                    ) : (
                        <button id="start-btn" onClick={startLoop} className="btn-primary text-sm">
                            Start Recognition
                        </button>
                    )}
                </div>
            </div>

            {/* HCP Banner */}
            {appState.hcpMode && <HcpBanner />}

            {/* Main Content */}
            <div className="grid grid-cols-3 gap-6">
                {/* Screen Capture View */}
                <div className="col-span-2">
                    <div className="glass-card overflow-hidden">
                        <div className="p-3 border-b border-muninn-border flex items-center justify-between">
                            <span className="text-sm text-muninn-text-dim">Screen Capture Feed</span>
                            <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${appState.isCapturing ? 'bg-muninn-success animate-pulse' : 'bg-muninn-text-muted'}`} />
                                <span className="text-xs text-muninn-text-muted">
                                    {appState.isCapturing ? 'LIVE' : 'OFFLINE'}
                                </span>
                            </div>
                        </div>
                        <div className="relative bg-black aspect-video">
                            <canvas
                                ref={canvasRef}
                                width={960}
                                height={540}
                                className="w-full h-full"
                            />
                            {!appState.isCapturing && (
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="text-center">
                                        <div className="mb-4 text-sm uppercase tracking-[0.3em] text-white/35">Preview</div>
                                        <p className="text-muninn-text-muted text-sm">
                                            Click "Start Recognition" to begin the loop
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Detection Stats */}
                    <div className="grid grid-cols-2 gap-4 mt-4">
                        <div className="glass-card p-4">
                            <div className="text-xs text-muninn-text-muted">Detected Faces</div>
                            <div className="text-2xl font-bold text-white mt-1">{appState.detectedFaces.length}</div>
                        </div>
                        <div className="glass-card p-4">
                            <div className="text-xs text-muninn-text-muted">Recognition</div>
                            <div className="text-sm mt-1">
                                {appState.activeRecognition ? (
                                    <span className="badge-success">Active</span>
                                ) : (
                                    <span className="text-muninn-text-muted">Scanning...</span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="space-y-4" />
            </div>
        </div>
    );
}
