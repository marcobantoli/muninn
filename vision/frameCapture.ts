// ─── MUNINN Frame Capture Service ───
// Extracts and optimizes frames from video for profile images

let lastCapturedFrames: string[] = [];
const MAX_FRAMES_BUFFER = 10;

export function captureFrameFromVideo(videoElement: HTMLVideoElement): string {
  const canvas = document.createElement("canvas");
  canvas.width = videoElement.videoWidth;
  canvas.height = videoElement.videoHeight;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    console.error("[MUNINN] Failed to get canvas context");
    return "";
  }

  ctx.drawImage(videoElement, 0, 0);
  const frame = canvas.toDataURL("image/jpeg", 0.85);

  // Keep a buffer of recent frames to pick the best one
  lastCapturedFrames.push(frame);
  if (lastCapturedFrames.length > MAX_FRAMES_BUFFER) {
    lastCapturedFrames.shift();
  }

  return frame;
}

export function captureMultipleFrames(
  videoElement: HTMLVideoElement,
  count: number = 5,
): string[] {
  const frames: string[] = [];
  for (let i = 0; i < count; i++) {
    const frame = captureFrameFromVideo(videoElement);
    if (frame) frames.push(frame);
  }
  return frames;
}

export async function selectBestFrame(frames: string[]): Promise<string> {
  // For now, return the last frame (best capture)
  // In the future, we could use face detection to pick the clearest face
  if (frames.length === 0) {
    console.warn("[MUNINN] No frames available to select best from");
    return "";
  }

  return frames[frames.length - 1];
}

export function getLastCapturedFrame(): string {
  if (lastCapturedFrames.length === 0) return "";
  return lastCapturedFrames[lastCapturedFrames.length - 1];
}

export function clearFrameBuffer(): void {
  lastCapturedFrames = [];
}

export function frameToBlob(dataUrl: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    fetch(dataUrl)
      .then((res) => res.blob())
      .then(resolve)
      .catch(reject);
  });
}
