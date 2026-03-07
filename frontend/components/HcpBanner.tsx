import React from 'react';

export function HcpBanner() {
    return (
        <div className="mb-6 glass-card p-4 border-l-4 border-muninn-success animate-fade-in">
            <div className="flex items-start gap-3">
                <span className="text-xl">🏥</span>
                <div>
                    <h3 className="text-sm font-semibold text-muninn-success">Healthcare Professional Mode Active</h3>
                    <p className="text-xs text-muninn-text-dim mt-1">
                        Additional clinical guidance will appear in recognition overlays.
                        Key principles: validate emotions, avoid correcting memory, redirect gently.
                    </p>
                    <div className="flex flex-wrap gap-2 mt-2">
                        {['Validate emotions', 'No corrections', 'Gentle redirect', 'Slow speech', 'Eye contact'].map((tip, i) => (
                            <span key={i} className="px-2 py-0.5 bg-muninn-success/10 text-muninn-success text-xs rounded-full">
                                {tip}
                            </span>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
