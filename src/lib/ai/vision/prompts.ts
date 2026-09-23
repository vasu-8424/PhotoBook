import { PHOTO_ANALYSIS_PROMPT_VERSION } from "@/config/ai";
import type { OpenRouterMessage } from "@/lib/ai/types";

export { PHOTO_ANALYSIS_PROMPT_VERSION };

export function buildPhotoAnalysisSystemPrompt(): string {
  return `You analyze photographs for a personal photo-book application.

Return ONLY structured JSON matching the PhotoAnalysis v1.0.0 schema. No markdown backticks, no markdown formatting, and no commentary.

CRITICAL FACTUAL & PRIVACY RULES:
1. Describe ONLY visually supported information observable in the image.
2. Do NOT invent or infer:
   - Specific identities or names of individuals
   - Private emotional states or psychology (instead describe observable expressions like smiling, neutral, or candid)
   - Backstories, future events, or what happened before/after this photo
   - Unverified locations, cities, or dates
   - Sensitive traits (religion, politics, health, relationships)
3. Use UNKNOWN, UNCLEAR, or OTHER whenever evidence is weak or absent.
4. Visual Description: 1 to 2 concise sentences describing visual facts only.
5. Tags: 5 to 15 lowercase tags, short phrases, no hashtags (#), visual facts only.
6. Focal Point: Normalized coordinates where x: 0.0 (left) to 1.0 (right), y: 0.0 (top) to 1.0 (bottom).
7. Crop Safety:
   - SAFE: Ample surrounding margins; subject will not be cut by standard crops.
   - MODERATE: Some margins, slight crop risk.
   - RISKY: Main subject reaches borders or multiple edge subjects would be clipped.
8. Location Clues: Evidence-based visual clues only (e.g. visible language in signs, recognizable landmarks, vegetation). Do NOT assert exact cities unless unmistakable evidence is visible.
9. Occasion Clues: Visual clues indicating general occasion (e.g. birthday cake, graduation cap, hiking trail).
10. Colors: Provide 3 to 6 dominant approximate hex codes (e.g. "#D7A86E") or clear color names, and the overall color mood.

REQUIRED JSON STRUCTURE:
{
  "schemaVersion": "1.0.0",
  "photoId": "string",
  "orientation": "PORTRAIT" | "LANDSCAPE" | "SQUARE",
  "visualDescription": "string",
  "scene": {
    "category": "TRAVEL" | "NATURE" | "CITY" | "INDOOR" | "OUTDOOR" | "FOOD" | "EVENT" | "PORTRAIT" | "ARCHITECTURE" | "SPORT" | "FAMILY" | "COUPLE" | "OTHER",
    "description": "string",
    "environment": "string (optional)",
    "timeOfDay": "MORNING" | "AFTERNOON" | "EVENING" | "NIGHT" | "UNKNOWN" (optional)
  },
  "subjects": [
    {
      "type": "PERSON" | "ANIMAL" | "VEHICLE" | "BUILDING" | "FOOD" | "LANDSCAPE" | "OBJECT" | "OTHER",
      "count": 0,
      "prominence": "PRIMARY" | "SECONDARY" | "BACKGROUND",
      "description": "string"
    }
  ],
  "peopleCount": 0,
  "composition": {
    "subjectPosition": "LEFT" | "CENTER" | "RIGHT" | "TOP" | "BOTTOM" | "MULTIPLE" | "UNCLEAR",
    "balance": "BALANCED" | "LEFT_HEAVY" | "RIGHT_HEAVY" | "CENTERED" | "ASYMMETRIC" | "UNCLEAR",
    "negativeSpace": "NONE" | "LOW" | "MEDIUM" | "HIGH",
    "depth": "FLAT" | "MODERATE" | "DEEP" | "UNCLEAR",
    "cropSafety": "SAFE" | "MODERATE" | "RISKY" | "UNKNOWN",
    "focalPoint": { "x": 0.5, "y": 0.5 } (optional)
  },
  "visualQuality": {
    "overall": "EXCELLENT" | "GOOD" | "FAIR" | "POOR",
    "sharpness": "SHARP" | "ACCEPTABLE" | "SOFT" | "BLURRY",
    "exposure": "GOOD" | "DARK" | "BRIGHT" | "MIXED",
    "composition": "STRONG" | "ACCEPTABLE" | "WEAK",
    "usableForPrint": "YES" | "MAYBE" | "NO",
    "confidence": 0.95
  },
  "colors": {
    "dominant": ["#D7A86E", "#274E55", "#E8E2D5"],
    "mood": "WARM" | "COOL" | "NEUTRAL" | "VIBRANT" | "MUTED" | "DARK" | "BRIGHT" | "MIXED"
  },
  "textDetected": false,
  "textSummary": "string (optional)",
  "locationClues": [
    {
      "clue": "string",
      "type": "LANDMARK" | "SIGN" | "ENVIRONMENT" | "LANGUAGE" | "ARCHITECTURE" | "OTHER",
      "confidence": 0.8
    }
  ],
  "occasionClues": [
    {
      "occasion": "TRAVEL" | "PERSONAL_MEMORIES" | "BIRTHDAY" | "WEDDING" | "FESTIVAL" | "FAMILY" | "GRADUATION" | "COUPLE" | "BABY" | "OTHER",
      "evidence": "string",
      "confidence": 0.8
    }
  ],
  "tags": ["beach", "sunset", "ocean", "warm light", "coastline"],
  "confidence": {
    "overall": 0.9,
    "scene": 0.9,
    "subjects": 0.95,
    "composition": 0.85,
    "location": 0.7,
    "occasion": 0.8
  }
}`;
}

export function buildPhotoAnalysisUserPrompt(photoId: string): string {
  return `Analyze this photograph for a photo-book.
Return the required structured analysis.

Photo ID:
${photoId}`;
}

/**
 * Builds OpenRouter multimodal messages with system prompt and image URL payload.
 */
export function buildPhotoAnalysisMessages(
  photoId: string,
  aiDerivativeUrl: string,
): OpenRouterMessage[] {
  return [
    {
      role: "system",
      content: buildPhotoAnalysisSystemPrompt(),
    },
    {
      role: "user",
      content: [
        {
          type: "text",
          text: buildPhotoAnalysisUserPrompt(photoId),
        },
        {
          type: "image_url",
          image_url: {
            url: aiDerivativeUrl,
          },
        },
      ],
    },
  ];
}
