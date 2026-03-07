import React from 'react';
import { PersonhoodNote } from '../../shared/types';

interface PersonhoodCardProps {
    note: PersonhoodNote;
    onDismiss?: () => void;
}

export function PersonhoodCard({ note, onDismiss }: PersonhoodCardProps) {
    return (
        <div className="glass-card border-muninn-accent/40 overflow-hidden animate-slide-up">
            {/* Header */}
            <div className="bg-gradient-to-r from-muninn-accent/20 to-transparent p-4 border-b border-muninn-border">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-muninn-accent/30 flex items-center justify-center text-lg">
                            {note.name.charAt(0)}
                        </div>
                        <div>
                            <h3 className="font-semibold text-white">{note.name}</h3>
                            <span className="badge-accent text-xs">{note.relationship}</span>
                        </div>
                    </div>
                    {onDismiss && (
                        <button
                            onClick={onDismiss}
                            className="text-muninn-text-muted hover:text-white transition-colors text-sm"
                        >
                            ✕
                        </button>
                    )}
                </div>
                {note.isStressed && (
                    <div className="mt-2 flex items-center gap-1.5 text-muninn-warning text-xs">
                        <span>⚠️</span>
                        <span>Elevated stress detected — showing emotional anchors</span>
                    </div>
                )}
            </div>

            {/* Points */}
            <div className="p-4 space-y-2">
                {note.points.map((point, i) => (
                    <div key={i} className="flex items-start gap-2.5 text-sm">
                        <span className="text-muninn-accent mt-0.5 text-xs">●</span>
                        <span className="text-muninn-text leading-relaxed">{point}</span>
                    </div>
                ))}
            </div>

            {/* HCP Guidance */}
            {note.hcpGuidance && note.hcpGuidance.length > 0 && (
                <div className="border-t border-muninn-border p-4 bg-muninn-success/5">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm">🏥</span>
                        <span className="text-xs font-medium text-muninn-success">HCP Guidance</span>
                    </div>
                    <div className="space-y-1.5">
                        {note.hcpGuidance.map((tip, i) => (
                            <div key={i} className="flex items-start gap-2 text-xs">
                                <span className="text-muninn-success/60 mt-0.5">›</span>
                                <span className="text-muninn-text-dim leading-relaxed">{tip}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Footer */}
            <div className="px-4 py-2 border-t border-muninn-border bg-muninn-surface/50">
                <span className="text-[10px] text-muninn-text-muted">
                    Generated at {new Date(note.generatedAt).toLocaleTimeString()}
                </span>
            </div>
        </div>
    );
}
