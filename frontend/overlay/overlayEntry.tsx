import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom/client';
import '../index.css';
import { HoverPreview, OverlayData } from '../../shared/types';
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
        setData((prev) => (prev ? { ...prev, visible: false, note: null, hoverPreview: null } : prev));
        window.electronAPI?.hideOverlay();
    }

    function renderHoverPreview(hoverPreview: HoverPreview) {
        const statusLabel = hoverPreview.status === 'recognized'
            ? 'Recognized candidate'
            : hoverPreview.status === 'low-confidence'
                ? 'Low confidence'
                : 'Not recognized';
        const statusClassName = hoverPreview.status === 'recognized'
            ? 'border-emerald-200/50 bg-emerald-200 text-slate-950 shadow-[0_0_18px_rgba(110,231,183,0.35)]'
            : hoverPreview.status === 'low-confidence'
                ? 'border-amber-200/50 bg-amber-200 text-slate-950 shadow-[0_0_18px_rgba(253,224,71,0.35)]'
                : 'border-rose-200/50 bg-rose-200 text-slate-950 shadow-[0_0_18px_rgba(253,164,175,0.35)]';
        const progressClassName = hoverPreview.status === 'recognized'
            ? 'from-emerald-200 via-lime-300 to-cyan-300'
            : hoverPreview.status === 'low-confidence'
                ? 'from-amber-200 via-yellow-300 to-orange-300'
                : 'from-rose-200 via-orange-300 to-amber-300';

        return (
            <div
                className="fixed z-50"
                style={{
                    top: 16,
                    right: 16,
                    width: 360,
                    pointerEvents: 'none'
                }}
            >
                <div className="animate-slide-up overflow-hidden rounded-2xl border border-white/18 bg-slate-950/98 text-slate-50 shadow-[0_24px_80px_rgba(2,6,23,0.92)] ring-1 ring-black/80 transition-all duration-200">
                    <div className="border-b border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(148,163,184,0.14),_transparent_46%),linear-gradient(180deg,rgba(15,23,42,0.99),rgba(2,6,23,0.98))] px-4 py-4 backdrop-blur-md">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-200/90">Hover Target</div>
                                <div className="mt-2 text-base font-semibold leading-tight text-white">{hoverPreview.title}</div>
                                <div className="mt-1 text-[13px] text-slate-200">{hoverPreview.subtitle}</div>
                            </div>
                            <div className="rounded-full border border-white/15 bg-white px-3 py-1 text-[11px] font-semibold text-slate-950 shadow-[0_0_18px_rgba(255,255,255,0.18)]">
                                {Math.round(hoverPreview.progress * 100)}%
                            </div>
                        </div>

                        <div className="mt-4 flex items-center justify-between gap-3">
                            <div className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${statusClassName}`}>
                                {statusLabel}
                            </div>
                            <div className="text-[11px] text-slate-300">
                                {hoverPreview.distance !== undefined ? `Distance ${hoverPreview.distance.toFixed(3)}` : 'Hold to confirm'}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3 bg-slate-950/98 px-4 py-4">
                        <div className="h-2 overflow-hidden rounded-full bg-white/12 ring-1 ring-white/10">
                            <div
                                className={`h-full rounded-full bg-gradient-to-r ${progressClassName} transition-all duration-150`}
                                style={{ width: `${Math.max(8, hoverPreview.progress * 100)}%` }}
                            />
                        </div>
                        <div className="rounded-2xl border border-white/8 bg-white/5 px-3 py-2.5 text-[11px] text-slate-200">
                            {hoverPreview.status === 'recognized'
                                ? 'Hold the cursor steady to open the full information card.'
                                : hoverPreview.status === 'low-confidence'
                                    ? 'Possible match detected. Hold steady to keep tracking while confidence improves.'
                                    : 'This face does not match a linked profile yet.'}
                        </div>
                    </div>
                </div>
            </div>
        );
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

            {data?.visible && !data.note && data.hoverPreview && renderHoverPreview(data.hoverPreview)}
        </>
    );
}

const root = document.getElementById('overlay-root');
if (root) {
    ReactDOM.createRoot(root).render(<OverlayApp />);
}
