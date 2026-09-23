import { EDITORIAL_PROMPT_VERSION, EDITORIAL_CONFIG } from "@/config/ai";
import type { BookOccasion, BookStyle } from "@/types/book";
import type { PhotoAnalysis } from "../vision/types";
import type { EditorialInput, EditorialPhotoSummary } from "./types";
import type { OpenRouterMessage } from "@/lib/ai/types";

export { EDITORIAL_PROMPT_VERSION };

/**
 * Compresses raw PhotoAnalysis into a compact representation for editorial prompt efficiency.
 * Strips backend paths, signed URLs, and excessive metadata.
 */
export function compressPhotosForEditorial(
  photos: PhotoAnalysis[],
): EditorialPhotoSummary[] {
  return photos.map((p) => ({
    photoId: p.photoId,
    orientation: p.orientation,
    description: p.visualDescription,
    scene: `${p.scene.category}: ${p.scene.description}`,
    timeOfDay: p.scene.timeOfDay,
    subjects: p.subjects.map(
      (s) => `${s.prominence} ${s.type} (count ${s.count}): ${s.description}`,
    ),
    peopleCount: p.peopleCount,
    focalPoint: p.composition.focalPoint,
    cropSafety: p.composition.cropSafety,
    quality: `${p.visualQuality.overall}, ${p.visualQuality.sharpness}`,
    dominantColors: p.colors.dominant,
    colorMood: p.colors.mood,
    locationClues: p.locationClues.map((c) => `${c.clue} (${c.type})`),
    occasionClues: p.occasionClues.map((c) => `${c.occasion}: ${c.evidence}`),
    tags: p.tags,
  }));
}

export function buildEditorialSystemPrompt(
  occasion: BookOccasion,
  style: BookStyle,
): string {
  const maxWords =
    EDITORIAL_CONFIG.captionWordLimits[style] ?? 18;

  let occasionArc = "";
  if (occasion === "TRAVEL") {
    occasionArc = `TRAVEL STORY ARC GUIDELINES:
- Progression: Arrival / Establishing -> Exploration / Discovery -> People & Shared Moments -> Highlights / Peak Experiences -> Quiet Details / Evening / Departure.
- Adapt chapters to the actual photos provided (typically 2-3 chapters for 10-14 photos, 3-5 for 15-25 photos, 4-7 for 26-50 photos). Do NOT create 1 chapter per photo.`;
  } else {
    occasionArc = `PERSONAL MEMORIES STORY ARC GUIDELINES:
- Progression: Beginning / Context -> Everyday Moments -> People & Connections -> Highlights -> Quiet Reflective Details -> Closing Memory.
- Adapt chapters to visual themes and emotional rhythm without forcing rigid milestones.`;
  }

  let styleGuidance = "";
  switch (style) {
    case "EDITORIAL":
      styleGuidance = `STYLE: EDITORIAL
- Tone: Observational, refined, curated, and visually disciplined.
- Captions: Polished, concise (target max ${maxWords} words). Focus on visual context and atmosphere.
- Pacing: Balanced, clear visual hierarchy, strong alternating rhythm between wide establishing scenes and detailed moments.`;
      break;
    case "CINEMATIC":
      styleGuidance = `STYLE: CINEMATIC
- Tone: Atmospheric, immersive, dramatic, and visual.
- Captions: Evocative yet restrained (target max ${maxWords} words).
- Pacing: Dynamic rhythm, deliberate pacing contrasts, prominent hero moments, dramatic transitions.`;
      break;
    case "MINIMAL":
      styleGuidance = `STYLE: MINIMAL
- Tone: Quiet, direct, elegant, and uncluttered.
- Captions: Very short, sparse (target max ${maxWords} words).
- Pacing: Calm and spacious. Grouping highlights negative space and breathing room.`;
      break;
    case "JOURNAL":
      styleGuidance = `STYLE: JOURNAL
- Tone: Personal, warm, observational, and candid.
- Captions: Slightly conversational, attentive to small details (target max ${maxWords} words).
- Pacing: Natural organic progression from moment to moment.`;
      break;
  }

  return `You are an expert editorial photo-book planner.
Your role is to transform structured visual photo analyses into a coherent narrative editorial plan for a personal photo magazine.

Return ONLY structured JSON matching the EditorialPlan v1.0.0 schema. No markdown formatting, backticks, or commentary.

${occasionArc}

${styleGuidance}

CRITICAL EDITORIAL RULES:
1. PHOTO ID INTEGRITY:
   - You MUST ONLY reference photo IDs supplied in the input.
   - NEVER invent or fabricate new photo IDs (e.g. photo_999 or unknown IDs).
   - Every photo in the sequence and chapters MUST match an authoritative input photo ID exactly.
2. SEQUENCE INTEGRITY:
   - Sequence numbers must be contiguous positive integers: 1, 2, 3, ..., N.
   - Every included photo must appear exactly once in photoSequence. No duplicate sequence numbers.
   - Order photos with visual variety: avoid repeating identical scenes, subjects, or orientations back-to-back when alternatives exist.
3. CHAPTER INTEGRITY:
   - Group photos into coherent chapters.
   - Each chapter must have a unique 'id' (e.g. "chapter_1"), a descriptive 'title', a brief 'summary', and an array of 'photoIds'.
   - Every chapter MUST contain at least 1 photo. Never produce empty chapters.
   - Every photoId in a chapter MUST exist in photoSequence.
4. HERO & ANCHOR SELECTION:
   - 'coverCandidateIds': Select 2 to 5 strong candidate photo IDs suitable for the cover.
   - 'openingPhotoId': Select 1 photo that establishes the scale, environment, or arrival.
   - 'closingPhotoId': Select 1 photo that provides closure, reflection, or a parting moment.
5. CAPTIONS & FACTUALITY:
   - Captions must describe ONLY observable visual evidence from the photo analysis and occasion context.
   - Do NOT invent specific names, dates, private emotional psychology, or unverified locations.
   - Caption text must strictly adhere to the max length guidance (${maxWords} words maximum).
   - Every caption's photoId MUST exist in the supplied photo IDs.
6. TITLE & NARRATIVE SUMMARY:
   - 'title': Generate a memorable 2 to 6 word title appropriate to the book occasion and content. Avoid generic cliches ("Our Memories", "Best Moments"). Provide 3 alternative candidate titles in 'titleCandidates'.
   - 'narrativeSummary': 1 to 3 concise sentences summarizing the editorial story arc.
7. PACING & CONFIDENCE:
   - 'pacing': opening ("SLOW"|"MODERATE"|"IMMEDIATE"), middle ("SLOW"|"MODERATE"|"FAST"), ending ("QUIET"|"REFLECTIVE"|"ENERGETIC"), rhythm ("CALM"|"BALANCED"|"DYNAMIC").
   - 'confidence': sub-scores from 0.0 to 1.0 for overall, narrative, grouping, pacing, captions.`;
}

export function buildEditorialUserPrompt(input: EditorialInput): string {
  const compressed = compressPhotosForEditorial(input.photos);

  const payload: Record<string, unknown> = {
    bookId: input.bookId,
    occasion: input.occasion,
    style: input.style,
    totalPhotos: input.photos.length,
    photos: compressed,
  };

  if (input.title) {
    payload.userProvidedTitle = input.title;
  }
  if (input.protectedPhotoIds && input.protectedPhotoIds.length > 0) {
    payload.protectedPhotoIds = input.protectedPhotoIds;
  }

  return `Plan the editorial story for this photo collection.

INPUT SPECIFICATION:
${JSON.stringify(payload, null, 2)}

Produce the complete EditorialPlan JSON matching schemaVersion "1.0.0".`;
}

export function buildEditorialMessages(
  input: EditorialInput,
): OpenRouterMessage[] {
  return [
    {
      role: "system",
      content: buildEditorialSystemPrompt(input.occasion, input.style),
    },
    {
      role: "user",
      content: buildEditorialUserPrompt(input),
    },
  ];
}
