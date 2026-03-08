// ─── MUNINN Gemini AI Service ───
// Integrates Google Gemini for conversation analysis and profile generation

const GEMINI_API_KEY = "AIzaSyDWqyJ3-3Q5rW4nZ8kL9jB0mK1vQ2xR3sT"; // Hardcoded for hackathon
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
