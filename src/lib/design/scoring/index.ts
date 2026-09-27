import type {
  LayoutTemplate,
  PhotoLayoutProfile,
  TemplateScore,
  VisualDensity,
} from "../types";

export interface ScoreInputContext {
  template: LayoutTemplate;
  photos: PhotoLayoutProfile[];
  editorial?: {
    headline?: string;
    bodyText?: string;
    quote?: string;
    caption?: string;
    isSpreadCandidate?: boolean;
  };
  history?: {
    recentTemplateIds?: string[];
    recentDensities?: VisualDensity[];
  };
}

/**
 * Deterministically scores a template's compatibility for a given set of photos,
 * story requirements, and page rhythm history.
 */
export function scoreTemplate(ctx: ScoreInputContext): TemplateScore {
  const { template, photos, editorial, history } = ctx;

  const photoCount = photos.length;
  // If photo count outside template capacity, immediate rejection
  if (photoCount < template.minPhotos || photoCount > template.maxPhotos) {
    return {
      templateId: template.id,
      score: 0,
      reasons: {
        orientationFit: 0,
        aspectRatioFit: 0,
        qualityFit: 0,
        focalPointFit: 0,
        visualBalance: 0,
        storyFit: 0,
        cropSafety: 0,
        textSpace: 0,
        spreadOpportunity: 0,
        repetitionPenalty: 100,
      },
    };
  }

  // 1. Orientation Fit (0 - 25)
  let orientationFit = 0;
  if (photos.length > 0) {
    let matchCount = 0;
    for (const p of photos) {
      if (template.preferredOrientations.includes(p.orientation)) {
        matchCount++;
      } else if (p.orientation === "SQUARE") {
        matchCount += 0.8;
      } else {
        matchCount += 0.3;
      }
    }
    orientationFit = Math.round((matchCount / photos.length) * 25);
  } else {
    orientationFit = 15;
  }

  // 2. Aspect Ratio Fit (0 - 15)
  let aspectRatioFit = 10;
  if (photos.length > 0) {
    const avgRatio =
      photos.reduce((sum, p) => sum + p.aspectRatio, 0) / photos.length;
    if (template.family === "LANDSCAPE" || template.family === "SPREAD") {
      aspectRatioFit = avgRatio >= 1.2 ? 15 : avgRatio >= 1.0 ? 10 : 4;
    } else if (template.family === "PORTRAIT") {
      aspectRatioFit = avgRatio <= 0.85 ? 15 : avgRatio <= 1.0 ? 11 : 5;
    } else {
      aspectRatioFit = 12;
    }
  }

  // 3. Quality Fit (0 - 15)
  let qualityFit = 10;
  if (photos.length > 0) {
    const avgQuality =
      photos.reduce((sum, p) => sum + p.qualityScore, 0) / photos.length;
    if (template.canonicalLayoutType === "FULL_BLEED" || template.family === "SPREAD") {
      qualityFit = avgQuality >= 0.8 ? 15 : avgQuality >= 0.65 ? 8 : 2;
    } else {
      qualityFit = Math.round(avgQuality * 15);
    }
  }

  // 4. Focal Point Fit (0 - 10)
  let focalPointFit = 8;
  if (template.family === "SPREAD" && photos[0]?.focalPoint) {
    const fx = photos[0].focalPoint.x;
    if (fx > 0.46 && fx < 0.54) {
      focalPointFit = 1; // dangerous gutter collision
    } else {
      focalPointFit = 10;
    }
  }

  // 5. Visual Balance (0 - 10)
  let visualBalance = 8;
  if (template.visualDensity === "HIGH" && photoCount >= 3) {
    visualBalance = 10;
  } else if (template.visualDensity === "LOW" && photoCount === 1) {
    visualBalance = 10;
  }

  // 6. Story Fit (0 - 10)
  let storyFit = 6;
  if (editorial?.quote && template.supportsQuote) {
    storyFit += 4;
  }
  if ((editorial?.bodyText || editorial?.headline) && template.supportsText) {
    storyFit += 3;
  }
  storyFit = Math.min(10, storyFit);

  // 7. Crop Safety (0 - 10)
  let cropSafety = 7;
  if (photos.length > 0) {
    const avgCrop =
      photos.reduce((sum, p) => sum + p.cropSafety, 0) / photos.length;
    if (template.canonicalLayoutType === "FULL_BLEED") {
      cropSafety = avgCrop >= 0.75 ? 10 : 3;
    } else {
      cropSafety = 9;
    }
  }

  // 8. Text Space (0 - 10)
  let textSpace = 5;
  if (template.supportsText) {
    textSpace = editorial?.bodyText ? 10 : 7;
  }

  // 9. Spread Opportunity (0 - 10)
  let spreadOpportunity = 0;
  if (template.supportsSpread && editorial?.isSpreadCandidate) {
    spreadOpportunity = 10;
  }

  // 10. Repetition Penalty (0 - 100)
  let repetitionPenalty = 0;
  const recentIds = history?.recentTemplateIds || [];
  const recentDensities = history?.recentDensities || [];

  if (recentIds.length > 0) {
    // Check immediate previous template
    if (recentIds[recentIds.length - 1] === template.id) {
      repetitionPenalty += 35;
    }
    // Check 2 pages ago
    if (recentIds.length >= 2 && recentIds[recentIds.length - 2] === template.id) {
      repetitionPenalty += 18;
    }
    // Reject if 3 times consecutively
    if (
      recentIds.length >= 2 &&
      recentIds[recentIds.length - 1] === template.id &&
      recentIds[recentIds.length - 2] === template.id
    ) {
      repetitionPenalty += 80;
    }
  }

  // Density rhythm penalty
  if (recentDensities.length > 0) {
    const lastDensity = recentDensities[recentDensities.length - 1];
    if (lastDensity === "HIGH" && template.visualDensity === "HIGH") {
      repetitionPenalty += 12; // alternate density
    }
  }

  const rawScore =
    orientationFit +
    aspectRatioFit +
    qualityFit +
    focalPointFit +
    visualBalance +
    storyFit +
    cropSafety +
    textSpace +
    spreadOpportunity -
    repetitionPenalty;

  const score = Math.max(0, Math.round(rawScore));

  return {
    templateId: template.id,
    score,
    reasons: {
      orientationFit,
      aspectRatioFit,
      qualityFit,
      focalPointFit,
      visualBalance,
      storyFit,
      cropSafety,
      textSpace,
      spreadOpportunity,
      repetitionPenalty,
    },
  };
}

/**
 * Ranks all available templates for a given photo set and context.
 */
export function rankTemplates(
  templates: LayoutTemplate[],
  ctx: Omit<ScoreInputContext, "template">,
): TemplateScore[] {
  const scores = templates.map((tpl) => scoreTemplate({ ...ctx, template: tpl }));
  return scores.sort((a, b) => b.score - a.score);
}

/**
 * Finds the top compatible template.
 */
export function selectBestTemplate(
  templates: LayoutTemplate[],
  ctx: Omit<ScoreInputContext, "template">,
): LayoutTemplate {
  const ranked = rankTemplates(templates, ctx);
  if (ranked.length > 0 && ranked[0].score > 0) {
    const match = templates.find((t) => t.id === ranked[0].templateId);
    if (match) return match;
  }
  return templates[0];
}
