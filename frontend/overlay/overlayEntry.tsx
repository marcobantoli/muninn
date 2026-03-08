import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom/client';
import '../index.css';
import { GazePoint, OverlayData, OverlayTrackingCommand } from '../../shared/types';
import { PersonhoodCard } from '../components/PersonhoodCard';
import { CalibrationOverlay } from '../components/CalibrationOverlay';
import { preflightWebcamAccess } from '../../vision/webcamAccess';

declare global {
    interface Window {
        webgazer: any;
    }
}

let webgazerScriptPromise: Promise<void> | null = null;

function loadWebGazerScript(): Promise<void> {
    if (window.webgazer) {
        return Promise.resolve();
    }

    if (webgazerScriptPromise) {
        return webgazerScriptPromise;
    }

    webgazerScriptPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://webgazer.cs.brown.edu/webgazer.js';
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load WebGazer.js in overlay window.'));
        document.head.appendChild(script);
    });

    return webgazerScriptPromise;
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

function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

function OverlayApp() {
    const [data, setData] = useState<OverlayData | null>(null);
    const [isCalibrating, setIsCalibrating] = useState(false);
    const [gazePoint, setGazePoint] = useState<GazePoint | null>(null);
    const [overlayPhase, setOverlayPhase] = useState<'pulse' | 'full'>('full');
    const lastEmitRef = useRef(0);
    const trackingStartedRef = useRef(false);
    const phaseTimeoutRef = useRef<number | null>(null);
    const noteContainerRef = useRef<HTMLDivElement | null>(null);
    const noteInteractiveRef = useRef(false);

    useEffect(() => {
        if (window.electronAPI) {
            window.electronAPI.onOverlayData((overlayData: OverlayData) => {
                setData(overlayData);
            });

            window.electronAPI.onOverlayTrackingCommand(async (command: OverlayTrackingCommand) => {
                if (command.type === 'start-eye-tracking') {
                    await startTracking();
                    return;
                }

                if (command.type === 'start-calibration') {
                    restartCalibration();
                    return;
                }

                stopTracking();
            });
        }

        return () => {
            if (phaseTimeoutRef.current !== null) {
                window.clearTimeout(phaseTimeoutRef.current);
            }
            setNoteInteractive(false);
            stopTracking();
        };
    }, []);

    useEffect(() => {
        if (!data?.visible || !data.note) {
            setOverlayPhase('full');
            if (phaseTimeoutRef.current !== null) {
                window.clearTimeout(phaseTimeoutRef.current);
                phaseTimeoutRef.current = null;
            }
            return;
        }

        setOverlayPhase('pulse');
        if (phaseTimeoutRef.current !== null) {
            window.clearTimeout(phaseTimeoutRef.current);
        }

        phaseTimeoutRef.current = window.setTimeout(() => {
            setOverlayPhase('full');
            phaseTimeoutRef.current = null;
        }, 900);
    }, [data?.note?.generatedAt, data?.visible]);

    useEffect(() => {
        if (!data?.visible || !data.note || isCalibrating) {
            setNoteInteractive(false);
            return;
        }

        const updateInteractivity = (clientX: number, clientY: number) => {
            const noteContainer = noteContainerRef.current;
            if (!noteContainer) {
                setNoteInteractive(false);
                return;
            }

            const rect = noteContainer.getBoundingClientRect();
            const isInside = clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
            setNoteInteractive(isInside);
        };

        const handleMouseMove = (event: MouseEvent) => {
            updateInteractivity(event.clientX, event.clientY);
        };

        const handleMouseLeave = () => {
            setNoteInteractive(false);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseleave', handleMouseLeave);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseleave', handleMouseLeave);
            setNoteInteractive(false);
        };
    }, [data?.note, data?.visible, isCalibrating, overlayPhase]);

    function setNoteInteractive(interactive: boolean) {
        if (!window.electronAPI || noteInteractiveRef.current === interactive) {
            return;
        }

        noteInteractiveRef.current = interactive;
        window.electronAPI.setOverlayNoteInteractive(interactive);
    }

    function handleOverlayDismiss() {
        setNoteInteractive(false);
        setOverlayPhase('full');
        setData((prev) => (prev ? { ...prev, visible: false, note: null } : prev));
        window.electronAPI?.hideOverlay();
    }

    async function startTracking() {
        try {
            await loadWebGazerScript();
            await preflightWebcamAccess();

            if (!trackingStartedRef.current) {
                const webgazer = window.webgazer
                    .setRegression?.('ridge')
                    ?.setGazeListener?.((prediction: { x: number; y: number } | null) => {
                        if (!prediction || !Number.isFinite(prediction.x) || !Number.isFinite(prediction.y)) {
                            setGazePoint(null);
                            return;
                        }

                        const gaze: GazePoint = {
                            x: clamp(prediction.x, 0, window.innerWidth),
                            y: clamp(prediction.y, 0, window.innerHeight),
                            timestamp: Date.now()
                        };

                        setGazePoint(gaze);

                        if (Date.now() - lastEmitRef.current >= 33) {
                            lastEmitRef.current = Date.now();
                            window.electronAPI.emitGazeData(gaze);
                        }
                    });

                if (!webgazer || typeof webgazer.begin !== 'function') {
                    throw new Error('Overlay WebGazer API is incomplete.');
                }

                await webgazer.begin();

                if (typeof webgazer.saveDataAcrossSessions === 'function') {
                    webgazer.saveDataAcrossSessions(false);
                }

                if (typeof webgazer.applyKalmanFilter === 'function') {
                    webgazer.applyKalmanFilter(true);
                }

                trackingStartedRef.current = true;
            }

            restartCalibration();
            window.electronAPI.emitOverlayTrackingReady({ mode: 'webgazer' });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown overlay eye tracking error.';
            window.electronAPI.emitOverlayTrackingError(message);
        }
    }

    function restartCalibration() {
        if (window.webgazer && typeof window.webgazer.clearData === 'function') {
            window.webgazer.clearData();
        }

        configureWebGazerUi(true);
        setIsCalibrating(true);
        setGazePoint(null);
    }

    function stopTracking() {
        configureWebGazerUi(false);
        setIsCalibrating(false);
        setGazePoint(null);

        if (window.webgazer && trackingStartedRef.current) {
            try {
                window.webgazer.end();
            } catch (error) {
                console.warn('[MUNINN Overlay] Failed to stop WebGazer cleanly:', error);
            }
        }

        trackingStartedRef.current = false;
    }

    function handleCalibrationComplete() {
        configureWebGazerUi(false);
        setIsCalibrating(false);
        window.electronAPI.emitGazeCalibrationComplete();
    }

    return (
        <>
            {data?.visible && data.note && (
                <div
                    className="fixed z-50"
                    style={{
                        top: 16,
                        right: 16,
                        width: 360,
                        pointerEvents: 'none'
                    }}
                >
                    {overlayPhase === 'pulse' ? (
                        <div
                            ref={noteContainerRef}
                            className="animate-slide-up rounded-2xl border border-sky-200/20 bg-slate-950/95 px-4 py-3 text-slate-50 shadow-2xl"
                            style={{ pointerEvents: 'auto' }}
                        >
                            <div className="mb-3 flex items-center justify-between text-[10px] uppercase tracking-[0.28em] text-slate-300/75">
                                <span>Recognized</span>
                                <button
                                    type="button"
                                    onClick={handleOverlayDismiss}
                                    className="rounded-full border border-white/10 px-2 py-1 text-[10px] tracking-[0.2em] text-slate-300 transition-colors hover:text-white"
                                >
                                    Close
                                </button>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="h-3 w-3 animate-pulse rounded-full bg-sky-300 shadow-[0_0_18px_rgba(125,211,252,0.9)]" />
                                <div>
                                    <div className="text-sm font-semibold text-white">{data.note.name}</div>
                                </div>
                                <div className="ml-auto rounded-full bg-sky-300/12 px-2.5 py-1 text-[11px] text-sky-100 ring-1 ring-sky-200/20">
                                    {data.note.relationship}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div
                            ref={noteContainerRef}
                            className="animate-slide-up rounded-2xl border border-white/15 bg-slate-950/94 text-slate-50 shadow-2xl"
                            style={{ pointerEvents: 'auto' }}
                        >
                            <PersonhoodCard note={data.note} onDismiss={handleOverlayDismiss} />
                        </div>
                    )}
                </div>
            )}

            {gazePoint && !isCalibrating && (
                <div
                    className="fixed w-4 h-4 rounded-full border border-white/80 bg-muninn-accent/30"
                    style={{
                        left: gazePoint.x - 8,
                        top: gazePoint.y - 8,
                        pointerEvents: 'none',
                        boxShadow: '0 0 20px rgba(108, 92, 231, 0.5)'
                    }}
                />
            )}

            {isCalibrating && <CalibrationOverlay onComplete={handleCalibrationComplete} />}
        </>
    );
}

const root = document.getElementById('overlay-root');
if (root) {
    ReactDOM.createRoot(root).render(<OverlayApp />);
}
