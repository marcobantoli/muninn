// ─── MUNINN Conversation Profile Manager ───
// Handles the flow of recording a conversation with an unknown face and creating a profile

import { ConversationRecording } from "../../shared/types";
import { audioToBase64 } from "../../vision/audioCapture";

const API_BASE = "http://localhost:3001/api";

export interface CreateProfilePayload {
  name: string;
  relationship: string;
  faceImage: string;
  geminiAnalysis: any;
}

export async function processConversationRecording(
  recording: ConversationRecording,
  onProgress?: (status: string) => void,
): Promise<void> {
  try {
    onProgress?.("Processing conversation recording...");
    console.log("[MUNINN] Processing recording:", recording);

    // 1. Check if we have audio and frame
    if (!recording.audioBlob) {
      console.warn("[MUNINN] No audio blob in recording");
      onProgress?.("Error: No audio was captured");
      return;
    }

    if (!recording.bestFrame) {
      console.warn("[MUNINN] No frame captured");
      onProgress?.("Error: No video frame captured");
      return;
    }

    onProgress?.("Transcribing audio...");
    let transcript = "";
    let analysis = null;

    try {
      // Convert audio to base64
      const audioBase64 = await audioToBase64(recording.audioBlob);

      // Try to send to backend for transcription and analysis
      onProgress?.("Analyzing conversation with Gemini...");
      const analysisResponse = await fetch(
        `${API_BASE}/conversation/analyze-audio`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            audioBase64,
            mimeType: "audio/webm",
          }),
        },
      );

      if (analysisResponse.ok) {
        const result = await analysisResponse.json();
        transcript = result.transcript || "";
        analysis = result.analysis;
        console.log("[MUNINN] Transcription:", transcript);
        console.log("[MUNINN] Analysis:", analysis);
      } else {
        console.warn("[MUNINN] Audio analysis failed, using fallback");
        transcript = "Conversation recording captured";
        analysis = createFallbackAnalysis();
      }
    } catch (audioErr) {
      console.error("[MUNINN] Audio analysis error:", audioErr);
      onProgress?.("Warning: Could not analyze audio, using defaults");
      transcript = "Conversation recording captured";
      analysis = createFallbackAnalysis();
    }

    // 2. Prepare profile creation payload
    onProgress?.("Creating profile...");
    const faceImage = recording.bestFrame || "";

    const profileName = analysis?.summary?.split(",")[0] || "New Person";
    const profilePayload: CreateProfilePayload = {
      name: profileName,
      relationship: "Friend", // Default to Friend, user can edit
      faceImage,
      geminiAnalysis: analysis || createFallbackAnalysis(),
    };

    console.log("[MUNINN] Creating profile with data:", profilePayload);

    // 3. Send to backend to create profile
    const createResponse = await fetch(
      `${API_BASE}/conversation/create-profile`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profilePayload),
      },
    );

    if (createResponse.ok) {
      const result = await createResponse.json();
      onProgress?.(`✅ Profile created: ${result.profile.name}`);
      console.log("[MUNINN] Profile created successfully:", result);
    } else {
      const errorData = await createResponse.json();
      console.error("[MUNINN] Failed to create profile:", errorData);
      onProgress?.(`❌ Failed to create profile: ${errorData.error}`);
      throw new Error(errorData.error || "Failed to create profile");
    }
  } catch (err) {
    console.error("[MUNINN] Error processing conversation:", err);
    onProgress?.(
      `Error: ${err instanceof Error ? err.message : "Unknown error"}`,
    );
  }
}

function createFallbackAnalysis() {
  return {
    summary: "New person met during conversation",
    identity_summary: "A person you met and want to remember",
    hobbies: ["Conversation"],
    pride_points: [],
    emotional_anchors: [],
    conversation_starters: ["Tell me about yourself"],
    communication_tips: ["Listen actively", "Show genuine interest in them"],
  };
}
