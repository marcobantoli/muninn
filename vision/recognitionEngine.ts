// ─── MUNINN Recognition Engine ───
// Maps gaze to faces and triggers recognition events after dwell threshold

import { FaceBoundingBox, GazePoint, RecognitionEvent, PersonhoodNote } from '../shared/types';

import { getFaceMatcher, FaceWithDescriptor } from './faceDetection';
import { PersonProfile } from '../shared/types';
import * as faceapi from 'face-api.js';

const DWELL_THRESHOLD_MS = 3000; // 3 seconds
const API_BASE = 'http://localhost:3001/api';

interface DwellTracker {
    faceId: string;
    profileId?: string;
    startTime: number;
    lastSeen: number;
    triggered: boolean;
}

let dwellTrackers: Map<string, DwellTracker> = new Map();
let recognitionCallbacks: Array<(note: PersonhoodNote) => void> = [];

// Instead of manual string mapping, we use FaceMatcher
let faceMatcher: faceapi.FaceMatcher | null = null;
let lastHeartRate = 72;
let hcpMode = false;

// Simulated heart rate that varies over time
export function simulateHeartRate(): number {
    // Simulate between 60-120 BPM with some noise
    const base = 72;
    const variation = Math.sin(Date.now() / 10000) * 20;
    const noise = (Math.random() - 0.5) * 15;
    lastHeartRate = Math.round(Math.max(60, Math.min(120, base + variation + noise)));
    return lastHeartRate;
}

// Build the FaceMatcher from available profiles
export function updateFaceMatcher(profiles: PersonProfile[]): void {
    const descriptors = profiles
        .filter(p => p.faceDescriptor)
        .map(p => ({
            id: p.id,
            descriptor: new Float32Array(p.faceDescriptor!)
        }));

    faceMatcher = getFaceMatcher(descriptors);
}

// Find a matching profile for a face Descriptor
export function getLinkedProfileMatching(descriptor?: Float32Array): string | undefined {
    console.log(`[MUNINN] Inside getLinkedProfileMatching. Matcher present: ${!!faceMatcher}, Descriptor present: ${!!descriptor}`);
    if (!faceMatcher || !descriptor) return undefined;

    // Fast extractions lacking spatial proximity to a cache might output an empty zeroed array. Skip matching.
    let sum = 0;
    for (let i = 0; i < descriptor.length; i++) sum += Math.abs(descriptor[i]);

    console.log(`[MUNINN] Descriptor sum: ${sum}`);
    if (sum === 0) return undefined;

    const match = faceMatcher.findBestMatch(descriptor);
    console.log(`[MUNINN] Face match attempt: ${match.label} (Distance: ${match.distance.toFixed(3)})`);
    return match.label !== 'unknown' ? match.label : undefined;
}

export function getHeartRate(): number {
    return lastHeartRate;
}

export function setHcpMode(enabled: boolean): void {
    hcpMode = enabled;
}

export function isHcpMode(): boolean {
    return hcpMode;
}

// Check gaze against detected faces
export function processGazeFaceIntersection(
    gaze: GazePoint | null,
    faces: import('./faceDetection').FaceWithDescriptor[]
): DwellTracker | null {
    if (!gaze) return null;

    const now = Date.now();
    let activeDwell: DwellTracker | null = null;

    // Check which face (if any) the gaze intersects
    for (const f of faces) {
        const face: any = f;
        const isInside = isPointInBox(gaze.x, gaze.y, face);

        if (isInside) {
            let tracker = dwellTrackers.get(face.id);

            if (!tracker) {
                // Determine who the face is using FaceMatcher embedding comparison
                const matchedProfileId = getLinkedProfileMatching(face.descriptor);

                tracker = {
                    faceId: face.id,
                    profileId: matchedProfileId,
                    startTime: now,
                    lastSeen: now,
                    triggered: false
                };
                dwellTrackers.set(face.id, tracker);
            } else {
                tracker.lastSeen = now;

                // Retroactively evaluate identity if a new full extraction gives a valid descriptor
                if (!tracker.profileId) {
                    tracker.profileId = getLinkedProfileMatching(face.descriptor);
                }
            }

            const dwellTime = now - tracker.startTime;

            if (dwellTime >= DWELL_THRESHOLD_MS && !tracker.triggered && tracker.profileId) {
                tracker.triggered = true;
                triggerRecognitionEvent(tracker, dwellTime);
            }

            activeDwell = tracker;
        }
    }

    // Clean up stale trackers (gaze left the face)
    for (const [faceId, tracker] of dwellTrackers) {
        if (now - tracker.lastSeen > 500) {
            dwellTrackers.delete(faceId);
        }
    }

    return activeDwell;
}

function isPointInBox(x: number, y: number, box: FaceBoundingBox): boolean {
    // Add some padding for better UX
    const padding = 20;
    return (
        x >= box.x - padding &&
        x <= box.x + box.width + padding &&
        y >= box.y - padding &&
        y <= box.y + box.height + padding
    );
}

async function triggerRecognitionEvent(tracker: DwellTracker, dwellTime: number): Promise<void> {
    if (!tracker.profileId) return;

    const heartRate = simulateHeartRate();

    const event: RecognitionEvent = {
        faceId: tracker.faceId,
        profileId: tracker.profileId,
        dwellTime,
        heartRate,
        timestamp: Date.now(),
        isStressed: heartRate > 100
    };

    console.log('[MUNINN] Recognition event:', event);

    try {
        const response = await fetch(`${API_BASE}/recognition-event`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                profileId: event.profileId,
                heartRate: event.heartRate,
                hcpMode
            })
        });

        if (response.ok) {
            const note: PersonhoodNote = await response.json();
            recognitionCallbacks.forEach(fn => fn(note));
        }
    } catch (err) {
        console.error('[MUNINN] Recognition event error:', err);
    }
}

export function onRecognition(callback: (note: PersonhoodNote) => void): () => void {
    recognitionCallbacks.push(callback);
    return () => {
        recognitionCallbacks = recognitionCallbacks.filter(fn => fn !== callback);
    };
}

export function resetRecognitionEngine(): void {
    dwellTrackers.clear();
    recognitionCallbacks = [];
}

export function getDwellProgress(faceId: string): number {
    const tracker = dwellTrackers.get(faceId);
    if (!tracker) return 0;
    const elapsed = Date.now() - tracker.startTime;
    return Math.min(1, elapsed / DWELL_THRESHOLD_MS);
}
