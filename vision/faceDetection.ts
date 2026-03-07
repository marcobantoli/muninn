// ─── MUNINN Real Facial Recognition Pipeline ───
import * as faceapi from 'face-api.js';
import { FaceBoundingBox } from '../shared/types';

let isInitialized = false;

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
const EXTRACTION_INTERVAL = 1000;
let cachedFaces: FaceWithDescriptor[] = [];

export interface FaceWithDescriptor extends FaceBoundingBox {
    descriptor: Float32Array;
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
                for (const cached of cachedFaces as any[]) {
                    const cx1 = cached.x + cached.width / 2;
                    const cy1 = cached.y + cached.height / 2;
                    const cx2 = box.x + box.width / 2;
                    const cy2 = box.y + box.height / 2;
                    const dist = Math.sqrt(Math.pow(cx1 - cx2, 2) + Math.pow(cy1 - cy2, 2));

                    if (dist < 150) {
                        faceId = cached.id;
                        break;
                    }
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

                for (const cached of cachedFaces as any[]) {
                    const cx1 = cached.x + cached.width / 2;
                    const cy1 = cached.y + cached.height / 2;
                    const cx2 = box.x + box.width / 2;
                    const cy2 = box.y + box.height / 2;
                    const dist = Math.sqrt(Math.pow(cx1 - cx2, 2) + Math.pow(cy1 - cy2, 2));

                    if (dist < 150) { // If centers are close, it's the same face
                        faceId = cached.id;
                        matchedDescriptor = cached.descriptor;
                        break;
                    }
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
        return null;
    }

    const labeledFaces = labeledDescriptors.map(
        l => new faceapi.LabeledFaceDescriptors(l.id, [l.descriptor])
    );

    console.log(`[MUNINN] Built FaceMatcher with ${labeledFaces.length} profiles.`);

    // 0.7 is a slightly relaxed distance threshold (default is 0.6)
    return new faceapi.FaceMatcher(labeledFaces, 0.7);
}

export function resetFaceDetection(): void {
    cachedFaces = [];
}
