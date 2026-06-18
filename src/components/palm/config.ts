// Palmkit Studio — STEP 1 palm configuration.
// Everything tunable lives here so frond count, colors and hotspot labels are
// props/config (CLAUDE.md: expandability — structure, don't build the site).

export type Vec3 = [number, number, number];

/** Where a hotspot's glowing dot is anchored on the model. */
export type AnchorKind =
  | { type: 'frondTip'; frond: number } // tip of frond N
  | { type: 'crown' } // apex above the crown
  | { type: 'trunk'; t: number }; // point along the trunk arc (0 base .. 1 top)

export interface HotspotConfig {
  id: string;
  label: string;
  /** Short supporting line shown under the label. */
  blurb: string;
  anchor: AnchorKind;
}

export interface PalmConfig {
  frondCount: number;
  colors: typeof COLORS;
  hotspots: HotspotConfig[];
}

// Sober, cool-leaning palette (CLAUDE.md). No cream/beige in UI.
export const COLORS = {
  // Two frond tiers, varied slightly per layer.
  frond: ['#4E9A6B', '#3E7E57'] as const,
  frondEdge: '#2E5A40',
  // Two trunk tones, blended bottom→top.
  trunkBottom: '#7E6A50',
  trunkTop: '#9A8466',
  trunkEdge: '#5C4E3A',
  // Brand accent — the glowing vertex dots + connectors.
  dot: '#5FE3D6',
  connector: '#5FE3D6',
  ink: '#1C2B26', // high-contrast label text on white
};

// Six services. Anchors are intentional and legible: four frond tips spread
// around the crown, the crown apex, and one point up the trunk arc — NOT a dot
// on every vertex.
export const HOTSPOTS: HotspotConfig[] = [
  { id: 'websites', label: 'Websites', blurb: 'Fast, modern sites', anchor: { type: 'frondTip', frond: 0 } },
  { id: 'seo', label: 'SEO', blurb: 'Found on search', anchor: { type: 'frondTip', frond: 2 } },
  { id: 'ecommerce', label: 'E-commerce', blurb: 'Stores that sell', anchor: { type: 'frondTip', frond: 4 } },
  { id: 'ai', label: 'AI', blurb: 'Smart automation', anchor: { type: 'crown' } },
  { id: 'strategy', label: 'Strategy', blurb: 'Clear direction', anchor: { type: 'trunk', t: 0.62 } },
  { id: 'brand', label: 'Brand', blurb: 'Identity & design', anchor: { type: 'frondTip', frond: 6 } },
];

export const DEFAULT_CONFIG: PalmConfig = {
  frondCount: 8,
  colors: COLORS,
  hotspots: HOTSPOTS,
};
