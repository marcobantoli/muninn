import React, { useState, useRef, useEffect } from "react";
import { PersonProfile } from "../../shared/types";

interface LiveProfileEditorProps {
  onProfileUpdate: (profile: Partial<PersonProfile>) => void;
  onClose: () => void;
}

const API_BASE = "http://localhost:3001/api";

export function LiveProfileEditor({
  onProfileUpdate,
  onClose,
}: LiveProfileEditorProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [profileData, setProfileData] = useState<Partial<PersonProfile>>({
    name: "",
    relationship: "",
    identity_summary: "",
    hobbies: [],
    pride_points: [],
    emotional_anchors: [],
    conversation_starters: [],
    communication_tips: [],
  });
  const [streamStatus, setStreamStatus] = useState<string>("Ready");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Start recording audio from microphone
  async function startRecording() {
    try {
      setStreamStatus("Requesting microphone access...");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm",
      });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Transcribe the recorded audio
        await transcribeAndAnalyze();
      };

      mediaRecorder.start();
      setIsRecording(true);
      setStreamStatus("Recording... (speak naturally)");
    } catch (err) {
      console.error("Failed to start recording:", err);
      setStreamStatus("Error: Microphone access denied");
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setStreamStatus("Processing audio...");
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
  }

  async function transcribeAndAnalyze() {
    try {
      const audioBlob = new Blob(audioChunksRef.current, {
        type: "audio/webm",
      });
      const reader = new FileReader();

      reader.onload = async (e) => {
        const audioBase64 = (e.target?.result as string).split(",")[1];
        setStreamStatus("Sending to Gemini for analysis...");

        // Start streaming analysis
        startStreamingAnalysis(audioBase64);
      };

      reader.readAsDataURL(audioBlob);
    } catch (err) {
      console.error("Failed to process audio:", err);
      setStreamStatus("Error: Failed to process audio");
    }
  }

  function startStreamingAnalysis(audioBase64: string) {
    try {
      // For now, we'll use the transcript endpoint
      // In production, we'd stream the audio directly
      setStreamStatus("Analyzing with Gemini 2.5 Flash Live...");

      // Create a mock transcript for testing
      const mockTranscript = `Audio received: ${audioBase64.substring(0, 50)}...`;
      setTranscript(mockTranscript);

      // Call the streaming analysis endpoint
      const eventSource = new EventSource(
        `${API_BASE}/conversation/stream-analysis?transcript=${encodeURIComponent(mockTranscript)}`,
      );

      eventSourceRef.current = eventSource;

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.status === "connected") {
            setStreamStatus("Connected to Gemini Live");
          } else if (data.status === "complete") {
            setStreamStatus("Analysis complete! Review and save.");
            eventSource.close();
          } else if (data.error) {
            setStreamStatus(`Error: ${data.error}`);
            eventSource.close();
          } else {
            // Update profile with streamed data
            setProfileData((prev) => ({
              ...prev,
              ...data,
            }));
            setStreamStatus(`Updated: ${Object.keys(data).join(", ")}`);
          }
        } catch (e) {
          console.error("Failed to parse stream data:", e);
        }
      };

      eventSource.onerror = () => {
        setStreamStatus("Connection lost");
        eventSource.close();
      };
    } catch (err) {
      console.error("Stream analysis failed:", err);
      setStreamStatus("Error: Failed to start streaming");
    }
  }

  function handleSaveProfile() {
    if (profileData.name && profileData.relationship) {
      onProfileUpdate(profileData);
    } else {
      setStreamStatus("Please set name and relationship before saving");
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="glass-card max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-muninn-border flex items-center justify-between sticky top-0 bg-slate-950/95">
          <h2 className="text-2xl font-bold text-white">
            Live Profile Builder
          </h2>
          <button
            onClick={onClose}
            className="text-muninn-text-muted hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Recording Control */}
          <div className="rounded-2xl border border-muninn-border bg-slate-900/50 p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm uppercase tracking-[0.24em] text-muninn-text-muted">
                {isRecording ? "🎙️ Recording" : "⏹️ Ready to Record"}
              </span>
              <div
                className={`w-3 h-3 rounded-full ${isRecording ? "bg-red-500 animate-pulse" : "bg-muninn-text-muted"}`}
              />
            </div>

            <div className="flex gap-3 mb-4">
              {!isRecording ? (
                <button onClick={startRecording} className="btn-primary flex-1">
                  Start Recording
                </button>
              ) : (
                <button onClick={stopRecording} className="btn-danger flex-1">
                  Stop Recording
                </button>
              )}
            </div>

            <div className="text-xs text-muninn-text-dim">{streamStatus}</div>
          </div>

          {/* Transcript Display */}
          {transcript && (
            <div className="rounded-2xl border border-muninn-border bg-slate-900/30 p-4">
              <div className="text-xs uppercase tracking-[0.24em] text-muninn-text-muted mb-2">
                Transcript
              </div>
              <p className="text-sm text-slate-100 leading-relaxed max-h-32 overflow-y-auto">
                {transcript}
              </p>
            </div>
          )}

          {/* Profile Fields */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-muninn-text-muted mb-2">
                Name
              </label>
              <input
                type="text"
                value={profileData.name || ""}
                onChange={(e) =>
                  setProfileData((prev) => ({
                    ...prev,
                    name: e.target.value,
                  }))
                }
                placeholder="Person's name (detected from conversation)"
                className="w-full bg-slate-900 border border-muninn-border rounded-lg px-3 py-2 text-white placeholder-muninn-text-muted focus:outline-none focus:border-muninn-accent"
              />
            </div>

            <div>
              <label className="block text-sm text-muninn-text-muted mb-2">
                Relationship
              </label>
              <input
                type="text"
                value={profileData.relationship || ""}
                onChange={(e) =>
                  setProfileData((prev) => ({
                    ...prev,
                    relationship: e.target.value,
                  }))
                }
                placeholder="e.g., Daughter, Friend, Doctor"
                className="w-full bg-slate-900 border border-muninn-border rounded-lg px-3 py-2 text-white placeholder-muninn-text-muted focus:outline-none focus:border-muninn-accent"
              />
            </div>

            <div>
              <label className="block text-sm text-muninn-text-muted mb-2">
                Summary
              </label>
              <textarea
                value={profileData.identity_summary || ""}
                readOnly
                rows={2}
                className="w-full bg-slate-900 border border-muninn-border rounded-lg px-3 py-2 text-white placeholder-muninn-text-muted focus:outline-none focus:border-muninn-accent bg-slate-950"
                placeholder="Auto-generated from conversation"
              />
            </div>

            <div>
              <label className="block text-sm text-muninn-text-muted mb-2">
                Hobbies
              </label>
              <div className="flex flex-wrap gap-2">
                {profileData.hobbies?.map((hobby, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-muninn-accent/20 border border-muninn-accent/30 text-sm text-muninn-accent"
                  >
                    {hobby}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm text-muninn-text-muted mb-2">
                Pride Points
              </label>
              <div className="flex flex-wrap gap-2">
                {profileData.pride_points?.map((point, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/20 border border-amber-400/30 text-sm text-amber-100"
                  >
                    {point}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm text-muninn-text-muted mb-2">
                Emotional Anchors
              </label>
              <div className="flex flex-wrap gap-2">
                {profileData.emotional_anchors?.map((anchor, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-400/20 border border-rose-400/30 text-sm text-rose-100"
                  >
                    {anchor}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm text-muninn-text-muted mb-2">
                Conversation Starters
              </label>
              <div className="space-y-2">
                {profileData.conversation_starters?.map((starter, i) => (
                  <div
                    key={i}
                    className="p-2 rounded-lg bg-slate-900/50 border border-muninn-border/50 text-sm text-slate-100"
                  >
                    "{starter}"
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm text-muninn-text-muted mb-2">
                Communication Tips
              </label>
              <div className="space-y-2">
                {profileData.communication_tips?.map((tip, i) => (
                  <div
                    key={i}
                    className="p-2 rounded-lg bg-slate-900/50 border border-muninn-border/50 text-sm text-slate-100"
                  >
                    • {tip}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 sticky bottom-0 bg-slate-950/95 -m-6 p-6 mt-6 border-t border-muninn-border">
            <button onClick={onClose} className="flex-1 btn-secondary">
              Cancel
            </button>
            <button onClick={handleSaveProfile} className="flex-1 btn-primary">
              Save Profile
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
