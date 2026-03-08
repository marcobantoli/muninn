// ─── MUNINN Recognition Engine ───
// Triggers recognition events when the cursor hovers over a detected face

import { CursorPoint, FaceBoundingBox, RecognitionEvent, PersonhoodNote } from '../shared/types';

import { getBestFaceMatch, getFaceMatcher } from './faceDetection';
import { PersonProfile } from '../shared/types';
import * as faceapi from 'face-api.js';

const HOVER_THRESHOLD_MS = 1000; // 1 second of hover
const API_BASE = 'http://localhost:3001/api';

export interface FaceScreenPosition {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface ActiveHoverState {
    faceId: string;
    profileId?: string;
    progress: number;
    confidence: 'high' | 'low' | 'none';
    distance?: number;
}

interface DwellTracker {
    faceId: string;
    profileId?: string;
    matchConfidence: 'high' | 'low' | 'none';
    matchDistance?: number;
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
let activeHoveredFaceId: string | null = null;

// Instead of manual string mapping, we use FaceMatcher
let faceMatcher: faceapi.FaceMatcher | null = null;

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

    const match = getBestFaceMatch(descriptor);
    console.log(`[MUNINN] Face match attempt: ${match.profileId ?? 'unknown'} (Distance: ${match.distance?.toFixed(3) ?? 'n/a'}, Confidence: ${match.confidence})`);
    return match.confidence === 'high' ? match.profileId : undefined;
}

export function processCursorFaceIntersection(
    cursor: CursorPoint | null,
    faces: import('./faceDetection').FaceWithDescriptor[],
    captureSize?: { width: number; height: number }
): DwellTracker | null {
    if (!cursor) {
        activeHoveredFaceId = null;
        cleanupStaleTrackers(Date.now());
        return null;
    }

    const now = Date.now();
    let activeDwell: DwellTracker | null = null;
    const normalizedCursor = normalizePointToCaptureSpace(cursor, captureSize);
    const hoveredFace = findHoveredFace(normalizedCursor.x, normalizedCursor.y, faces);

    activeHoveredFaceId = hoveredFace?.id ?? null;

    if (hoveredFace) {
        const matchResult = getFaceMatchForTracker(hoveredFace.descriptor);
        const trackerKey = getTrackerKey(hoveredFace, matchResult);
        let tracker = dwellTrackers.get(trackerKey);

        if (!tracker) {
            tracker = {
                faceId: hoveredFace.id,
                profileId: matchResult.profileId,
                matchConfidence: matchResult.confidence,
                matchDistance: matchResult.distance,
                startTime: now,
                lastSeen: now,
                triggered: false,
                faceX: hoveredFace.x,
                faceY: hoveredFace.y,
                faceWidth: hoveredFace.width,
                faceHeight: hoveredFace.height
            };
            dwellTrackers.set(trackerKey, tracker);
        } else {
            tracker.faceId = hoveredFace.id;
            tracker.profileId = matchResult.profileId;
            tracker.matchConfidence = matchResult.confidence;
            tracker.matchDistance = matchResult.distance;
            tracker.lastSeen = now;
            tracker.faceX = hoveredFace.x;
            tracker.faceY = hoveredFace.y;
            tracker.faceWidth = hoveredFace.width;
            tracker.faceHeight = hoveredFace.height;
        }

        const hoverTime = now - tracker.startTime;

        if (hoverTime >= HOVER_THRESHOLD_MS && !tracker.triggered && tracker.profileId && tracker.matchConfidence === 'high') {
            tracker.triggered = true;
            triggerRecognitionEvent(tracker, hoverTime);
        }

        activeDwell = tracker;
    }

    cleanupStaleTrackers(now);

    return activeDwell;
}

function normalizePointToCaptureSpace(
    point: CursorPoint,
    captureSize?: { width: number; height: number }
): { x: number; y: number } {
    if (!captureSize || captureSize.width <= 0 || captureSize.height <= 0) {
        return { x: point.x, y: point.y };
    }

    return {
        x: (point.x / screen.width) * captureSize.width,
        y: (point.y / screen.height) * captureSize.height,
    };
}

function findHoveredFace(
    x: number,
    y: number,
    faces: import('./faceDetection').FaceWithDescriptor[]
): import('./faceDetection').FaceWithDescriptor | null {
    const hoveredFaces = faces.filter((face) => isPointInBox(x, y, face));
    if (hoveredFaces.length === 0) {
        return null;
    }

    if (hoveredFaces.length === 1) {
        return hoveredFaces[0];
    }

    return hoveredFaces.reduce((best, current) =>
        distanceToFaceCenter(x, y, current) < distanceToFaceCenter(x, y, best) ? current : best
    );
}

function getFaceMatchForTracker(descriptor?: Float32Array): { profileId?: string; confidence: 'high' | 'low' | 'none'; distance?: number } {
    if (!descriptor) {
        return { confidence: 'none' };
    }

    let sum = 0;
    for (let i = 0; i < descriptor.length; i++) sum += Math.abs(descriptor[i]);
    if (sum === 0) {
        return { confidence: 'none' };
    }

    return getBestFaceMatch(descriptor);
}

function getTrackerKey(
    face: import('./faceDetection').FaceWithDescriptor,
    matchResult: { profileId?: string; confidence: 'high' | 'low' | 'none' }
): string {
    return matchResult.confidence === 'high' && matchResult.profileId ? `profile:${matchResult.profileId}` : `face:${face.id}`;
}

function isPointInBox(x: number, y: number, box: FaceBoundingBox, padding = 20): boolean {
    return (
        x >= box.x - padding &&
        x <= box.x + box.width + padding &&
        y >= box.y - padding &&
        y <= box.y + box.height + padding
    );
}

function distanceToFaceCenter(x: number, y: number, box: FaceBoundingBox): number {
    return Math.hypot(x - (box.x + box.width / 2), y - (box.y + box.height / 2));
}

function cleanupStaleTrackers(now: number): void {
    for (const [key, tracker] of dwellTrackers) {
        if (now - tracker.lastSeen > 300) {
            dwellTrackers.delete(key);
        }
    }
}

async function triggerRecognitionEvent(tracker: DwellTracker, dwellTime: number): Promise<void> {
    if (!tracker.profileId) return;

    const event: RecognitionEvent = {
        faceId: tracker.faceId,
        profileId: tracker.profileId,
        dwellTime,
        timestamp: Date.now(),
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
                profileId: event.profileId
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
    activeHoveredFaceId = null;
}

export function getActiveHoveredFaceId(): string | null {
    return activeHoveredFaceId;
}

export function getActiveHoverState(): ActiveHoverState | null {
    if (!activeHoveredFaceId) {
        return null;
    }

    const tracker = Array.from(dwellTrackers.values()).find((entry) => entry.faceId === activeHoveredFaceId);
    if (!tracker) {
        return null;
    }

    return {
        faceId: tracker.faceId,
        profileId: tracker.profileId,
        progress: getDwellProgress(tracker.faceId),
        confidence: tracker.matchConfidence,
        distance: tracker.matchDistance
    };
}

export function getDwellProgress(faceId: string): number {
    const tracker = Array.from(dwellTrackers.values()).find((entry) => entry.faceId === faceId);
    if (!tracker) return 0;
    const elapsed = Date.now() - tracker.startTime;
    return Math.min(1, elapsed / HOVER_THRESHOLD_MS);
}
