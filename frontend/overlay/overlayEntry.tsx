import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom/client';
import '../index.css';
import { OverlayData } from '../../shared/types';
import { PersonhoodCard } from '../components/PersonhoodCard';

function OverlayApp() {
    const [data, setData] = useState<OverlayData | null>(null);
    const [overlayPhase, setOverlayPhase] = useState<'pulse' | 'full'>('full');
    const phaseTimeoutRef = useRef<number | null>(null);
    const noteContainerRef = useRef<HTMLDivElement | null>(null);
    const noteInteractiveRef = useRef(false);

    useEffect(() => {
        if (window.electronAPI) {
            window.electronAPI.onOverlayData((overlayData: OverlayData) => {
                setData(overlayData);
            });
        }

        return () => {
            if (phaseTimeoutRef.current !== null) {
                window.clearTimeout(phaseTimeoutRef.current);
            }
            setNoteInteractive(false);
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
        if (!data?.visible || !data.note) {
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
    }, [data?.note, data?.visible, overlayPhase]);

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
        </>
    );
}

const root = document.getElementById('overlay-root');
if (root) {
    ReactDOM.createRoot(root).render(<OverlayApp />);
}
