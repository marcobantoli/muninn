import React, { useState, useEffect } from 'react';
import { getCalibrationPoints, recordCalibrationPoint, CalibrationPoint, startCalibration, endCalibration } from '../../vision/gazeTracking';

interface CalibrationOverlayProps {
    onComplete: () => void;
}

export function CalibrationOverlay({ onComplete }: CalibrationOverlayProps) {
    const [points, setPoints] = useState<CalibrationPoint[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [clickCount, setClickCount] = useState(0);
    const CLICKS_PER_POINT = 5;

    useEffect(() => {
        const pts = getCalibrationPoints(window.innerWidth, window.innerHeight);
        setPoints(pts);

        startCalibration();

        return () => {
            endCalibration();
        };
    }, []);

    function handlePointClick(index: number) {
        if (index !== currentIndex) return;

        const point = points[index];
        recordCalibrationPoint(point.x, point.y);

        const newCount = clickCount + 1;
        setClickCount(newCount);

        if (newCount >= CLICKS_PER_POINT) {
            const updated = [...points];
            updated[index].completed = true;
            setPoints(updated);

            if (index + 1 >= points.length) {
                setTimeout(onComplete, 500);
                return;
            }

            setCurrentIndex(index + 1);
            setClickCount(0);
        }
    }

    return (
        <div className="fixed inset-0 z-50 bg-muninn-bg/95 backdrop-blur-sm">
            {/* Instructions */}
            <div className="absolute top-8 left-1/2 -translate-x-1/2 text-center animate-fade-in">
                <h2 className="text-xl font-bold text-white mb-2">Gaze Calibration</h2>
                <p className="text-sm text-muninn-text-dim">
                    Click each dot {CLICKS_PER_POINT} times while looking at it.
                    Point {currentIndex + 1} of {points.length}
                </p>
                <div className="mt-2 flex items-center justify-center gap-1">
                    {Array.from({ length: CLICKS_PER_POINT }).map((_, i) => (
                        <div
                            key={i}
                            className={`w-2 h-2 rounded-full transition-colors ${i < clickCount ? 'bg-muninn-accent' : 'bg-muninn-border'
                                }`}
                        />
                    ))}
                </div>
            </div>

            {/* Calibration Points */}
            {points.map((point, i) => (
                <button
                    key={i}
                    onClick={() => handlePointClick(i)}
                    className={`absolute w-8 h-8 -ml-4 -mt-4 rounded-full transition-all duration-300
            ${point.completed
                            ? 'bg-muninn-success scale-50 opacity-50'
                            : i === currentIndex
                                ? 'bg-muninn-accent animate-pulse-glow scale-100 cursor-pointer'
                                : 'bg-muninn-border scale-75 opacity-30'
                        }`}
                    style={{ left: point.x, top: point.y }}
                    disabled={point.completed || i !== currentIndex}
                >
                    {i === currentIndex && !point.completed && (
                        <div className="absolute inset-0 rounded-full border-2 border-muninn-accent animate-ping" />
                    )}
                </button>
            ))}

            {/* Skip button */}
            <button
                onClick={onComplete}
                className="absolute bottom-8 right-8 btn-secondary text-sm"
            >
                Skip Calibration
            </button>
        </div>
    );
}
