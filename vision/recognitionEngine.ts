// ─── MUNINN Recognition Engine ───
// Triggers recognition events when faces are detected and remain present

import { FaceBoundingBox, RecognitionEvent, PersonhoodNote } from '../shared/types';

import { getFaceMatcher, FaceWithDescriptor } from './faceDetection';
import { PersonProfile } from '../shared/types';
import * as faceapi from 'face-api.js';

const PRESENCE_THRESHOLD_MS = 2000; // 2 seconds of face presence
const API_BASE = 'http://localhost:3001/api';

export interface FaceScreenPosition {
    x: number;
    y: number;
    width: number;
    height: number;
}

interface DwellTracker {
    faceId: string;
    profileId?: string;
    startTime: number;
    lastSeen: number;
    triggered: boolean;
    faceX: number;
    faceY: number;
    faceWidth: number;
    faceHeight: number;
}

let dwellTrackers: Map<string, DwellTracker> = new Map();
let recognitionCallbacks: Array<(note: PersonhoodNote, facePosition: FaceScreenPosition) => void> = [];

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

// Process all detected faces — trigger recognition when a face is present long enough
export function processFacePresence(
    faces: import('./faceDetection').FaceWithDescriptor[]
): DwellTracker | null {
    const now = Date.now();
    let activeDwell: DwellTracker | null = null;
    const seenFaceIds = new Set<string>();

    for (const f of faces) {
        const face: any = f;
        seenFaceIds.add(face.id);

        let tracker = dwellTrackers.get(face.id);

        if (!tracker) {
            // Determine who the face is using FaceMatcher embedding comparison
            const matchedProfileId = getLinkedProfileMatching(face.descriptor);

            tracker = {
                faceId: face.id,
                profileId: matchedProfileId,
                startTime: now,
                lastSeen: now,
                triggered: false,
                faceX: face.x,
                faceY: face.y,
                faceWidth: face.width,
                faceHeight: face.height
            };
            dwellTrackers.set(face.id, tracker);
        } else {
            tracker.lastSeen = now;
            // Keep face position up to date
            tracker.faceX = face.x;
            tracker.faceY = face.y;
            tracker.faceWidth = face.width;
            tracker.faceHeight = face.height;

            // Retroactively evaluate identity if a new full extraction gives a valid descriptor
            if (!tracker.profileId) {
                tracker.profileId = getLinkedProfileMatching(face.descriptor);
            }
        }

        const presenceTime = now - tracker.startTime;

        if (presenceTime >= PRESENCE_THRESHOLD_MS && !tracker.triggered && tracker.profileId) {
            tracker.triggered = true;
            triggerRecognitionEvent(tracker, presenceTime);
        }

        activeDwell = tracker;
    }

    // Clean up trackers for faces that are no longer detected
    for (const [faceId, tracker] of dwellTrackers) {
        if (!seenFaceIds.has(faceId) && now - tracker.lastSeen > 1000) {
            dwellTrackers.delete(faceId);
        }
    }

    return activeDwell;
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

    const facePosition: FaceScreenPosition = {
        x: tracker.faceX,
        y: tracker.faceY,
        width: tracker.faceWidth,
        height: tracker.faceHeight
    };

    console.log('[MUNINN] Recognition event:', event, 'Face position:', facePosition);

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
            recognitionCallbacks.forEach(fn => fn(note, facePosition));
        }
    } catch (err) {
        console.error('[MUNINN] Recognition event error:', err);
    }
}

export function onRecognition(callback: (note: PersonhoodNote, facePosition: FaceScreenPosition) => void): () => void {
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
    return Math.min(1, elapsed / PRESENCE_THRESHOLD_MS);
}
