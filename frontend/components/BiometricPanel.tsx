import React, { useEffect, useState } from 'react';

interface BiometricPanelProps {
    heartRate: number;
    isCapturing: boolean;
}

export function BiometricPanel({ heartRate, isCapturing }: BiometricPanelProps) {
    const [history, setHistory] = useState<number[]>([]);

    useEffect(() => {
        if (isCapturing) {
            setHistory(prev => [...prev.slice(-29), heartRate]);
        }
    }, [heartRate, isCapturing]);

    const isElevated = heartRate > 100;
    const statusColor = isElevated ? 'text-muninn-danger' : heartRate > 85 ? 'text-muninn-warning' : 'text-muninn-success';
    const bgColor = isElevated ? 'bg-muninn-danger/10' : 'bg-muninn-surface';

    // Simple sparkline
    const sparkline = history.length > 1 ? history.map((v, i) => {
        const min = 55;
        const max = 125;
        const normalized = (v - min) / (max - min);
        return { x: (i / (history.length - 1)) * 100, y: (1 - normalized) * 100 };
    }) : [];

    return (
        <div className={`glass-card p-4 transition-colors duration-500 ${isElevated ? 'border-muninn-danger/40' : ''}`}>
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-muninn-text-dim flex items-center gap-2">
                    <span>❤️</span> Biometric Signal
                </h3>
                <span className="text-[10px] text-muninn-text-muted">SIMULATED</span>
            </div>

            <div className="flex items-end gap-3">
                <div className={`text-4xl font-bold font-mono ${statusColor} transition-colors`}>
                    {isCapturing ? heartRate : '—'}
                </div>
                <div className="text-sm text-muninn-text-muted mb-1">BPM</div>
            </div>

            {/* Sparkline */}
            {sparkline.length > 1 && (
                <div className="mt-3 h-10 relative">
                    <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
                        <polyline
                            fill="none"
                            stroke={isElevated ? '#e17055' : '#6c5ce7'}
                            strokeWidth="2"
                            points={sparkline.map(p => `${p.x},${p.y}`).join(' ')}
                        />
                        {/* Danger threshold line */}
                        <line x1="0" y1={`${(1 - (100 - 55) / (125 - 55)) * 100}`}
                            x2="100" y2={`${(1 - (100 - 55) / (125 - 55)) * 100}`}
                            stroke="#e17055" strokeWidth="0.5" strokeDasharray="4,4" opacity="0.5" />
                    </svg>
                </div>
            )}

            {/* Status */}
            <div className="mt-2 flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full ${isElevated ? 'bg-muninn-danger animate-pulse' : 'bg-muninn-success'}`} />
                <span className="text-xs text-muninn-text-muted">
                    {isElevated ? 'Elevated — emotional anchors prioritized' : 'Normal range'}
                </span>
            </div>
        </div>
    );
}
