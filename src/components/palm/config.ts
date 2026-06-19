// Palmkit Studio — STEP 1 palm configuration.
// Everything tunable lives here so frond count, colors, opacity and hotspot
// labels are props/config (CLAUDE.md: expandability — structure, don't build).

export type Vec3 = [number, number, number];

/** Where a hotspot's dot is anchored on the model (snapped to a real vertex). */
export type AnchorKind =
  | { type: 'frondTip'; frond: number } // tip of frond N
  | { type: 'crown' } // apex above the crown
  | { type: 'trunk'; t: number }; // point along the trunk (0 base .. 1 top)

export interface HotspotConfig {
  id: string;
  label: string;
  /** Short supporting line shown under the label. */
  blurb: string;
  anchor: AnchorKind;
  /** Fine-tune the label placement (screen-space-ish nudge), e.g. crown sideways. */
  labelOffset?: { dx?: number; dy?: number; out?: number };
}

export interface PalmConfig {
  frondCount: number;
  colors: typeof COLORS;
  hotspots: HotspotConfig[];
  /** Face translucency — solid yet see-through so the wireframe reads (0..1). */
  faceOpacity: number;
}

// Sober, cool-leaning palette (CLAUDE.md). No cream/beige in UI.
// "High-tech blueprint": sober solid faces, luminous TEAL wireframe + vertex
// field, CORAL hotspot accents so the 6 services stand out from the vertex set.
export const COLORS = {
  // A palette of greens — fronds vary frond-to-frond and block-to-block
  // (jittered in layout) so the canopy isn't a flat single green.
  frondGreens: ['#5BA877', '#4E9A6B', '#3E7E57', '#46916A', '#37714E'],
  // Two trunk tones, blended bottom→top then jittered per block.
  trunkBottom: '#7C5A30',
  trunkTop: '#9A6F3C',
  coconut: '#6B4A2E',
  // Luminous construction layers.
  edge: '#5FE3D6', // glowing wireframe edges
  vertex: '#5FE3D6', // glowing vertex points (the full field)
  // Hotspot accent — warm, distinct from the teal vertex field.
  hotspot: '#FF6B4A',
  connector: '#FF6B4A',
  ink: '#1C2B26', // high-contrast label text on white
};

// Six services. Anchors are a *subset* of the full vertex field, marked
// distinctly (coral, larger). labelOffset tidies the reduced-motion all-labels
// pose (bias AI sideways; de-overlap the two left labels).
export const HOTSPOTS: HotspotConfig[] = [
  { id: 'websites', label: 'Websites', blurb: 'Fast, modern sites', anchor: { type: 'frondTip', frond: 0 } },
  { id: 'seo', label: 'SEO', blurb: 'Found on search', anchor: { type: 'frondTip', frond: 2 } },
  { id: 'ecommerce', label: 'E-commerce', blurb: 'Stores that sell', anchor: { type: 'frondTip', frond: 4 }, labelOffset: { dy: 0.32 } },
  { id: 'ai', label: 'AI', blurb: 'Smart automation', anchor: { type: 'crown' }, labelOffset: { dx: 0.9, dy: -0.55 } },
  { id: 'strategy', label: 'Strategy', blurb: 'Clear direction', anchor: { type: 'trunk', t: 0.62 } },
  { id: 'brand', label: 'Brand', blurb: 'Identity & design', anchor: { type: 'frondTip', frond: 6 }, labelOffset: { dy: -0.3 } },
];

export const DEFAULT_CONFIG: PalmConfig = {
  frondCount: 10,
  colors: COLORS,
  hotspots: HOTSPOTS,
  faceOpacity: 0.87,
};
