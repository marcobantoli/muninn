import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom/client';
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
    const lastEmitRef = useRef(0);
    const trackingStartedRef = useRef(false);

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
            stopTracking();
        };
    }, []);

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
                    className="fixed"
                    style={{
                        left: data.x || 20,
                        top: data.y || 20,
                        width: 340,
                        pointerEvents: 'none'
                    }}
                >
                    <div className="animate-slide-up" style={{ pointerEvents: 'none' }}>
                        <PersonhoodCard note={data.note} />
                    </div>
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
