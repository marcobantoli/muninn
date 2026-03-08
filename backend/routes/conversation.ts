import { Router, Request, Response } from "express";
import { createProfile } from "../services/profileService";
import { extractFaceDescriptorFromImage } from "../../vision/faceDetection";
import { PersonProfile } from "../../shared/types";
import {
  transcribeAudioWithGemini,
  analyzeConversationWithGemini,
  analyzeConversationStreamingWithGemini,
  createGeminiLiveSession,
  StreamingProfileUpdate,
} from "../services/geminiService";

export const conversationRoutes = Router();

interface AnalyzeAudioRequest {
  audioBase64: string;
  mimeType: string;
}

interface CreateProfileFromConversationRequest {
  name: string;
  relationship: string;
  faceImage: string; // base64 data URL
  geminiAnalysis: {
    summary: string;
    identity_summary: string;
    hobbies: string[];
    pride_points: string[];
    emotional_anchors: string[];
    conversation_starters: string[];
    communication_tips: string[];
  };
}

// POST /api/conversation/analyze-audio
conversationRoutes.post(
  "/analyze-audio",
  async (req: Request, res: Response) => {
    try {
      const { audioBase64, mimeType } = req.body as AnalyzeAudioRequest;

      if (!audioBase64) {
        return res
          .status(400)
          .json({ error: "Missing required field: audioBase64" });
      }

      console.log("[MUNINN] Analyzing audio with Gemini...");

      // Transcribe audio
      const transcript = await transcribeAudioWithGemini(audioBase64);

      // Analyze transcript to extract profile information
      const analysis = await analyzeConversationWithGemini(transcript);

      res.json({
        transcript,
        analysis,
      });
    } catch (err) {
      console.error("[MUNINN] Failed to analyze audio:", err);
      res.status(500).json({
        error: "Failed to analyze audio",
        details: err instanceof Error ? err.message : "Unknown error",
      });
    }
  },
);

// POST /api/conversation/create-profile
conversationRoutes.post(
  "/create-profile",
  async (req: Request, res: Response) => {
    try {
      const { name, relationship, faceImage, geminiAnalysis } =
        req.body as CreateProfileFromConversationRequest;

      if (!name || !relationship || !faceImage) {
        return res.status(400).json({
          error: "Missing required fields: name, relationship, faceImage",
        });
      }

      console.log(
        `[MUNINN] Creating new profile from conversation: ${name} (${relationship})`,
      );

      // TODO: Extract face descriptor from the image
      // For now, we'll create the profile without a face descriptor
      // In production, you'd use face-api to extract the descriptor from faceImage

      const profileData: Partial<PersonProfile> = {
        name,
        relationship,
        face_reference_image: faceImage,
        identity_summary: geminiAnalysis.summary,
        hobbies: geminiAnalysis.hobbies,
        pride_points: geminiAnalysis.pride_points,
        emotional_anchors: geminiAnalysis.emotional_anchors,
        conversation_starters: geminiAnalysis.conversation_starters,
        communication_tips: geminiAnalysis.communication_tips,
        faceDescriptor: [], // Will be updated if we can extract from image
      };

      const newProfile = await createProfile(profileData);

      console.log(`[MUNINN] New profile created: ${newProfile.id}`);

      res.status(201).json({
        success: true,
        profile: newProfile,
        message: `Profile for ${name} created successfully from conversation`,
      });
    } catch (err) {
      console.error(
        "[MUNINN] Failed to create profile from conversation:",
        err,
      );
      res
        .status(500)
        .json({ error: "Failed to create profile from conversation" });
    }
  },
);

// POST /api/conversation/stream-analysis
// Real-time profile analysis with Gemini 2.5 Flash Live
conversationRoutes.post(
  "/stream-analysis",
  async (req: Request, res: Response) => {
    try {
      const { transcript, name, relationship } = req.body;

      if (!transcript) {
        return res
          .status(400)
          .json({ error: "Missing required field: transcript" });
      }

      console.log("[MUNINN] Starting streaming analysis...");

      // Set up SSE headers for streaming
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("Access-Control-Allow-Origin", "*");

      // Send initial connection message
      res.write("data: " + JSON.stringify({ status: "connected" }) + "\n\n");

      // Stream updates from Gemini
      try {
        const generator = analyzeConversationStreamingWithGemini(
          transcript,
          (update: StreamingProfileUpdate) => {
            // Send each update as Server-Sent Event
            res.write("data: " + JSON.stringify(update) + "\n\n");
          },
        );

        for await (const update of generator) {
          // Updates are already sent via callback
        }

        console.log("[MUNINN] Streaming analysis complete");
        res.write(
          "data: " +
            JSON.stringify({
              status: "complete",
              message: "Analysis finished",
            }) +
            "\n\n",
        );
        res.end();
      } catch (streamErr) {
        console.error("[MUNINN] Stream error:", streamErr);
        res.write(
          "data: " +
            JSON.stringify({ error: "Stream processing failed" }) +
            "\n\n",
        );
        res.end();
      }
    } catch (err) {
      console.error("[MUNINN] Streaming analysis failed:", err);
      res.setHeader("Content-Type", "application/json");
      res.status(500).json({ error: "Failed to start streaming analysis" });
    }
  },
);

// POST /api/conversation/live-session
// Create a new live conversation session with Gemini 2.5 Flash
conversationRoutes.post(
  "/live-session",
  async (req: Request, res: Response) => {
    try {
      console.log("[MUNINN] Creating live session...");
      const sessionId = await createGeminiLiveSession();

      res.status(201).json({
        success: true,
        sessionId,
        message: "Live conversation session created",
      });
    } catch (err) {
      console.error("[MUNINN] Failed to create live session:", err);
      res.status(500).json({ error: "Failed to create live session" });
    }
  },
);

// POST /api/conversation/analyze-text
// Simple synchronous analysis of conversation text
conversationRoutes.post(
  "/analyze-text",
  async (req: Request, res: Response) => {
    try {
      const { transcript, relationship } = req.body;

      if (!transcript) {
        return res
          .status(400)
          .json({ error: "Missing required field: transcript" });
      }

      console.log(
        "[MUNINN] Analyzing text with Gemini:",
        transcript.substring(0, 50),
      );

      const analysis = await analyzeConversationWithGemini(
        transcript,
        relationship,
      );

      res.json({
        success: true,
        transcript,
        analysis,
      });
    } catch (err) {
      console.error("[MUNINN] Text analysis failed:", err);
      res.status(500).json({
        error: "Failed to analyze text",
        details: err instanceof Error ? err.message : "Unknown error",
      });
    }
  },
);
