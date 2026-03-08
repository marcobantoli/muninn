import React, { useEffect, useState, useRef } from 'react';
import { PersonProfile } from '../../shared/types';
import { extractFaceDescriptorFromImage } from '../../vision/faceDetection';

interface ProfileEditorProps {
    profileId: string | null;
    onBack: () => void;
}

const API_BASE = 'http://localhost:3001/api';

const emptyProfile: Partial<PersonProfile> = {
    name: '',
    relationship: '',
    identity_summary: '',
    hobbies: [],
    pride_points: [],
    emotional_anchors: [],
    conversation_starters: [],
    communication_tips: [],
};

export function ProfileEditor({ profileId, onBack }: ProfileEditorProps) {
    const [form, setForm] = useState<Partial<PersonProfile>>(emptyProfile);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');
    const [capturingFace, setCapturingFace] = useState(false);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const isEditing = !!profileId;

    useEffect(() => {
        if (profileId) {
            fetchProfile(profileId);
        } else {
            setForm(emptyProfile);
        }
    }, [profileId]);

    async function fetchProfile(id: string) {
        try {
            const res = await fetch(`${API_BASE}/profiles/${id}`);
            const data = await res.json();
            setForm(data);
        } catch (err) {
            console.error('Failed to fetch profile:', err);
        }
    }

    async function handleSave() {
        setSaving(true);
        setMessage('');
        try {
            const url = isEditing
                ? `${API_BASE}/profiles/${profileId}`
                : `${API_BASE}/profiles`;
            const method = isEditing ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            });

            if (res.ok) {
                setMessage(isEditing ? 'Profile updated!' : 'Profile created!');
                if (!isEditing) {
                    const created = await res.json();
                    setForm(created);
                }
            }
        } catch (err) {
            setMessage('Error saving profile');
        } finally {
            setSaving(false);
        }
    }

    async function startWebcam() {
        try {
            const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
            setStream(mediaStream);
            setCapturingFace(true);
            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream;
            }
        } catch (err) {
            console.error('Error accessing webcam', err);
            setMessage('Could not access webcam');
        }
    }

    function stopWebcam() {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
        }
        setCapturingFace(false);
    }

    async function captureFace() {
        if (!videoRef.current) return;

        setMessage('Extracting face features...');
        const descriptor = await extractFaceDescriptorFromImage(videoRef.current);

        if (descriptor) {
            updateField('faceDescriptor', Array.from(descriptor));
            setMessage('Face descriptor saved successfully!');
            stopWebcam();
        } else {
            setMessage('No face detected. Please try again.');
        }
    }

    async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;

        setMessage('Processing uploaded image...');
        const img = new Image();
        img.src = URL.createObjectURL(file);

        img.onload = async () => {
            const descriptor = await extractFaceDescriptorFromImage(img);
            if (descriptor) {
                updateField('faceDescriptor', Array.from(descriptor));
                setMessage('Face descriptor saved successfully from image!');
            } else {
                setMessage('No face detected in the uploaded image. Try another one.');
            }
        };
    }

    // Cleanup webcam on unmount
    useEffect(() => {
        return () => stopWebcam();
    }, [stream]);

    function updateField(field: keyof PersonProfile, value: any) {
        setForm((prev: any) => ({ ...prev, [field]: value }));
    }

    function updateArrayField(field: keyof PersonProfile, value: string) {
        const items = value.split('\n').filter(s => s.trim());
        setForm((prev: any) => ({ ...prev, [field]: items }));
    }

    function getArrayValue(field: keyof PersonProfile): string {
        const val = form[field];
        return Array.isArray(val) ? val.join('\n') : '';
    }

    return (
        <div className="p-8 max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-4 mb-8">
                <button onClick={onBack} className="btn-secondary text-sm px-4 py-2">
                    ← Back
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-white">
                        {isEditing ? `Edit: ${form.name}` : 'New Profile'}
                    </h1>
                    <p className="text-sm text-muninn-text-dim">
                        {isEditing ? 'Update personhood data' : 'Create a new person profile'}
                    </p>
                </div>
            </div>

            {/* Form */}
            <div className="space-y-6">
                {/* Basic Info */}
                <div className="glass-card p-6">
                    <h2 className="section-title mb-4 flex items-center gap-2">
                        <span>Basic Information</span>
                    </h2>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm text-muninn-text-dim mb-1.5">Full Name</label>
                            <input
                                id="profile-name"
                                className="input-field"
                                value={form.name || ''}
                                onChange={(e) => updateField('name', e.target.value)}
                                placeholder="e.g. Sarah Mitchell"
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-muninn-text-dim mb-1.5">Relationship</label>
                            <input
                                id="profile-relationship"
                                className="input-field"
                                value={form.relationship || ''}
                                onChange={(e) => updateField('relationship', e.target.value)}
                                placeholder="e.g. Daughter, Friend, Doctor"
                            />
                        </div>
                    </div>
                    <div className="mt-4">
                        <label className="block text-sm text-muninn-text-dim mb-1.5">Identity Summary</label>
                        <textarea
                            id="profile-summary"
                            className="input-field min-h-[80px] resize-y"
                            value={form.identity_summary || ''}
                            onChange={(e) => updateField('identity_summary', e.target.value)}
                            placeholder="A brief summary of who this person is..."
                        />
                    </div>
                </div>

                {/* Face Reference */}
                <div className="glass-card p-6">
                    <h2 className="section-title mb-4 flex items-center gap-2">
                        <span>Face Reference</span>
                    </h2>
                    <p className="text-sm text-muninn-text-muted mb-4">
                        Capture a photo of the person to link their face to this profile. The system will extract a numerical signature (embedding) from their face for the recognition loop.
                    </p>

                    {form.faceDescriptor && !capturingFace && (
                        <div className="mb-4 p-3 bg-muninn-success/10 border border-muninn-success/30 rounded-xl text-muninn-success text-sm flex items-center gap-2">
                            <span>Face descriptor is saved and ready for recognition.</span>
                        </div>
                    )}

                    {capturingFace ? (
                        <div className="space-y-4">
                            <div className="relative bg-black rounded-xl overflow-hidden max-w-md mx-auto aspect-video">
                                <video
                                    ref={videoRef}
                                    autoPlay
                                    playsInline
                                    muted
                                    className="w-full h-full object-cover"
                                />
                            </div>
                            <div className="flex justify-center gap-3 mt-4">
                                <button onClick={captureFace} className="btn-primary">
                                    Capture Embedded Features
                                </button>
                                <button onClick={stopWebcam} className="btn-secondary">
                                    Cancel
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-4 max-w-sm">
                            <button onClick={startWebcam} className="btn-secondary w-full text-center">
                                {form.faceDescriptor ? 'Recapture Face via Webcam' : 'Add Face via Webcam'}
                            </button>

                            <div className="relative">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-muninn-border"></div>
                                </div>
                                <div className="relative flex justify-center text-sm">
                                    <span className="px-2 bg-muninn-bg text-muninn-text-muted">Or</span>
                                </div>
                            </div>

                            <input
                                type="file"
                                accept="image/*"
                                ref={fileInputRef}
                                className="hidden"
                                onChange={handleFileUpload}
                            />
                            <button onClick={() => fileInputRef.current?.click()} className="btn-secondary w-full text-center">
                                Upload Photo
                            </button>
                        </div>
                    )}
                </div>

                {/* Personhood Details */}
                <div className="glass-card p-6">
                    <h2 className="section-title mb-4 flex items-center gap-2">
                        <span>Personhood Details</span>
                    </h2>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm text-muninn-text-dim mb-1.5">
                                Hobbies & Interests <span className="text-muninn-text-muted">(one per line)</span>
                            </label>
                            <textarea
                                id="profile-hobbies"
                                className="input-field min-h-[80px] resize-y"
                                value={getArrayValue('hobbies')}
                                onChange={(e) => updateArrayField('hobbies', e.target.value)}
                                placeholder="gardening&#10;reading&#10;cooking"
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-muninn-text-dim mb-1.5">
                                Pride Points <span className="text-muninn-text-muted">(one per line)</span>
                            </label>
                            <textarea
                                id="profile-pride"
                                className="input-field min-h-[80px] resize-y"
                                value={getArrayValue('pride_points')}
                                onChange={(e) => updateArrayField('pride_points', e.target.value)}
                                placeholder="Recent achievements or things they're proud of"
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-muninn-text-dim mb-1.5">
                                Emotional Anchors <span className="text-muninn-text-muted">(one per line)</span>
                            </label>
                            <textarea
                                id="profile-anchors"
                                className="input-field min-h-[80px] resize-y"
                                value={getArrayValue('emotional_anchors')}
                                onChange={(e) => updateArrayField('emotional_anchors', e.target.value)}
                                placeholder="Shared memories or comforting connections"
                            />
                        </div>
                    </div>
                </div>

                {/* Communication */}
                <div className="glass-card p-6">
                    <h2 className="section-title mb-4 flex items-center gap-2">
                        <span>Communication</span>
                    </h2>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm text-muninn-text-dim mb-1.5">
                                Conversation Starters <span className="text-muninn-text-muted">(one per line)</span>
                            </label>
                            <textarea
                                id="profile-starters"
                                className="input-field min-h-[80px] resize-y"
                                value={getArrayValue('conversation_starters')}
                                onChange={(e) => updateArrayField('conversation_starters', e.target.value)}
                                placeholder="How are the roses doing?&#10;Have you read any good books?"
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-muninn-text-dim mb-1.5">
                                Communication Tips <span className="text-muninn-text-muted">(one per line)</span>
                            </label>
                            <textarea
                                id="profile-tips"
                                className="input-field min-h-[80px] resize-y"
                                value={getArrayValue('communication_tips')}
                                onChange={(e) => updateArrayField('communication_tips', e.target.value)}
                                placeholder="Tips for engaging with this person"
                            />
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-4">
                    <button
                        id="save-profile"
                        onClick={handleSave}
                        disabled={saving || !form.name}
                        className="btn-primary"
                    >
                        {saving ? 'Saving...' : isEditing ? 'Update Profile' : 'Create Profile'}
                    </button>
                    <button onClick={onBack} className="btn-secondary">
                        Cancel
                    </button>
                    {message && (
                        <span className="text-sm text-muninn-success animate-fade-in">{message}</span>
                    )}
                </div>
            </div>
        </div>
    );
}
