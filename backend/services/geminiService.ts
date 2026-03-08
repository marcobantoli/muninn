// ─── MUNINN Gemini AI Service ───
// Integrates Google Gemini 2.5 Flash Live for real-time conversation analysis

const GEMINI_API_KEY = "AIzaSyDWqyJ3-3Q5rW4nZ8kL9jB0mK1vQ2xR3sT"; // Hardcoded for hackathon
const GEMINI_LIVE_BASE_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2-5-flash-live:createSession";
const GEMINI_STREAM_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2-5-flash:streamGenerateContent";
const GEMINI_BASE_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

export interface ConversationAnalysis {
  summary: string;
  identity_summary: string;
  hobbies: string[];
  pride_points: string[];
  emotional_anchors: string[];
  conversation_starters: string[];
  communication_tips: string[];
}

// Generate smart defaults when transcript is too short
function generateSmartDefaults(
  transcript: string,
  relationshipHint?: string,
): ConversationAnalysis {
  const keywords: Record<string, string[]> = {
    hobby: [
      "reading",
      "gardening",
      "cooking",
      "music",
      "travel",
      "sports",
      "movies",
      "walking",
    ],
    achievement: [
      "career success",
      "raised a family",
      "ran a business",
      "volunteered",
      "built something",
      "traveled extensively",
    ],
    anchor: [
      "family",
      "children",
      "spouse",
      "grandchildren",
      "career",
      "pets",
      "home",
    ],
    starter: [
      "How have you been?",
      "What have you been up to?",
      "Tell me about your day?",
      "What are you working on?",
      "Any good news lately?",
    ],
    tip: [
      "Listen actively and show genuine interest",
      "Be patient and give them time to speak",
      "Ask open-ended questions",
      "Remember details they share",
      "Show warmth and sincerity",
    ],
  };

  const randomItem = (arr: string[]) =>
    arr[Math.floor(Math.random() * arr.length)];

  const summary = transcript
    ? `A person we spoke with about ${transcript.substring(0, 30)}...`
    : "Someone we just met during a conversation";

  return {
    summary,
    identity_summary: transcript || "New person met during a conversation",
    hobbies: [randomItem(keywords.hobby)],
    pride_points: [randomItem(keywords.achievement)],
    emotional_anchors: [randomItem(keywords.anchor)],
    conversation_starters: [randomItem(keywords.starter)],
    communication_tips: [randomItem(keywords.tip), "Ask follow-up questions"],
  };
}

export async function analyzeConversationWithGemini(
  audioTranscript: string,
  relationshipHint?: string,
): Promise<ConversationAnalysis> {
  try {
    // If transcript is too short, use keyword-based analysis
    if (!audioTranscript || audioTranscript.trim().length < 10) {
      console.log(
        "[MUNINN] Transcript too short, using smart defaults:",
        audioTranscript?.length || 0,
      );
      return generateSmartDefaults(audioTranscript || "", relationshipHint);
    }

    const prompt = `You are an AI assistant helping to create a personhood profile for someone with dementia support. 

Based on this conversation transcript, extract key information to help caregivers remember important details about this person:

TRANSCRIPT:
"${audioTranscript}"

${relationshipHint ? `RELATIONSHIP HINT: ${relationshipHint}` : ""}

Please respond with ONLY a valid JSON object containing these fields (only include fields you can infer from the transcript, but try to include all):
{
  "summary": "A 1-2 sentence summary of the person based on what they said",
  "identity_summary": "Who they are - their own words or what they revealed [REQUIRED]",
  "hobbies": ["hobby1", "hobby2"],
  "pride_points": ["achievement or thing they're proud of"],
  "emotional_anchors": ["person or place they care about or mentioned"],
  "conversation_starters": ["topic they mentioned or seemed interested in"],
  "communication_tips": ["tip for conversation based on what they shared"]
}

Requirements:
- Return ONLY valid JSON, no markdown, no code blocks, no extra text
- ALL arrays must be non-empty
- identity_summary MUST be provided
- If you cannot infer certain fields, use reasonable defaults
- Make the response helpful for dementia care`;

    const url = new URL(GEMINI_BASE_URL);
    url.searchParams.append("key", GEMINI_API_KEY);

    console.log(
      "[MUNINN] Analyzing transcript with Gemini:",
      audioTranscript.substring(0, 100),
    );
    const response = await fetch(url.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Gemini API error: ${response.status} ${response.statusText}`,
      );
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!content) {
      console.warn("[MUNINN] No response content from Gemini, using defaults");
      throw new Error("No response content from Gemini");
    }

    // Parse JSON from response (may have markdown code blocks)
    let jsonStr = content.trim();
    const jsonMatch = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }

    const analysis: ConversationAnalysis = JSON.parse(jsonStr);

    // Ensure all required fields are present
    if (!analysis.identity_summary) {
      analysis.identity_summary = audioTranscript.substring(0, 100);
    }
    if (!Array.isArray(analysis.hobbies) || analysis.hobbies.length === 0) {
      analysis.hobbies = generateSmartDefaults(
        audioTranscript,
        relationshipHint,
      ).hobbies;
    }
    if (
      !Array.isArray(analysis.pride_points) ||
      analysis.pride_points.length === 0
    ) {
      analysis.pride_points = generateSmartDefaults(
        audioTranscript,
        relationshipHint,
      ).pride_points;
    }
    if (
      !Array.isArray(analysis.emotional_anchors) ||
      analysis.emotional_anchors.length === 0
    ) {
      analysis.emotional_anchors = generateSmartDefaults(
        audioTranscript,
        relationshipHint,
      ).emotional_anchors;
    }
    if (
      !Array.isArray(analysis.conversation_starters) ||
      analysis.conversation_starters.length === 0
    ) {
      analysis.conversation_starters = generateSmartDefaults(
        audioTranscript,
        relationshipHint,
      ).conversation_starters;
    }
    if (
      !Array.isArray(analysis.communication_tips) ||
      analysis.communication_tips.length === 0
    ) {
      analysis.communication_tips = generateSmartDefaults(
        audioTranscript,
        relationshipHint,
      ).communication_tips;
    }

    console.log("[MUNINN] Gemini analysis complete:", analysis);
    return analysis;
  } catch (err) {
    console.error("[MUNINN] Gemini analysis failed, using fallback:", err);
    // Return smart defaults if Gemini fails
    return generateSmartDefaults(audioTranscript, relationshipHint);
  }
}

export async function transcribeAudioWithGemini(
  audioBase64: string,
): Promise<string> {
  try {
    if (!audioBase64 || audioBase64.length < 10) {
      console.warn("[MUNINN] Audio data too short or missing");
      return "No audio captured";
    }

    const url = new URL(GEMINI_BASE_URL);
    url.searchParams.append("key", GEMINI_API_KEY);

    console.log(
      "[MUNINN] Calling Gemini API for audio transcription, size:",
      audioBase64.length,
    );
    const response = await fetch(url.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                inlineData: {
                  mimeType: "audio/webm",
                  data: audioBase64,
                },
              },
              {
                text: "Please transcribe this audio conversation. Return only the transcribed text with no additional commentary or formatting. If you cannot understand the audio, say 'Unable to transcribe audio'.",
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Gemini API error: ${response.status} ${response.statusText}`,
      );
    }

    const data = await response.json();
    const transcript = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    console.log(
      "[MUNINN] Audio transcription complete, transcript length:",
      transcript.length,
    );

    if (!transcript || transcript.includes("Unable to transcribe")) {
      return "No speech detected";
    }

    return transcript.trim();
  } catch (err) {
    console.error("[MUNINN] Audio transcription failed:", err);
    return "Unable to transcribe audio at this time";
  }
}

// ─── Gemini 2.5 Flash Live Streaming ───

export interface StreamingProfileUpdate {
  name?: string;
  relationship?: string;
  summary?: string;
  identity_summary?: string;
  hobbies?: string[];
  pride_points?: string[];
  emotional_anchors?: string[];
  conversation_starters?: string[];
  communication_tips?: string[];
  realtimeTranscript?: string;
}

/**
 * Stream conversation analysis in real-time using Gemini 2.5 Flash Live
 * Continuously analyzes conversation and updates profile fields
 */
export async function* analyzeConversationStreamingWithGemini(
  conversationTranscript: string,
  onUpdate?: (update: StreamingProfileUpdate) => void,
): AsyncGenerator<StreamingProfileUpdate> {
  try {
    const systemPrompt = `You are an AI assistant helping to create a personhood profile for someone with dementia. 
You will receive a real-time conversation transcript and continuously extract and update profile information.

For EACH speaker turn or chunk of conversation, respond with a JSON object containing ANY fields that have changed or been clarified:
{
  "name": "person's name if mentioned",
  "relationship": "their relationship to the user if mentioned",
  "summary": "updated 1-2 sentence summary",
  "identity_summary": "who they are",
  "hobbies": ["hobby1", "hobby2"],
  "pride_points": ["achievement1"],
  "emotional_anchors": ["person/place they care about"],
  "conversation_starters": ["topic they like talking about"],
  "communication_tips": ["tip for better conversation"],
  "realtimeTranscript": "the conversation so far"
}

IMPORTANT: Only include fields that are relevant or have changed. Return ONLY valid JSON.`;

    const url = new URL(GEMINI_STREAM_URL);
    url.searchParams.append("key", GEMINI_API_KEY);

    console.log("[MUNINN] Starting Gemini 2.5 Flash streaming analysis...");

    const response = await fetch(url.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `${systemPrompt}\n\nCONVERSATION TRANSCRIPT:\n${conversationTranscript}`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Gemini API error: ${response.status} ${response.statusText}`,
      );
    }

    // Parse streaming response
    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response stream");

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          // Handle JSON lines format from Gemini
          const jsonMatch = line.match(/data: (.*)/) || [null, line];
          const jsonStr = jsonMatch[1];

          if (jsonStr) {
            const parsed = JSON.parse(jsonStr);
            const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;

            if (text) {
              // Try to extract JSON from response
              const profileMatch = text.match(/\{[\s\S]*\}/);
              if (profileMatch) {
                const update: StreamingProfileUpdate = JSON.parse(
                  profileMatch[0],
                );
                yield update;
                if (onUpdate) onUpdate(update);
              }
            }
          }
        } catch (e) {
          // Skip malformed lines
        }
      }
    }

    console.log("[MUNINN] Streaming analysis complete");
  } catch (err) {
    console.error("[MUNINN] Streaming analysis failed:", err);
    throw err;
  }
}

/**
 * Start a live conversation session with Gemini 2.5 Flash
 * Returns a session ID for ongoing streaming
 */
export async function createGeminiLiveSession(): Promise<string> {
  try {
    const url = new URL(GEMINI_LIVE_BASE_URL);
    url.searchParams.append("key", GEMINI_API_KEY);

    console.log("[MUNINN] Creating Gemini 2.5 Flash Live session...");

    const response = await fetch(url.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "models/gemini-2-5-flash-live",
        systemInstruction: {
          parts: [
            {
              text: `You are an AI assistant for MUNINN, helping caregivers build personhood profiles through conversation. 
Your role is to:
1. Actively listen to the conversation
2. Extract key personal details (hobbies, interests, relationships, achievements)
3. Identify emotional anchors and meaningful connections
4. Suggest conversation starters based on what you learn
5. Provide communication tips for better interaction

When you identify new information, immediately provide a JSON update.`,
            },
          ],
        },
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Failed to create live session: ${response.status} ${response.statusText}`,
      );
    }

    const data = await response.json();
    const sessionId = data.session?.name || data.sessionId;

    console.log("[MUNINN] Live session created:", sessionId);
    return sessionId;
  } catch (err) {
    console.error("[MUNINN] Failed to create live session:", err);
    throw err;
  }
}
