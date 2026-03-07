// ─── MUNINN Webcam Access Helper ───
// Preflights camera access before starting WebGazer so failures surface clearly.

const PREVIEW_TIMEOUT_MS = 4000;

export async function preflightWebcamAccess(): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Webcam access is not supported in this environment.');
    }

    const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
            facingMode: 'user',
            width: { ideal: 640 },
            height: { ideal: 480 }
        }
    });

    try {
        const [videoTrack] = stream.getVideoTracks();
        if (!videoTrack) {
            throw new Error('No webcam video track was returned.');
        }

        if (videoTrack.readyState !== 'live') {
            throw new Error('The webcam video track is not live.');
        }

        await waitForVideoFrame(stream);
    } finally {
        stream.getTracks().forEach((track) => track.stop());
    }
}

async function waitForVideoFrame(stream: MediaStream): Promise<void> {
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;

    try {
        await Promise.race([
            new Promise<void>((resolve, reject) => {
                const timeout = window.setTimeout(() => {
                    cleanup();
                    reject(new Error('Timed out waiting for the webcam stream to become ready.'));
                }, PREVIEW_TIMEOUT_MS);

                const cleanup = () => {
                    window.clearTimeout(timeout);
                    video.onloadedmetadata = null;
                    video.onerror = null;
                };

                video.onloadedmetadata = async () => {
                    try {
                        await video.play();
                        cleanup();
                        resolve();
                    } catch (error) {
                        cleanup();
                        reject(error instanceof Error ? error : new Error('Failed to start webcam preview.'));
                    }
                };

                video.onerror = () => {
                    cleanup();
                    reject(new Error('The webcam stream could not be attached to a video element.'));
                };
            })
        ]);
    } finally {
        video.pause();
        video.srcObject = null;
    }
}
