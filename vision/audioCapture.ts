// ─── MUNINN Audio Capture Service ───
// Captures audio from the user's microphone during conversation

let mediaRecorder: MediaRecorder | null = null;
let audioChunks: Blob[] = [];
let isRecording = false;
let recordingStartTime = 0;

export async function startAudioCapture(): Promise<void> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];
    recordingStartTime = Date.now();
    isRecording = true;

    mediaRecorder.ondataavailable = (event) => {
      audioChunks.push(event.data);
    };

    mediaRecorder.start();
    console.log("[MUNINN] Audio capture started");
  } catch (err) {
    console.error("[MUNINN] Failed to start audio capture:", err);
    isRecording = false;
  }
}

export async function stopAudioCapture(): Promise<Blob | null> {
  if (!mediaRecorder || !isRecording) {
    console.warn("[MUNINN] No active audio recording to stop");
    return null;
  }

  return new Promise((resolve) => {
    if (mediaRecorder) {
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: "audio/webm" });
        isRecording = false;

        // Stop all tracks
        mediaRecorder!.stream.getTracks().forEach((track) => track.stop());

        console.log(
          `[MUNINN] Audio capture stopped. Duration: ${Date.now() - recordingStartTime}ms, Size: ${audioBlob.size} bytes`,
        );
        resolve(audioBlob);
      };

      mediaRecorder.stop();
    } else {
      resolve(null);
    }
  });
}

export function isAudioRecording(): boolean {
  return isRecording;
}

export async function audioToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
