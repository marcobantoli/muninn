import React, { useEffect, useState } from 'react';
import { PersonProfile } from '../../shared/types';

interface DashboardProps {
    onEditProfile: (id: string) => void;
}

const API_BASE = 'http://localhost:3001/api';

export function Dashboard({ onEditProfile }: DashboardProps) {
    const [profiles, setProfiles] = useState<PersonProfile[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchProfiles();
    }, []);

    async function fetchProfiles() {
        try {
            const res = await fetch(`${API_BASE}/profiles`);
            const data = await res.json();
            setProfiles(data);
        } catch (err) {
            console.error('Failed to fetch profiles:', err);
        } finally {
            setLoading(false);
        }
    }

    async function deleteProfile(id: string) {
        if (!confirm('Delete this profile?')) return;
        try {
            await fetch(`${API_BASE}/profiles/${id}`, { method: 'DELETE' });
            setProfiles(profiles.filter(p => p.id !== id));
        } catch (err) {
            console.error('Failed to delete:', err);
        }
    }

    const relationshipColors: Record<string, string> = {
        'Daughter': 'badge-accent',
        'Son': 'badge-accent',
        'Best Friend': 'badge-success',
        'Doctor': 'badge-warning',
    };

    return (
        <div className="p-8 max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-white tracking-tight">
                    Person Profiles
                </h1>
                <p className="mt-1 text-muninn-text-dim">
                    Manage personhood data for the recognition system
                </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 mb-8">
                <div className="glass-card p-5">
                    <div className="text-muninn-text-muted text-sm">Total Profiles</div>
                    <div className="stat-value mt-1">{profiles.length}</div>
                </div>
                <div className="glass-card p-5">
                    <div className="text-muninn-text-muted text-sm">Family Members</div>
                    <div className="stat-value mt-1">
                        {profiles.filter(p => ['Daughter', 'Son', 'Wife', 'Husband'].includes(p.relationship)).length}
                    </div>
                </div>
                <div className="glass-card p-5">
                    <div className="text-muninn-text-muted text-sm">Linked Faces</div>
                    <div className="stat-value mt-1">0</div>
                </div>
            </div>

            {/* Profile Grid */}
            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <div className="w-8 h-8 border-2 border-muninn-accent/30 border-t-muninn-accent rounded-full animate-spin" />
                </div>
            ) : profiles.length === 0 ? (
                <div className="glass-card p-12 text-center">
                    <div className="text-4xl mb-4">👤</div>
                    <p className="text-muninn-text-dim">No profiles yet. Create one to get started.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {profiles.map((profile) => (
                        <div
                            key={profile.id}
                            id={`profile-card-${profile.id}`}
                            className="glass-card-hover p-5 cursor-pointer group"
                            onClick={() => onEditProfile(profile.id)}
                        >
                            {/* Avatar + Name */}
                            <div className="flex items-start gap-4">
                                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-muninn-accent/30 to-muninn-accent-light/20
                                flex items-center justify-center text-2xl flex-shrink-0
                                border border-muninn-accent/20 group-hover:shadow-glow transition-all">
                                    {profile.name.charAt(0)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-white font-semibold truncate">{profile.name}</h3>
                                    <span className={relationshipColors[profile.relationship] || 'badge-accent'}>
                                        {profile.relationship}
                                    </span>
                                </div>
                            </div>

                            {/* Summary */}
                            <p className="mt-3 text-sm text-muninn-text-dim line-clamp-2">
                                {profile.identity_summary}
                            </p>

                            {/* Tags */}
                            <div className="mt-3 flex flex-wrap gap-1.5">
                                {profile.hobbies.slice(0, 3).map((hobby: string, i: number) => (
                                    <span key={i} className="px-2 py-0.5 bg-muninn-surface rounded-lg text-xs text-muninn-text-muted">
                                        {hobby}
                                    </span>
                                ))}
                            </div>

                            {/* Actions */}
                            <div className="mt-4 flex items-center justify-between">
                                <span className="text-xs text-muninn-text-muted">
                                    {profile.conversation_starters.length} conversation starters
                                </span>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        deleteProfile(profile.id);
                                    }}
                                    className="text-xs text-muninn-danger/60 hover:text-muninn-danger transition-colors"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
