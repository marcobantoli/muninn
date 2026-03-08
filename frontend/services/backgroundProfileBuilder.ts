import { PersonProfile } from "../../shared/types";

/**
 * Handles real-time profile building as faces are detected and hovered
 * Continuously analyzes audio and updates profile fields in background
 */
export class BackgroundProfileBuilder {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private transcript: string = "";
  private isRecording: boolean = false;
  private currentFaceId: string | null = null;
  private profileCache: Map<string, Partial<PersonProfile>> = new Map();
  private transcriptionBuffer: string[] = [];

  async startRecording(): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm",
      });
      this.audioChunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.start();
      this.isRecording = true;
      console.log("[MUNINN] Background audio recording started");
    } catch (err) {
      console.error("[MUNINN] Failed to start background recording:", err);
    }
  }

  stopRecording(): Blob | null {
    if (!this.mediaRecorder) return null;

    return new Promise((resolve) => {
      this.mediaRecorder!.onstop = () => {
        const audioBlob = new Blob(this.audioChunks, { type: "audio/webm" });
        this.audioChunks = [];
        this.isRecording = false;
        console.log(
          "[MUNINN] Background recording stopped, blob size:",
          audioBlob.size,
        );
        resolve(audioBlob);
      };

      this.mediaRecorder!.stop();
      if (this.mediaRecorder!.stream) {
        this.mediaRecorder!.stream.getTracks().forEach((track) => track.stop());
      }
    });
  }

  addTranscriptionChunk(text: string): void {
    this.transcriptionBuffer.push(text);
    this.transcript = this.transcriptionBuffer.join(" ");
  }

  setCurrentFaceId(faceId: string | null): void {
    this.currentFaceId = faceId;
  }

  getCurrentFaceId(): string | null {
    return this.currentFaceId;
  }

  getTranscript(): string {
    return this.transcript;
  }

  updateProfile(faceId: string, profile: Partial<PersonProfile>): void {
    const existing = this.profileCache.get(faceId) || {};
    this.profileCache.set(faceId, { ...existing, ...profile });
  }

  getProfile(faceId: string): Partial<PersonProfile> | null {
    return this.profileCache.get(faceId) || null;
  }

  clearProfile(faceId: string): void {
    this.profileCache.delete(faceId);
    if (faceId === this.currentFaceId) {
      this.transcript = "";
      this.transcriptionBuffer = [];
    }
  }

  isActive(): boolean {
    return this.isRecording;
  }
}

try {
  // Clean up old resources if they exist
  if ((window as any).__muninProfileBuilder) {
    const builder = (window as any)
      .__muninProfileBuilder as BackgroundProfileBuilder;
    if (builder.isActive()) {
      builder.stopRecording();
    }
  }
} catch (e) {
  // Ignore cleanup errors
}

// Global singleton
(window as any).__muninProfileBuilder = new BackgroundProfileBuilder();

export function getProfileBuilder(): BackgroundProfileBuilder {
  if (!(window as any).__muninProfileBuilder) {
    (window as any).__muninProfileBuilder = new BackgroundProfileBuilder();
  }
  return (window as any).__muninProfileBuilder;
}
