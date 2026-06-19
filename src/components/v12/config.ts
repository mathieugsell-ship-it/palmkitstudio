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
  /** Short supporting line shown under the label in the overview list. */
  blurb: string;
  /** Long explanation shown in the expanded detail panel (STEP 8). */
  detail: string;
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
  /** Island translucency — slightly lower than the palm, but still solid land. */
  baseOpacity: number;
  /** Water translucency — lighter/airier than the land. */
  waterOpacity: number;
  /** Gentle water ripple (the water blocks bob): vertical amplitude (world
   *  units), wave speed (rad/s), and spatial wavenumber (phase per unit). */
  rippleAmp: number;
  rippleSpeed: number;
  rippleK: number;
  /** Full-scene "construction" build-in (one normalized 0→1 timeline): the
   *  whole island→palm→water world draws itself as glowing wireframe, faces
   *  fill, then a top→bottom sweep crystallizes the edges to thin white. */
  build: {
    duration: number; // total seconds
    // Phase windows on the 0→1 master timeline.
    ptsStart: number; ptsEnd: number; // points materialize (cascade order)
    edgStart: number; edgEnd: number; // glowing-blue edges trace
    facStart: number; facEnd: number; // translucent faces fill in
    setStart: number; setEnd: number; // settle sweep: edges blue→white (top→bottom)
    revealWin: number; faceWin: number; setWin: number; // per-element fade windows
    // Group cascade island→palm→water along the construction-order axis.
    islandBase: number; islandSpan: number;
    palmBase: number; palmSpan: number;
    waterBase: number; waterSpan: number;
    rotateEaseIn: number; // glide idle rotation in after the build
    edgeBuildBoost: number; // over-drive on the construction edge colour (→ bloom glow)
    finalEdgeOpacity: number; // resting thin-white edge opacity
    constructionPointsAll: boolean; // points materialize for island/water too (faded out at rest)
  };
}

// Sober, cool-leaning palette (CLAUDE.md). No cream/beige in UI.
// "High-tech blueprint": sober solid faces, luminous TEAL wireframe + vertex
// field, CORAL hotspot accents so the 6 services stand out from the vertex set.
export const COLORS = {
  // Two frond tiers, varied slightly per layer.
  frond: ['#4E9A6B', '#3E7E57'] as const,
  // Two trunk tones, blended bottom→top.
  trunkBottom: '#7C5A30',
  trunkTop: '#9A6F3C',
  // Luminous construction layers.
  edge: '#5FE3D6', // (legacy) glowing wireframe edges — superseded below on v9
  vertex: '#5FE3D6', // glowing vertex points (the full field)
  // v9 edge transition: glowing blue-teal while CONSTRUCTING → thin cool
  // grey-white at REST (reads on pale sand + dawn without disappearing).
  edgeBuild: '#5FE3D6',
  edgeFinal: '#D7E2E6',
  // Hotspot accent — warm, distinct from the teal vertex field.
  hotspot: '#FF6B4A',
  connector: '#FF6B4A',
  ink: '#1C2B26', // high-contrast label text on white

  // Island base — light natural beach sand (warm decor is allowed) + a muted
  // recessive earthy underside. Editable here; slight per-block jitter in layout.
  sandHi: '#EEE0C2', // top-highlight sand (domed centre / upper blocks)
  sandMain: '#E5D5AE', // main beach sand
  sandLo: '#D8C49A', // lower sand blocks (subtle variation)
  earth1: '#8A7E70', // earth/rock just under the sand
  earth2: '#7A6F62', // deeper earth
  earth3: '#665C51', // deepest core

  // Water (Option 1 "Bright turquoise") — echoes the teal accent but reads as
  // real translucent water. Editable; slight per-block jitter in layout.
  waterBody: '#1FA6B6', // main water (saturated turquoise — survives bloom wash)
  waterDeep: '#14869C', // deeper / outer blocks
  waterShallow: '#56C7D1', // bright shallow ring meeting the shore
  wetSand: '#BBAE8C', // wet-sand fringe at the waterline (island sand, darkened)

  // Sunrise atmosphere (Option A "Peach-gold"). Soft, recessed dawn — a DOM
  // gradient behind the canvas + a warm raking key light. Editable here.
  skyTop: '#FBFCFD', // near-white sky toward the top
  skyWarm: '#FFF1E2', // gentle warm wash toward the bottom
  haloCore: '#FFF4E2', // warm near-white core of the sun glow
  haloMid: '#FFE3C4', // peach/gold mid of the halo, easing to transparent
  warmKey: '#FFE9D2', // warm key-light colour (raking from the sun side)
};

// Six services (STEP 7 hybrid hero). Each maps to a reserved hotspot anchor on
// the palm — spread across 4 frond tips + the crown apex + a trunk node — so the
// left-column list and the 3D object are visibly linked on hover/focus. Labels
// are real accessible DOM text in the Astro page; these drive the node mapping.
export const HOTSPOTS: HotspotConfig[] = [
  {
    id: 'websites',
    label: 'Websites',
    blurb: 'Fast, modern sites',
    detail:
      'Fast, modern sites that look premium and load instantly. Built to convert visitors into customers, fully managed, and ready to grow with you.',
    anchor: { type: 'frondTip', frond: 0 },
  },
  {
    id: 'local-seo',
    label: 'Local SEO',
    blurb: 'Found by nearby customers',
    detail:
      'Get found by the people searching near you. We optimize your Google presence and local listings so your business shows up first when it matters.',
    anchor: { type: 'frondTip', frond: 2 },
  },
  {
    id: 'growth',
    label: 'Growth',
    blurb: 'More reach, more leads',
    detail:
      'More reach, more leads, less guesswork. Data-driven campaigns and content that bring the right customers to your door.',
    anchor: { type: 'frondTip', frond: 4 },
  },
  {
    id: 'ai-automation',
    label: 'AI Automation',
    blurb: 'Smart, time-saving workflows',
    detail:
      'Smart workflows that save you hours every week. From booking to follow-ups, we automate the repetitive so you focus on your business.',
    anchor: { type: 'crown' },
  },
  {
    id: 'ecommerce',
    label: 'E-commerce',
    blurb: 'Stores that sell',
    detail:
      'Online stores that actually sell. Smooth, mobile-first shopping experiences with payments and logistics handled end to end.',
    anchor: { type: 'frondTip', frond: 6 },
  },
  {
    id: 'brand',
    label: 'Brand',
    blurb: 'Identity & design',
    detail:
      'A clear, memorable identity that sets you apart. Logo, visuals and voice that make your business look as good as it is.',
    anchor: { type: 'trunk', t: 0.55 },
  },
];

export const DEFAULT_CONFIG: PalmConfig = {
  frondCount: 8,
  colors: COLORS,
  hotspots: HOTSPOTS,
  faceOpacity: 0.9,
  baseOpacity: 0.88,
  waterOpacity: 0.7,
  rippleAmp: 0.06, // subtle bob — blocks stay overlapped, never clip the sand
  rippleSpeed: 0.9, // slow, calm
  rippleK: 1.1, // wavelength of the travelling diagonal wave
  build: {
    duration: 3.2,
    // Construction: points 0→0.42, glowing-blue edges 0.10→0.52 (cascade
    // island→palm→water, bottom-to-top). Faces fill 0.48→0.70. Settle sweep
    // (blue→white, top→bottom) 0.70→0.95. Rest after.
    ptsStart: 0.0, ptsEnd: 0.42,
    edgStart: 0.1, edgEnd: 0.52,
    facStart: 0.48, facEnd: 0.7,
    setStart: 0.7, setEnd: 0.95,
    revealWin: 0.1, faceWin: 0.12, setWin: 0.12,
    islandBase: 0.0, islandSpan: 0.34,
    palmBase: 0.26, palmSpan: 0.42,
    waterBase: 0.6, waterSpan: 0.3,
    rotateEaseIn: 0.6,
    edgeBuildBoost: 2.0,
    finalEdgeOpacity: 0.85,
    constructionPointsAll: true,
  },
};
