import { Router, Request, Response } from "express";
import { createProfile } from "../services/profileService";
import { extractFaceDescriptorFromImage } from "../../vision/faceDetection";
import { PersonProfile } from "../../shared/types";
import {
  transcribeAudioWithGemini,
  analyzeConversationWithGemini,
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
