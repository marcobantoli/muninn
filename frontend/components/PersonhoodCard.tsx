import React from 'react';
import { PersonhoodNote } from '../../shared/types';

interface PersonhoodCardProps {
    note: PersonhoodNote;
    onDismiss?: () => void;
}

export function PersonhoodCard({ note, onDismiss }: PersonhoodCardProps) {
    const accentClass = getAccentClasses(note.relationship);

    return (
        <div className="overflow-hidden rounded-[24px] border border-white/10 bg-slate-950/95 text-slate-50 shadow-[0_24px_80px_rgba(15,23,42,0.55)] animate-slide-up">
            <div className="border-b border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(148,163,184,0.18),_transparent_48%),linear-gradient(135deg,rgba(15,23,42,0.98),rgba(30,41,59,0.92))] p-4">
                <div className="mb-3 flex items-center justify-between text-[10px] uppercase tracking-[0.28em] text-slate-300/80">
                    <span className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${accentClass.dot}`} />
                        Live Recognition
                    </span>
                    <span>Muninn Overlay</span>
                </div>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl text-lg font-semibold ${accentClass.avatar}`}>
                            {note.name.charAt(0)}
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-white">{note.name}</h3>
                            <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ${accentClass.badge}`}>
                                {note.relationship}
                            </span>
                        </div>
                    </div>
                    {onDismiss && (
                        <button
                            onClick={onDismiss}
                            className="text-muninn-text-muted hover:text-white transition-colors text-sm"
                        >
                            Close
                        </button>
                    )}
                </div>

                <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3">
                    <div className="text-[11px] uppercase tracking-[0.24em] text-slate-300/70">Open With</div>
                    <p className="mt-2 text-sm leading-relaxed text-slate-50">
                        {note.opener ? `"${note.opener}"` : note.points[0]}
                    </p>
                </div>
            </div>

            <div className="space-y-4 p-4">
                <div className="rounded-2xl border border-white/8 bg-slate-900/65 p-4">
                    <div className="text-[11px] uppercase tracking-[0.24em] text-slate-300/70">Why This Person Matters</div>
                    <p className="mt-2 text-sm leading-relaxed text-slate-100">
                        {note.summary || note.points[1] || note.points[0]}
                    </p>
                </div>

                {note.highlights && note.highlights.length > 0 && (
                    <div>
                        <div className="mb-2 text-[11px] uppercase tracking-[0.24em] text-slate-300/70">Highlights</div>
                        <div className="flex flex-wrap gap-2">
                            {note.highlights.map((highlight, index) => (
                                <span
                                    key={`${highlight}-${index}`}
                                    className={`inline-flex rounded-full border px-3 py-1.5 text-xs ${accentClass.pill}`}
                                >
                                    {highlight}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                <div className="grid gap-3">
                    <div className="rounded-2xl border border-amber-400/20 bg-amber-300/10 p-3">
                        <div className="text-[11px] uppercase tracking-[0.24em] text-amber-100/80">Memory Spark</div>
                        <p className="mt-2 text-sm leading-relaxed text-amber-50">
                            {note.memorySpark || note.points[2] || note.points[1]}
                        </p>
                    </div>

                    <div className="rounded-2xl border border-emerald-400/18 bg-emerald-300/10 p-3">
                        <div className="text-[11px] uppercase tracking-[0.24em] text-emerald-100/80">Best Approach</div>
                        <p className="mt-2 text-sm leading-relaxed text-emerald-50">
                            {note.careTip || note.points[3] || note.points[0]}
                        </p>
                    </div>
                </div>

                <div className="space-y-2 rounded-2xl border border-white/8 bg-slate-900/55 p-4">
                    <div className="text-[11px] uppercase tracking-[0.24em] text-slate-300/70">Conversation Thread</div>
                    {note.points.slice(0, 4).map((point, i) => (
                        <div key={i} className="flex items-start gap-3 text-sm">
                            <span className={`mt-1 h-2 w-2 rounded-full ${accentClass.dot}`} />
                            <span className="leading-relaxed text-slate-100">{point}</span>
                        </div>
                    ))}
                </div>
            </div>

            {note.hcpGuidance && note.hcpGuidance.length > 0 && (
                <div className="border-t border-white/10 bg-emerald-300/8 p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-medium uppercase tracking-[0.24em] text-emerald-200">HCP Guidance</span>
                    </div>
                    <div className="space-y-1.5">
                        {note.hcpGuidance.map((tip, i) => (
                            <div key={i} className="flex items-start gap-2 text-xs">
                                <span className="mt-0.5 text-emerald-300/70">›</span>
                                <span className="leading-relaxed text-slate-200">{tip}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="border-t border-white/10 bg-slate-900/90 px-4 py-3">
                <span className="text-[10px] uppercase tracking-[0.24em] text-slate-400">
                    Generated at {new Date(note.generatedAt).toLocaleTimeString()}
                </span>
            </div>
        </div>
    );
}

function getAccentClasses(relationship: string): { dot: string; avatar: string; badge: string; pill: string } {
    const normalized = relationship.toLowerCase();

    if (normalized.includes('doctor') || normalized.includes('nurse') || normalized.includes('clin')) {
        return {
            dot: 'bg-emerald-400',
            avatar: 'bg-emerald-400/20 text-emerald-100 ring-1 ring-emerald-300/25',
            badge: 'bg-emerald-400/16 text-emerald-100 ring-1 ring-emerald-300/25',
            pill: 'border-emerald-300/20 bg-emerald-300/10 text-emerald-50'
        };
    }

    if (normalized.includes('friend')) {
        return {
            dot: 'bg-amber-300',
            avatar: 'bg-amber-300/20 text-amber-50 ring-1 ring-amber-200/25',
            badge: 'bg-amber-300/16 text-amber-50 ring-1 ring-amber-200/25',
            pill: 'border-amber-200/20 bg-amber-300/10 text-amber-50'
        };
    }

    return {
        dot: 'bg-sky-300',
        avatar: 'bg-sky-300/20 text-sky-50 ring-1 ring-sky-200/25',
        badge: 'bg-sky-300/16 text-sky-50 ring-1 ring-sky-200/25',
        pill: 'border-sky-200/20 bg-sky-300/10 text-sky-50'
    };
}
