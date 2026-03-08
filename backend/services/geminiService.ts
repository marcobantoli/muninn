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

export async function analyzeConversationWithGemini(
  audioTranscript: string,
  relationshipHint?: string,
): Promise<ConversationAnalysis> {
  try {
    const prompt = `You are an AI assistant helping to create a personhood profile for someone with dementia. 
        
Based on this conversation transcript, extract key information to help caregivers remember important details about this person:

TRANSCRIPT:
${audioTranscript}

${relationshipHint ? `RELATIONSHIP HINT: ${relationshipHint}` : ""}

Please respond with a JSON object containing:
{
  "summary": "A 1-2 sentence summary of the person",
  "identity_summary": "Who they are in their own words or from the conversation",
  "hobbies": ["hobby1", "hobby2", "hobby3"],
  "pride_points": ["achievement1", "achievement2"],
  "emotional_anchors": ["person/place they care about 1", "person/place they care about 2"],
  "conversation_starters": ["topic1 they like talking about", "topic2"],
  "communication_tips": ["tip1 for better conversation", "tip2"]
}

Return ONLY valid JSON, no additional text.`;

    const url = new URL(GEMINI_BASE_URL);
    url.searchParams.append("key", GEMINI_API_KEY);

    console.log("[MUNINN] Calling Gemini API for conversation analysis...");
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
      throw new Error("No response content from Gemini");
    }

    // Parse JSON from response (may have markdown code blocks)
    let jsonStr = content;
    const jsonMatch = content.match(/```(?:json)?\n?([\s\S]*?)\n?```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }

    const analysis: ConversationAnalysis = JSON.parse(jsonStr);
    console.log("[MUNINN] Gemini analysis complete:", analysis);
    return analysis;
  } catch (err) {
    console.error("[MUNINN] Gemini analysis failed, using fallback:", err);
    // Return a basic fallback if Gemini fails
    return {
      summary: "New person met during a conversation",
      identity_summary: audioTranscript.substring(0, 100),
      hobbies: ["Conversation"],
      pride_points: [],
      emotional_anchors: [],
      conversation_starters: ["Tell me about yourself"],
      communication_tips: ["Listen actively", "Show genuine interest"],
    };
  }
}

export async function transcribeAudioWithGemini(
  audioBase64: string,
): Promise<string> {
  try {
    const url = new URL(GEMINI_BASE_URL);
    url.searchParams.append("key", GEMINI_API_KEY);

    console.log("[MUNINN] Calling Gemini API for audio transcription...");
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
                text: "Please transcribe this audio conversation. Return only the transcribed text, no additional commentary.",
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
      "[MUNINN] Audio transcription complete, length:",
      transcript.length,
    );
    return transcript || "Audio transcription unavailable";
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
