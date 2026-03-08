import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  CursorPoint,
  HoverPreview,
  PersonProfile,
  PersonhoodNote,
  AppState,
} from "../../shared/types";
import {
  startScreenCapture,
  stopScreenCapture,
  getVideoElement,
} from "../../vision/screenCapture";
import {
  detectFaces,
  initFaceDetection,
  resetFaceDetection,
} from "../../vision/faceDetection";
import { PersonhoodCard } from "../components/PersonhoodCard";
import { getProfileBuilder } from "../services/backgroundProfileBuilder";
import {
  processCursorFaceIntersection,
  onRecognition,
  resetRecognitionEngine,
  getDwellProgress,
  updateFaceMatcher,
  getActiveHoveredFaceId,
  getActiveHoverState,
} from "../../vision/recognitionEngine";

const API_BASE = "http://localhost:3001/api";
const RECOGNITION_LOOP_INTERVAL_MS = 100;

export function LiveAssistant() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayHideTimeoutRef = useRef<number | null>(null);
  const hoverPreviewHideTimeoutRef = useRef<number | null>(null);
  const recognitionLoopActiveRef = useRef(false);
  const activeRecognitionRef = useRef<PersonhoodNote | null>(null);
  const profilesByIdRef = useRef<Map<string, PersonProfile>>(new Map());
  const lastHoverPreviewRef = useRef<string | null>(null);
  const [appState, setAppState] = useState<AppState>({
    isCapturing: false,
    isCalibrated: true,
    detectedFaces: [],
    activeRecognition: null,
  });
  const [statusMessage, setStatusMessage] = useState("Ready to start");
  const loopRef = useRef<number | null>(null);
  const profileBuilderRef = useRef(getProfileBuilder());

  useEffect(() => {
    activeRecognitionRef.current = appState.activeRecognition;
  }, [appState.activeRecognition]);

  // Recognition callback
  useEffect(() => {
    const unsub = onRecognition((note: PersonhoodNote, facePosition) => {
      setAppState((prev: AppState) => ({ ...prev, activeRecognition: note }));
      lastHoverPreviewRef.current = null;

      if (hoverPreviewHideTimeoutRef.current !== null) {
        window.clearTimeout(hoverPreviewHideTimeoutRef.current);
        hoverPreviewHideTimeoutRef.current = null;
      }

      if (overlayHideTimeoutRef.current !== null) {
        window.clearTimeout(overlayHideTimeoutRef.current);
      }

      if (window.electronAPI) {
        window.electronAPI.showOverlay({
          visible: true,
          note,
          hoverPreview: null,
          x: Math.max(16, screen.width - 356),
          y: 16,
        });
      }

      // Auto-hide after 15 seconds
      overlayHideTimeoutRef.current = window.setTimeout(() => {
        setAppState((prev: AppState) => ({ ...prev, activeRecognition: null }));
        if (window.electronAPI) {
          window.electronAPI.hideOverlay();
        }
        overlayHideTimeoutRef.current = null;
      }, 15000);
    });

    return () => {
      if (overlayHideTimeoutRef.current !== null) {
        window.clearTimeout(overlayHideTimeoutRef.current);
        overlayHideTimeoutRef.current = null;
      }
      if (hoverPreviewHideTimeoutRef.current !== null) {
        window.clearTimeout(hoverPreviewHideTimeoutRef.current);
        hoverPreviewHideTimeoutRef.current = null;
      }
      unsub();
    };
  }, []);

  // Capture face screenshot from canvas
  const captureFromCanvas = useCallback(
    (x: number, y: number, width: number, height: number): string | null => {
      if (!canvasRef.current) return null;

      try {
        const canvas = document.createElement("canvas");
        canvas.width = Math.min(width * 2, 256);
        canvas.height = Math.min(height * 2, 256);

        const ctx = canvas.getContext("2d");
        if (!ctx) return null;

        // Draw the face region from the main canvas
        ctx.drawImage(
          canvasRef.current,
          x - width / 2,
          y - height / 2,
          width * 2,
          height * 2,
          0,
          0,
          canvas.width,
          canvas.height,
        );

        return canvas.toDataURL("image/jpeg");
      } catch (err) {
        console.error("[MUNINN] Failed to capture face:", err);
        return null;
      }
    },
    [],
  );

  // Create profile from detected face and background conversation
  const createProfileForFace = useCallback(
    async (faceId: string, faceImage: string) => {
      const builder = profileBuilderRef.current;
      const transcript = builder.getTranscript();

      if (!transcript || transcript.length < 5) {
        setStatusMessage("Listening... (speak to build profile)");
        return;
      }

      try {
        setStatusMessage("Analyzing conversation with Gemini...");
        console.log("[MUNINN] Creating profile from hover:", {
          faceId,
          transcriptLength: transcript.length,
        });

        const analysisRes = await fetch(
          `${API_BASE}/conversation/analyze-text`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ transcript }),
          },
        );

        if (!analysisRes.ok) throw new Error("Analysis failed");

        const { analysis } = await analysisRes.json();

        // Create minimal profile with captured face
        const profileRes = await fetch(`${API_BASE}/profiles`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: `Person ${Date.now()}`, // Will be refined later
            relationship: "Contact",
            face_reference_image: faceImage,
            identity_summary: analysis.identity_summary || "New person met",
            hobbies: analysis.hobbies || [],
            pride_points: analysis.pride_points || [],
            emotional_anchors: analysis.emotional_anchors || [],
            conversation_starters: analysis.conversation_starters || [],
            communication_tips: analysis.communication_tips || [],
          }),
        });

        if (profileRes.ok) {
          const newProfile = await profileRes.json();
          console.log("[MUNINN] Profile created:", newProfile.id);

          // Refresh profiles
          const profilesRes = await fetch(`${API_BASE}/profiles`);
          const profiles: PersonProfile[] = await profilesRes.json();
          profilesByIdRef.current = new Map(profiles.map((p) => [p.id, p]));
          updateFaceMatcher(profiles);

          setStatusMessage("✓ New profile created! (Edit in Profile Editor)");
          builder.clearProfile(faceId);
        }
      } catch (err) {
        console.error("[MUNINN] Profile creation failed:", err);
        setStatusMessage("Error creating profile");
      }
    },
    [],
  );

  const startLoop = useCallback(async () => {
    try {
      recognitionLoopActiveRef.current = true;
      const builder = profileBuilderRef.current;

      // Start background audio recording
      await builder.startRecording();
      setStatusMessage(
        "Initializing AI Face Models (downloading weights if first run)...",
      );
      await initFaceDetection();

      setStatusMessage("Loading profiles and building Face Matcher...");
      const res = await fetch(`${API_BASE}/profiles`);
      if (res.ok) {
        const profiles: PersonProfile[] = await res.json();
        console.log(
          `[MUNINN] Fetched ${profiles.length} profiles from API. Building Face Matcher...`,
        );
        profilesByIdRef.current = new Map(
          profiles.map((profile) => [profile.id, profile]),
        );
        updateFaceMatcher(profiles);
      } else {
        console.warn(
          "[MUNINN] Failed to fetch profiles from API. Face Matcher might not work.",
        );
        profilesByIdRef.current = new Map();
      }

      let videoEl: HTMLVideoElement;
      try {
        videoEl = await startScreenCapture();
      } catch {
        setStatusMessage("Screen capture unavailable — using demo mode");
        setAppState((prev: AppState) => ({ ...prev, isCapturing: true }));
        return;
      }

      setAppState((prev: AppState) => ({
        ...prev,
        isCapturing: true,
        isCalibrated: true,
      }));

      setStatusMessage(
        "Recognition loop active — hover your cursor over a face to recognize it",
      );

      const scheduleNextLoop = () => {
        if (!recognitionLoopActiveRef.current) {
          return;
        }

        loopRef.current = window.setTimeout(() => {
          void runLoop();
        }, RECOGNITION_LOOP_INTERVAL_MS);
      };

      // Main recognition loop (~10 fps) that stays active while the window is minimized.
      const runLoop = async () => {
        if (!recognitionLoopActiveRef.current) {
          return;
        }

        const video = getVideoElement();
        if (!video) {
          scheduleNextLoop();
          return;
        }

        try {
          // Detect faces
          const faces = await detectFaces(video);

          if (!recognitionLoopActiveRef.current) {
            return;
          }

          let cursorPoint: CursorPoint | null = null;
          try {
            const cursor = await window.electronAPI.getCursorScreenPoint();
            cursorPoint = {
              x: cursor.x,
              y: cursor.y,
              timestamp: Date.now(),
            };
          } catch (error) {
            console.warn("[MUNINN] Failed to read cursor position:", error);
          }

          if (!recognitionLoopActiveRef.current) {
            return;
          }

          processCursorFaceIntersection(cursorPoint, faces, {
            width: video.videoWidth || 1920,
            height: video.videoHeight || 1080,
          });

          const activeHoverState = getActiveHoverState();
          if (activeHoverState && !activeRecognitionRef.current) {
            if (hoverPreviewHideTimeoutRef.current !== null) {
              window.clearTimeout(hoverPreviewHideTimeoutRef.current);
              hoverPreviewHideTimeoutRef.current = null;
            }

            const matchedProfile = activeHoverState.profileId
              ? profilesByIdRef.current.get(activeHoverState.profileId)
              : null;

            const hoverStatus =
              activeHoverState.confidence === "high" && matchedProfile
                ? "recognized"
                : activeHoverState.confidence === "low" && matchedProfile
                  ? "low-confidence"
                  : "unrecognized";

            const hoverTitle =
              hoverStatus === "unrecognized"
                ? "Face detected"
                : matchedProfile?.name || "Face detected";

            const hoverSubtitle =
              hoverStatus === "recognized"
                ? matchedProfile?.relationship || "Profile linked"
                : hoverStatus === "low-confidence"
                  ? `${matchedProfile?.relationship || "Possible match"} · low confidence`
                  : "No linked profile match";

            const hoverPreview: HoverPreview = {
              title: hoverTitle,
              subtitle: hoverSubtitle,
              progress: activeHoverState.progress,
              status: hoverStatus,
              distance: activeHoverState.distance,
            };

            const hoverPreviewKey = `${hoverPreview.title}|${hoverPreview.subtitle}|${hoverPreview.status}|${Math.round(hoverPreview.progress * 100)}`;
            if (lastHoverPreviewRef.current !== hoverPreviewKey) {
              lastHoverPreviewRef.current = hoverPreviewKey;
              window.electronAPI?.updateOverlay({
                visible: true,
                note: null,
                hoverPreview,
                x: Math.max(16, screen.width - 356),
                y: 16,
              });
            }
          } else {
            if (
              lastHoverPreviewRef.current !== null &&
              !activeRecognitionRef.current
            ) {
              if (hoverPreviewHideTimeoutRef.current !== null) {
                window.clearTimeout(hoverPreviewHideTimeoutRef.current);
              }

              hoverPreviewHideTimeoutRef.current = window.setTimeout(() => {
                lastHoverPreviewRef.current = null;
                hoverPreviewHideTimeoutRef.current = null;
                if (!activeRecognitionRef.current) {
                  window.electronAPI?.hideOverlay();
                }
              }, 180);
            }
          }

          setAppState((prev: AppState) => ({
            ...prev,
            detectedFaces: faces,
          }));

          // Draw on canvas when the UI is visible; recognition continues even if paint is throttled.
          drawVisualization(faces, {
            width: video.videoWidth || 1920,
            height: video.videoHeight || 1080,
          });
        } catch (error) {
          console.error("[MUNINN] Recognition loop tick failed:", error);
        }

        scheduleNextLoop();
      };

      void runLoop();
    } catch (err) {
      recognitionLoopActiveRef.current = false;
      console.error("Loop start failed:", err);
      setStatusMessage("Error starting recognition loop");
    }
  }, []);

  const stopLoop = useCallback(async () => {
    recognitionLoopActiveRef.current = false;
    const builder = profileBuilderRef.current;

    // Stop background audio recording
    await builder.stopRecording();

    if (loopRef.current) {
      window.clearTimeout(loopRef.current);
      loopRef.current = null;
    }
    if (overlayHideTimeoutRef.current !== null) {
      window.clearTimeout(overlayHideTimeoutRef.current);
      overlayHideTimeoutRef.current = null;
    }
    if (hoverPreviewHideTimeoutRef.current !== null) {
      window.clearTimeout(hoverPreviewHideTimeoutRef.current);
      hoverPreviewHideTimeoutRef.current = null;
    }
    stopScreenCapture();
    resetFaceDetection();
    resetRecognitionEngine();
    profilesByIdRef.current = new Map();
    lastHoverPreviewRef.current = null;
    setAppState((prev: AppState) => ({
      ...prev,
      isCapturing: false,
      detectedFaces: [],
      activeRecognition: null,
    }));
    setStatusMessage("Stopped");
    if (window.electronAPI) {
      window.electronAPI.hideOverlay();
    }
  }, []);

  function drawVisualization(
    faces: import("../../vision/faceDetection").FaceWithDescriptor[],
    captureSize?: { width: number; height: number },
  ) {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw the screen capture video frame as the background
    const video = getVideoElement();
    if (video && video.readyState >= 2) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    }

    const captureWidth = captureSize?.width || video?.videoWidth || 1920;
    const captureHeight = captureSize?.height || video?.videoHeight || 1080;
    const activeHoveredFaceId = getActiveHoveredFaceId();

    // Draw face bounding boxes
    faces.forEach((f: any) => {
      const face = f;
      const progress = getDwellProgress(face.id);
      const isHovered = face.id === activeHoveredFaceId;
      const color =
        progress > 0.8 ? "#00b894" : progress > 0.3 ? "#fdcb6e" : "#6c5ce7";
      const x = face.x * (canvas.width / captureWidth);
      const y = face.y * (canvas.height / captureHeight);
      const width = face.width * (canvas.width / captureWidth);
      const height = face.height * (canvas.height / captureHeight);

      ctx.strokeStyle = color;
      ctx.lineWidth = isHovered ? 4 : 2;
      ctx.strokeRect(x, y, width, height);

      if (isHovered) {
        ctx.save();
        ctx.shadowColor = "rgba(253, 203, 110, 0.7)";
        ctx.shadowBlur = 16;
        ctx.strokeStyle = "#fdcb6e";
        ctx.lineWidth = 4;
        ctx.strokeRect(x - 2, y - 2, width + 4, height + 4);
        ctx.restore();
      }

      // Recognition progress bar
      if (progress > 0) {
        const barWidth = width;
        ctx.fillStyle = color;
        ctx.fillRect(x, y + height + 4, barWidth * progress, 3);
      }
    });
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
            <span
              className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-muninn-accent/15 text-base font-semibold text-muninn-accent ${appState.isCapturing ? "animate-pulse" : ""}`}
            >
              LA
            </span>
            Live Assistant
          </h1>
          <p className="mt-1 text-muninn-text-dim">{statusMessage}</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Start/Stop */}
          {appState.isCapturing ? (
            <button
              id="stop-btn"
              onClick={stopLoop}
              className="btn-danger text-sm"
            >
              Stop
            </button>
          ) : (
            <button
              id="start-btn"
              onClick={startLoop}
              className="btn-primary text-sm"
            >
              Start Recognition
            </button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-3 gap-6">
        {/* Screen Capture View */}
        <div className="col-span-2">
          <div className="glass-card overflow-hidden">
            <div className="p-3 border-b border-muninn-border flex items-center justify-between">
              <span className="text-sm text-muninn-text-dim">
                Screen Capture Feed
              </span>
              <div className="flex items-center gap-2">
                <div
                  className={`w-2 h-2 rounded-full ${appState.isCapturing ? "bg-muninn-success animate-pulse" : "bg-muninn-text-muted"}`}
                />
                <span className="text-xs text-muninn-text-muted">
                  {appState.isCapturing ? "LIVE" : "OFFLINE"}
                </span>
              </div>
            </div>
            <div className="relative bg-black aspect-video">
              <canvas
                ref={canvasRef}
                width={960}
                height={540}
                className="w-full h-full"
              />
              {!appState.isCapturing && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className="mb-4 text-sm uppercase tracking-[0.3em] text-white/35">
                      Preview
                    </div>
                    <p className="text-muninn-text-muted text-sm">
                      Click "Start Recognition" to begin the loop
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Detection Stats */}
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="glass-card p-4">
              <div className="text-xs text-muninn-text-muted">
                Detected Faces
              </div>
              <div className="text-2xl font-bold text-white mt-1">
                {appState.detectedFaces.length}
              </div>
            </div>
            <div className="glass-card p-4">
              <div className="text-xs text-muninn-text-muted">Recognition</div>
              <div className="text-sm mt-1">
                {appState.activeRecognition ? (
                  <span className="badge-success">Active</span>
                ) : (
                  <span className="text-muninn-text-muted">Scanning...</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Active Recognition Card */}
        <div className="sticky top-8 space-y-4">
          {appState.activeRecognition ? (
            <PersonhoodCard
              note={appState.activeRecognition}
              onDismiss={() => {
                setAppState((prev: AppState) => ({
                  ...prev,
                  activeRecognition: null,
                }));
                if (window.electronAPI) {
                  window.electronAPI.hideOverlay();
                }
              }}
            />
          ) : (
            <div className="glass-card p-6 flex flex-col items-center justify-center text-center">
              <div className="mb-4">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-muninn-accent/15">
                  <svg
                    className="w-6 h-6 text-muninn-accent"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </div>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">
                Recognition Ready
              </h3>
              <p className="text-muninn-text-dim text-sm">
                Hover your cursor over a detected face. System silently listens
                and builds personhood profiles automatically.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
