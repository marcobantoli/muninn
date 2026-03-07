import React, { useEffect, useRef, useState, useCallback } from 'react';
import { FaceBoundingBox, GazePoint, PersonhoodNote, AppState } from '../../shared/types';
import { startScreenCapture, stopScreenCapture, captureFrame, getVideoElement } from '../../vision/screenCapture';
import { beginGazeCalibration, initGazeTracking, getLatestGaze, onCalibrationComplete, stopGazeTracking } from '../../vision/gazeTracking';
import { detectFaces, initFaceDetection } from '../../vision/faceDetection';
import {
    processGazeFaceIntersection, onRecognition, resetRecognitionEngine,
    simulateHeartRate, getHeartRate, setHcpMode, isHcpMode, getDwellProgress,
    updateFaceMatcher
} from '../../vision/recognitionEngine';
import { PersonhoodCard } from '../components/PersonhoodCard';
import { BiometricPanel } from '../components/BiometricPanel';
import { HcpBanner } from '../components/HcpBanner';

const API_BASE = 'http://localhost:3001/api';

export function LiveAssistant() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [appState, setAppState] = useState<AppState>({
        isCapturing: false,
        isCalibrated: false,
        hcpMode: false,
        heartRate: 72,
        detectedFaces: [],
        gazePoint: null,
        activeRecognition: null,
    });
    const [showCalibration, setShowCalibration] = useState(false);
    const [statusMessage, setStatusMessage] = useState('Ready to start');
    const loopRef = useRef<number | null>(null);

    // Recognition callback
    useEffect(() => {
        const unsub = onRecognition((note: PersonhoodNote) => {
            setAppState((prev: AppState) => ({ ...prev, activeRecognition: note }));

            // Also send to overlay window if available
            if (window.electronAPI) {
                window.electronAPI.showOverlay({
                    visible: true,
                    note,
                    x: 100,
                    y: 100
                });
            }

            // Auto-hide after 15 seconds
            setTimeout(() => {
                setAppState((prev: AppState) => ({ ...prev, activeRecognition: null }));
                if (window.electronAPI) {
                    window.electronAPI.hideOverlay();
                }
            }, 15000);
        });

        return () => { unsub(); };
    }, []);

    useEffect(() => {
        const unsub = onCalibrationComplete(() => {
            setShowCalibration(false);
            setAppState((prev: AppState) => ({ ...prev, isCalibrated: true }));
            setStatusMessage('Calibration complete — look at a face on your actual screen');
        });

        return () => {
            unsub();
        };
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

            setStatusMessage('Initializing eye tracking...');
            const gazeTrackingMode = await initGazeTracking();
            const requiresCalibration = gazeTrackingMode === 'webgazer';

            setAppState((prev: AppState) => ({
                ...prev,
                isCapturing: true,
                isCalibrated: !requiresCalibration,
            }));

            if (requiresCalibration) {
                setShowCalibration(true);
                setStatusMessage('Eye tracking ready — complete fullscreen calibration on your desktop');
            } else {
                setStatusMessage('Recognition loop active (mouse fallback)');
            }

            // Main recognition loop (~10 fps)
            const runLoop = async () => {
                const video = getVideoElement();
                if (!video) return;

                // Detect faces
                const faces = await detectFaces(video);

                // Get gaze
                const gaze = getLatestGaze();

                // Process intersection
                const dwell = processGazeFaceIntersection(gaze, faces);

                // Update heart rate
                const hr = simulateHeartRate();

                setAppState((prev: AppState) => ({
                    ...prev,
                    detectedFaces: faces,
                    gazePoint: gaze,
                    heartRate: hr,
                }));

                // Draw on canvas
                drawVisualization(faces, gaze);

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
        stopGazeTracking();
        resetRecognitionEngine();
        setAppState((prev: AppState) => ({
            ...prev,
            isCapturing: false,
            isCalibrated: false,
            detectedFaces: [],
            gazePoint: null,
            activeRecognition: null,
        }));
        setShowCalibration(false);
        setStatusMessage('Stopped');
        if (window.electronAPI) {
            window.electronAPI.hideOverlay();
        }
    }, []);

    const handleCalibrate = useCallback(async () => {
        setShowCalibration(true);
        setAppState((prev: AppState) => ({ ...prev, isCalibrated: false }));
        setStatusMessage('Recalibrating eye tracking on the fullscreen overlay...');

        try {
            await beginGazeCalibration();
        } catch (error) {
            console.error('[MUNINN] Failed to start recalibration:', error);
            setShowCalibration(false);
            setStatusMessage('Unable to start calibration');
        }
    }, []);

    function drawVisualization(faces: import('../../vision/faceDetection').FaceWithDescriptor[], gaze: GazePoint | null) {
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

            // Dwell progress bar
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

        // Draw gaze point
        if (gaze) {
            ctx.beginPath();
            ctx.arc(
                gaze.x * (canvas.width / screen.width),
                gaze.y * (canvas.height / screen.height),
                8, 0, Math.PI * 2
            );
            ctx.fillStyle = 'rgba(108, 92, 231, 0.6)';
            ctx.fill();

            ctx.beginPath();
            ctx.arc(
                gaze.x * (canvas.width / screen.width),
                gaze.y * (canvas.height / screen.height),
                3, 0, Math.PI * 2
            );
            ctx.fillStyle = '#fff';
            ctx.fill();
        }
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
                        <span className={appState.isCapturing ? 'animate-pulse' : ''}>👁️</span>
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

                    {/* Calibrate Button */}
                    <button
                        id="calibrate-btn"
                        onClick={handleCalibrate}
                        className="btn-secondary text-sm"
                        disabled={!appState.isCapturing || showCalibration}
                    >
                        {showCalibration ? '🎯 Calibrating...' : '🎯 Calibrate'}
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
                        </div>
                    </div>

                    {/* Detection Stats */}
                    <div className="grid grid-cols-3 gap-4 mt-4">
                        <div className="glass-card p-4">
                            <div className="text-xs text-muninn-text-muted">Detected Faces</div>
                            <div className="text-2xl font-bold text-white mt-1">{appState.detectedFaces.length}</div>
                        </div>
                        <div className="glass-card p-4">
                            <div className="text-xs text-muninn-text-muted">Gaze Position</div>
                            <div className="text-sm font-mono text-muninn-accent-light mt-1">
                                {appState.gazePoint
                                    ? `(${Math.round(appState.gazePoint.x)}, ${Math.round(appState.gazePoint.y)})`
                                    : '—'}
                            </div>
                        </div>
                        <div className="glass-card p-4">
                            <div className="text-xs text-muninn-text-muted">Recognition</div>
                            <div className="text-sm mt-1">
                                {appState.activeRecognition ? (
                                    <span className="badge-success">Active</span>
                                ) : (
                                    <span className="text-muninn-text-muted">Waiting...</span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Panel */}
                <div className="space-y-4">
                    {/* Biometric Panel */}
                    <BiometricPanel heartRate={appState.heartRate} isCapturing={appState.isCapturing} />

                    {/* Active Recognition Card */}
                    {appState.activeRecognition && (
                        <div className="animate-slide-up">
                            <PersonhoodCard
                                note={appState.activeRecognition}
                                onDismiss={() => setAppState((prev: AppState) => ({ ...prev, activeRecognition: null }))}
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
