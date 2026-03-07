import React, { useEffect, useRef, useState, useCallback } from 'react';
import { PersonhoodNote, AppState } from '../../shared/types';
import { startScreenCapture, stopScreenCapture, getVideoElement } from '../../vision/screenCapture';
import { detectFaces, initFaceDetection } from '../../vision/faceDetection';
import {
    processFacePresence, onRecognition, resetRecognitionEngine,
    simulateHeartRate, setHcpMode, getDwellProgress,
    updateFaceMatcher, FaceScreenPosition
} from '../../vision/recognitionEngine';
import { PersonhoodCard } from '../components/PersonhoodCard';
import { BiometricPanel } from '../components/BiometricPanel';
import { HcpBanner } from '../components/HcpBanner';

const API_BASE = 'http://localhost:3001/api';

export function LiveAssistant() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [appState, setAppState] = useState<AppState>({
        isCapturing: false,
        isCalibrated: true,
        hcpMode: false,
        heartRate: 72,
        detectedFaces: [],
        gazePoint: null,
        activeRecognition: null,
    });
    const [statusMessage, setStatusMessage] = useState('Ready to start');
    const [recognizedFacePos, setRecognizedFacePos] = useState<FaceScreenPosition | null>(null);
    const loopRef = useRef<number | null>(null);

    // Recognition callback
    useEffect(() => {
        const unsub = onRecognition((note: PersonhoodNote, facePosition) => {
            setAppState((prev: AppState) => ({ ...prev, activeRecognition: note }));
            setRecognizedFacePos(facePosition);

            // Position the Electron overlay at the top-right of the face on the actual screen
            if (window.electronAPI) {
                window.electronAPI.showOverlay({
                    visible: true,
                    note,
                    x: Math.round(facePosition.x + facePosition.width + 8),
                    y: Math.max(0, Math.round(facePosition.y))
                });
            }

            // Auto-hide after 15 seconds
            setTimeout(() => {
                setAppState((prev: AppState) => ({ ...prev, activeRecognition: null }));
                setRecognizedFacePos(null);
                if (window.electronAPI) {
                    window.electronAPI.hideOverlay();
                }
            }, 15000);
        });

        return () => { unsub(); };
    }, []);

    const startLoop = useCallback(async () => {
        try {
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

            setStatusMessage('Recognition loop active — faces will be recognized automatically');

            // Main recognition loop (~10 fps)
            const runLoop = async () => {
                const video = getVideoElement();
                if (!video) return;

                // Detect faces
                const faces = await detectFaces(video);

                // Process face presence (triggers recognition after threshold)
                processFacePresence(faces);

                // Update heart rate
                const hr = simulateHeartRate();

                setAppState((prev: AppState) => ({
                    ...prev,
                    detectedFaces: faces,
                    heartRate: hr,
                }));

                // Draw on canvas
                drawVisualization(faces);

                loopRef.current = requestAnimationFrame(runLoop);
            };

            loopRef.current = requestAnimationFrame(runLoop);
        } catch (err) {
            console.error('Loop start failed:', err);
            setStatusMessage('Error starting recognition loop');
        }
    }, []);

    const stopLoop = useCallback(() => {
        if (loopRef.current) {
            cancelAnimationFrame(loopRef.current);
            loopRef.current = null;
        }
        stopScreenCapture();
        resetRecognitionEngine();
        setAppState((prev: AppState) => ({
            ...prev,
            isCapturing: false,
            detectedFaces: [],
            activeRecognition: null,
        }));
        setRecognizedFacePos(null);
        setStatusMessage('Stopped');
        if (window.electronAPI) {
            window.electronAPI.hideOverlay();
        }
    }, []);


    function drawVisualization(faces: import('../../vision/faceDetection').FaceWithDescriptor[]) {
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

        // Draw face bounding boxes
        faces.forEach((f: any) => {
            const face = f;
            const progress = getDwellProgress(face.id);
            const color = progress > 0.8 ? '#00b894' : progress > 0.3 ? '#fdcb6e' : '#6c5ce7';

            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.strokeRect(face.x * (canvas.width / 1920), face.y * (canvas.height / 1080),
                face.width * (canvas.width / 1920), face.height * (canvas.height / 1080));

            // Recognition progress bar
            if (progress > 0) {
                const barWidth = face.width * (canvas.width / 1920);
                ctx.fillStyle = color;
                ctx.fillRect(
                    face.x * (canvas.width / 1920),
                    (face.y + face.height) * (canvas.height / 1080) + 4,
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
                        <span className={appState.isCapturing ? 'animate-pulse' : ''}>👤</span>
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
                        {appState.hcpMode ? '🏥 HCP Mode ON' : '🏥 HCP Mode'}
                    </button>

                    {/* Start/Stop */}
                    {appState.isCapturing ? (
                        <button id="stop-btn" onClick={stopLoop} className="btn-danger text-sm">
                            ⏹ Stop
                        </button>
                    ) : (
                        <button id="start-btn" onClick={startLoop} className="btn-primary text-sm">
                            ▶ Start Recognition
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
                                        <div className="text-5xl mb-4 opacity-30">👁️</div>
                                        <p className="text-muninn-text-muted text-sm">
                                            Click "Start Recognition" to begin the loop
                                        </p>
                                    </div>
                                </div>
                            )}
                            {/* PersonhoodCard anchored at top-right of recognized face */}
                            {appState.activeRecognition && recognizedFacePos && (() => {
                                const VIDEO_W = 1920;
                                const VIDEO_H = 1080;
                                // Face top-right in percentage of the canvas
                                const rightPct = ((recognizedFacePos.x + recognizedFacePos.width) / VIDEO_W) * 100;
                                const topPct = (recognizedFacePos.y / VIDEO_H) * 100;
                                // If the face is in the right 60%, flip the card to the left side
                                const faceRightEdgePct = rightPct;
                                const flipToLeft = faceRightEdgePct > 60;

                                return (
                                    <div
                                        className="absolute z-10 animate-slide-up"
                                        style={{
                                            top: `${Math.max(0, topPct)}%`,
                                            ...(flipToLeft
                                                ? { right: `${Math.max(0, 100 - ((recognizedFacePos.x / VIDEO_W) * 100))}%` }
                                                : { left: `${Math.min(100, rightPct + 1)}%` }),
                                            width: 280,
                                            maxHeight: '90%',
                                            overflow: 'auto'
                                        }}
                                    >
                                        <PersonhoodCard
                                            note={appState.activeRecognition}
                                            onDismiss={() => {
                                                setAppState((prev: AppState) => ({ ...prev, activeRecognition: null }));
                                                setRecognizedFacePos(null);
                                            }}
                                        />
                                    </div>
                                );
                            })()}
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

                <div className="space-y-4">
                    {/* Biometric Panel */}
                    <BiometricPanel heartRate={appState.heartRate} isCapturing={appState.isCapturing} />
                </div>
            </div>
        </div>
    );
}
