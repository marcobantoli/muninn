// ─── MUNINN Real Facial Recognition Pipeline ───
import * as faceapi from 'face-api.js';
import { FaceBoundingBox } from '../shared/types';

let isInitialized = false;
const EXTRACTION_INTERVAL = 1000;
const TRACKING_CENTER_DISTANCE_PX = 90;
const TRACKING_IOU_THRESHOLD = 0.2;
const MATCH_DISTANCE_THRESHOLD = 0.5;
const LOW_CONFIDENCE_DISTANCE_THRESHOLD = 0.6;

export async function initFaceDetection(): Promise<void> {
    if (isInitialized) return;

    console.log('[MUNINN] Initializing face-api.js models...');
    try {
        // Load models from the public folder
        const modelPath = '/models';
        await Promise.all([
            faceapi.nets.ssdMobilenetv1.loadFromUri(modelPath),
            faceapi.nets.faceLandmark68Net.loadFromUri(modelPath),
            faceapi.nets.faceRecognitionNet.loadFromUri(modelPath)
        ]);

        isInitialized = true;
        console.log('[MUNINN] face-api.js models loaded successfully.');
    } catch (err) {
        console.error('[MUNINN] Failed to load face-api models:', err);
    }
}

export function isFaceDetectionReady(): boolean {
    return isInitialized;
}

// Global cache to avoid running heavy extraction every single frame (~10fps)
// We only extract descriptors once per second to save CPU
let lastExtractionTime = 0;
let cachedFaces: FaceWithDescriptor[] = [];
let labeledDescriptorCache: Array<{ id: string; descriptor: Float32Array }> = [];

export interface FaceWithDescriptor extends FaceBoundingBox {
    descriptor: Float32Array;
}

export interface FaceMatchResult {
    profileId?: string;
    distance?: number;
    confidence: 'high' | 'low' | 'none';
}

function getBoxCenter(box: Pick<FaceBoundingBox, 'x' | 'y' | 'width' | 'height'>): { x: number; y: number } {
    return {
        x: box.x + box.width / 2,
        y: box.y + box.height / 2
    };
}

function getCenterDistance(
    left: Pick<FaceBoundingBox, 'x' | 'y' | 'width' | 'height'>,
    right: Pick<FaceBoundingBox, 'x' | 'y' | 'width' | 'height'>
): number {
    const leftCenter = getBoxCenter(left);
    const rightCenter = getBoxCenter(right);
    return Math.hypot(leftCenter.x - rightCenter.x, leftCenter.y - rightCenter.y);
}

function getIntersectionOverUnion(
    left: Pick<FaceBoundingBox, 'x' | 'y' | 'width' | 'height'>,
    right: Pick<FaceBoundingBox, 'x' | 'y' | 'width' | 'height'>
): number {
    const x1 = Math.max(left.x, right.x);
    const y1 = Math.max(left.y, right.y);
    const x2 = Math.min(left.x + left.width, right.x + right.width);
    const y2 = Math.min(left.y + left.height, right.y + right.height);

    const intersectionWidth = Math.max(0, x2 - x1);
    const intersectionHeight = Math.max(0, y2 - y1);
    const intersectionArea = intersectionWidth * intersectionHeight;
    if (intersectionArea === 0) {
        return 0;
    }

    const leftArea = left.width * left.height;
    const rightArea = right.width * right.height;
    const unionArea = leftArea + rightArea - intersectionArea;
    return unionArea > 0 ? intersectionArea / unionArea : 0;
}

function findTrackedFaceMatch(box: Pick<FaceBoundingBox, 'x' | 'y' | 'width' | 'height'>): FaceWithDescriptor | undefined {
    return cachedFaces.find((cachedFace) => {
        const centerDistance = getCenterDistance(cachedFace, box);
        const overlap = getIntersectionOverUnion(cachedFace, box);
        return centerDistance <= TRACKING_CENTER_DISTANCE_PX && overlap >= TRACKING_IOU_THRESHOLD;
    });
}

export async function detectFaces(videoElement: HTMLVideoElement | HTMLCanvasElement): Promise<FaceWithDescriptor[]> {
    if (!isInitialized) return [];

    try {
        const now = Date.now();
        const shouldExtract = now - lastExtractionTime > EXTRACTION_INTERVAL;

        if (shouldExtract) {
            // Full extraction: bounding box + landmarks + 128d descriptor
            const detections = await faceapi.detectAllFaces(videoElement)
                .withFaceLandmarks()
                .withFaceDescriptors();

            const newCachedFaces = detections.map((det, i) => {
                const box = det.detection.box;
                let faceId = `face-${now}-${i}`;

                // Inherit ID from previously cached faces to keep dwell tracking stable
                const trackedFace = findTrackedFaceMatch(box);
                if (trackedFace) {
                    faceId = trackedFace.id;
                }

                console.log(`[MUNINN] Full extraction generated descriptor for: ${faceId}, sum: ${det.descriptor ? Array.from(det.descriptor).reduce((a, b) => a + Math.abs(b), 0) : 0}`);

                return {
                    id: faceId,
                    x: box.x,
                    y: box.y,
                    width: box.width,
                    height: box.height,
                    descriptor: det.descriptor
                };
            });

            cachedFaces = newCachedFaces as any[];
            lastExtractionTime = now;
            return cachedFaces;

        } else {
            // Fast extraction: just bounding boxes to keep UI responsive
            const detections = await faceapi.detectAllFaces(videoElement);

            return detections.map((det, i) => {
                // Try to match this fast box to our cached descriptors based on spatial proximity
                const box = det.box;
                let matchedDescriptor: any = new Float32Array(new ArrayBuffer(128 * 4));
                let faceId = `face-fast-${now}-${i}`;

                const trackedFace = findTrackedFaceMatch(box);
                if (trackedFace) {
                    faceId = trackedFace.id;
                    matchedDescriptor = trackedFace.descriptor;
                }

                // Explicitly satisfy TS by casting to any first
                return {
                    id: faceId,
                    x: box.x,
                    y: box.y,
                    width: box.width,
                    height: box.height,
                    descriptor: matchedDescriptor as any
                } as any;
            });
        }
    } catch (err) {
        console.warn('[MUNINN] Error detecting faces:', err);
        return [];
    }
}

// Generate a descriptor for a single static image (used in Profile Editor)
export async function extractFaceDescriptorFromImage(imageElement: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement): Promise<Float32Array | null> {
    if (!isInitialized) await initFaceDetection();

    try {
        const detection = await faceapi.detectSingleFace(imageElement)
            .withFaceLandmarks()
            .withFaceDescriptor();

        return detection ? detection.descriptor : null;
    } catch (err) {
        console.error('[MUNINN] Failed to extract descriptor from image:', err);
        return null;
    }
}

export function getFaceMatcher(labeledDescriptors: { id: string; descriptor: Float32Array }[]): faceapi.FaceMatcher | null {
    if (labeledDescriptors.length === 0) {
        console.log('[MUNINN] No face descriptors available for FaceMatcher');
        labeledDescriptorCache = [];
        return null;
    }

    labeledDescriptorCache = labeledDescriptors;

    const labeledFaces = labeledDescriptors.map(
        l => new faceapi.LabeledFaceDescriptors(l.id, [l.descriptor])
    );

    console.log(`[MUNINN] Built FaceMatcher with ${labeledFaces.length} profiles.`);

    // Use a stricter threshold because each profile currently stores only one enrollment image.
    return new faceapi.FaceMatcher(labeledFaces, MATCH_DISTANCE_THRESHOLD);
}

export function getBestFaceMatch(descriptor?: Float32Array): FaceMatchResult {
    if (!descriptor || labeledDescriptorCache.length === 0) {
        return { confidence: 'none' };
    }

    let bestMatch: { id: string; distance: number } | null = null;

    for (const labeledDescriptor of labeledDescriptorCache) {
        if (labeledDescriptor.descriptor.length !== descriptor.length) {
            continue;
        }

        let squaredDistance = 0;
        for (let index = 0; index < descriptor.length; index++) {
            const delta = descriptor[index] - labeledDescriptor.descriptor[index];
            squaredDistance += delta * delta;
        }

        const distance = Math.sqrt(squaredDistance);
        if (!bestMatch || distance < bestMatch.distance) {
            bestMatch = { id: labeledDescriptor.id, distance };
        }
    }

    if (!bestMatch) {
        return { confidence: 'none' };
    }

    if (bestMatch.distance <= MATCH_DISTANCE_THRESHOLD) {
        return {
            profileId: bestMatch.id,
            distance: bestMatch.distance,
            confidence: 'high'
        };
    }

    if (bestMatch.distance <= LOW_CONFIDENCE_DISTANCE_THRESHOLD) {
        return {
            profileId: bestMatch.id,
            distance: bestMatch.distance,
            confidence: 'low'
        };
    }

    return {
        distance: bestMatch.distance,
        confidence: 'none'
    };
}

export function resetFaceDetection(): void {
    cachedFaces = [];
    lastExtractionTime = 0;
}
