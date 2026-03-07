import React, { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './pages/Dashboard';
import { ProfileEditor } from './pages/ProfileEditor';
import { LiveAssistant } from './pages/LiveAssistant';

type Page = 'dashboard' | 'profile-editor' | 'live-assistant';

export default function App() {
    const [currentPage, setCurrentPage] = useState<Page>('dashboard');
    const [editingProfileId, setEditingProfileId] = useState<string | null>(null);

    const navigateTo = (page: Page, profileId?: string) => {
        setCurrentPage(page);
        if (profileId) setEditingProfileId(profileId);
        else setEditingProfileId(null);
    };

    const renderPage = () => {
        switch (currentPage) {
            case 'dashboard':
                return <Dashboard onEditProfile={(id) => navigateTo('profile-editor', id)} />;
            case 'profile-editor':
                return <ProfileEditor profileId={editingProfileId} onBack={() => navigateTo('dashboard')} />;
            case 'live-assistant':
                return <LiveAssistant />;
            default:
                return <Dashboard onEditProfile={(id) => navigateTo('profile-editor', id)} />;
        }
    };

    return (
        <div className="flex h-screen overflow-hidden bg-muninn-bg">
            <Sidebar currentPage={currentPage} onNavigate={navigateTo} />
            <main className="flex-1 overflow-y-auto">
                <div className="animate-fade-in">
                    {renderPage()}
                </div>
            </main>
        </div>
    );
}
