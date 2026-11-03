import type { QualityProfile } from '../app/settings';

/** What each graphics profile changes. Presentation only: none of this reaches the simulation. */
export interface QualityParams {
  /** Upper bound for the canvas pixel ratio. */
  maxPixelRatio: number;
  /** Fraction of background towers drawn. */
  towerDensity: number;
  stars: boolean;
  /** Decorative extras (fire, holograms) once they exist. */
  decorations: boolean;
}

export const QUALITY: Record<QualityProfile, QualityParams> = {
  low: { maxPixelRatio: 1, towerDensity: 0.4, stars: false, decorations: false },
  medium: { maxPixelRatio: 1.5, towerDensity: 0.75, stars: true, decorations: true },
  high: { maxPixelRatio: 2, towerDensity: 1, stars: true, decorations: true },
};

export const QUALITY_ORDER: readonly QualityProfile[] = ['low', 'medium', 'high'];
