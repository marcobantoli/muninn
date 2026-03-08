import React from 'react';

interface SidebarProps {
    currentPage: string;
    onNavigate: (page: any) => void;
}

const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: 'D', description: 'Profile overview' },
    { id: 'profile-editor', label: 'Profile Editor', icon: 'P', description: 'Create & edit' },
    { id: 'live-assistant', label: 'Live Assistant', icon: 'L', description: 'Recognition loop' },
];
export function Sidebar({ currentPage, onNavigate }: SidebarProps) {
    return (
        <aside className="w-72 h-screen bg-muninn-surface border-r border-muninn-border flex flex-col">
            {/* Logo */}
            <div className="p-6 border-b border-muninn-border">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-muninn-accent to-muninn-accent-light
                                                    flex items-center justify-center text-sm font-semibold shadow-glow">
                                                MN
                    </div>
                    <div>
                        <h1 className="text-lg font-bold text-white tracking-tight">MUNINN</h1>
                        <p className="text-xs text-muninn-text-muted">Cognitive Gaze Assistant</p>
                    </div>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-4 space-y-1">
                {navItems.map((item) => (
                    <button
                        key={item.id}
                        id={`nav-${item.id}`}
                        onClick={() => onNavigate(item.id)}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all duration-200
              ${currentPage === item.id
                                ? 'bg-muninn-accent/15 text-white border border-muninn-accent/30 shadow-glow'
                                : 'text-muninn-text-dim hover:bg-muninn-card hover:text-white'
                            }`}
                    >
                        <span className="text-lg">{item.icon}</span>
                        <div>
                            <div className="text-sm font-medium">{item.label}</div>
                            <div className="text-xs text-muninn-text-muted">{item.description}</div>
                        </div>
                    </button>
                ))}
            </nav>

            {/* Status */}
            <div className="p-4 border-t border-muninn-border">
                <div className="glass-card p-3 space-y-2">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-muninn-success animate-pulse" />
                        <span className="text-xs text-muninn-text-dim">System Ready</span>
                    </div>
                    <p className="text-[10px] text-muninn-text-muted leading-tight">
                        AI-Augmented Personhood Retrieval for Dementia Support
                    </p>
                </div>
            </div>
        </aside>
    );
}
