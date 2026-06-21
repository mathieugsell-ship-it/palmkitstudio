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
  /** Island translucency — slightly lower than the palm, but still solid land. */
  baseOpacity: number;
  /** Water translucency — lighter/airier than the land. */
  waterOpacity: number;
  /** Cruise-ship translucency — slightly hazy (distant on the horizon), but the
   *  crisp edges + dark waterline keep it legible. */
  shipOpacity: number;
  /** Gentle water ripple (the water blocks bob): vertical amplitude (world
   *  units), wave speed (rad/s), and spatial wavenumber (phase per unit). */
  rippleAmp: number;
  rippleSpeed: number;
  rippleK: number;
  /** Gentle idle motion of the longtail boat resting on the water (v36): a soft
   *  sine pitch (bow rise/dip) + slight roll (side rock) + tiny vertical bob.
   *  Low amplitude, slow, smooth; bobSpeed ≈ rippleSpeed so it floats roughly in
   *  rhythm with the waves. Delta/clock-driven (framerate-independent); paused
   *  offscreen with the rest of the live motion. */
  boatMotion: {
    pitchAmp: number; pitchSpeed: number; pitchPhase: number; // bow rise/dip (rad)
    rollAmp: number; rollSpeed: number; rollPhase: number; // side rock (rad)
    bobAmp: number; bobSpeed: number; bobPhase: number; // vertical bob (world units)
  };
  /** Gentle breeze sway of the palm FRONDS (v37): each frond rotates about the
   *  crown origin — a small horizontal fan sway + a small vertical tip nod —
   *  with a per-frond PHASE offset so the wind looks like it passes through. Very
   *  low amplitude, slow, sine-looped (a shimmer, not flapping). Trunk/crown stay
   *  still. Same delta/clock drive + offscreen pause as the boat. */
  frondMotion: {
    swayAmp: number; swaySpeed: number; // horizontal fan sway (rad)
    nodAmp: number; nodSpeed: number; // vertical tip nod (rad)
    phaseStep: number; // per-frond phase offset (rad) → wind ripples through
  };
  /** Barely-there idle of the DISTANT cruise ship (v38): a very slight, very slow
   *  vertical bob + a tiny roll, NO pitch (a big far liner barely moves, and
   *  distant motion looks exaggerated). Slower + a different phase than the boat
   *  so they're not in sync. Same delta/clock drive + offscreen pause. */
  shipMotion: {
    bobAmp: number; bobSpeed: number; bobPhase: number; // vertical bob (world units)
    rollAmp: number; rollSpeed: number; rollPhase: number; // tiny roll (rad)
  };
  /** Slow idle Y-rotation of the whole diorama. Off for now (static
   *  composition) — flip to true to re-enable; ripple/pulse stay independent. */
  idleRotation: boolean;
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
    boatBase: number; boatSpan: number; // longtail boat (builds with the water)
    pitonBase: number; pitonSpan: number; // karst pitons (rise with island/water)
    shipBase: number; shipSpan: number; // distant cruise ship (builds with water/pitons)
    rotateEaseIn: number; // glide idle rotation in after the build
    edgeBuildBoost: number; // over-drive on the construction edge colour (→ bloom glow)
    finalEdgeOpacity: number; // resting thin-white edge opacity
    constructionPointsAll: boolean; // points materialize for island/water too (faded out at rest)
  };
}

// World-space (x,z) offset applied to the ISLAND + PALM together (v41), pushing
// the central landmass+hero slightly BACK along the camera's view axis so it
// recedes and leaves more foreground water. The sea's OUTER edge is anchored to
// the origin (waterLayout islandRef), so only the island's footprint moves — the
// island/palm, the water's land-exclusion + wet-sand fringe, and the contact
// shadow all read this. δ≈1.3 along the view axis (-0.529,-0.848).
export const ISLAND_OFFSET: [number, number] = [-0.69, -1.1];

// Sober, cool-leaning palette (CLAUDE.md). No cream/beige in UI.
// "High-tech blueprint": sober solid faces, luminous TEAL wireframe + vertex
// field, CORAL hotspot accents so the 6 services stand out from the vertex set.
export const COLORS = {
  // PALETTE: "Golden-Hour Andaman" (Option B, v39) — warm, sun-bathed Phuket.
  // Vivid saturated turquoise water, golden sand, lush warm-green fronds, all
  // lifted a clear notch toward optimistic/vibrant while staying harmonious.
  // Two frond tiers, varied slightly per layer.
  frond: ['#55AA66', '#3E8B51'] as const, // lush warm tropical green (was muted #4E9A6B)
  // Two trunk tones, blended bottom→top.
  trunkBottom: '#815326',
  trunkTop: '#AB762E',
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
  sandHi: '#FBE3A0', // warm golden sand highlight (was grey-beige #EEE0C2)
  sandMain: '#F1CE78', // main golden beach sand
  sandLo: '#E0B25C', // deeper amber-gold sand
  earth1: '#9A8460', // earth/rock just under the sand (warmed golden-brown)
  earth2: '#836E4C', // deeper earth
  earth3: '#695638', // deepest core

  // Water (Option 1 "Bright turquoise") — echoes the teal accent but reads as
  // real translucent water. Editable; slight per-block jitter in layout.
  waterBody: '#15A8AE', // main water — vivid saturated turquoise (the #1 Phuket signal)
  waterDeep: '#0F808E', // deeper / far blocks — stays saturated deep teal (not grey)
  waterShallow: '#4FDAC6', // bright aqua shallows meeting the shore
  wetSand: '#E4C886', // wet-sand fringe at the waterline (golden sand, damp)

  // Sunrise atmosphere (Option A "Peach-gold"). Soft, recessed dawn — a DOM
  // gradient behind the canvas + a warm raking key light. Editable here.
  skyTop: '#FBFCFD', // near-white sky toward the top (kept airy)
  skyWarm: '#FFE6C2', // stronger golden dawn wash toward the bottom (sun-bathed)
  haloCore: '#FFF4E0', // warm near-white core of the sun glow
  haloMid: '#FFDCA6', // richer peach-gold mid of the halo, easing to transparent
  warmKey: '#FFE6C6', // warmer golden key-light (raking from the sun side)

  // Voxel LONGTAIL BOAT (v14) — Option B "rich mahogany" hull, with a tiny
  // authentic red/blue/pale ribbon accent at the prow. (Option A teak / C
  // driftwood hexes are in the reply if we want to switch back.)
  boatHull: '#8E5230', // main wood (warm teak-mahogany)
  boatHullDark: '#67391E', // lower planks / shadowed blocks
  boatTrim: '#B07A45', // gunwale / deck-rim highlight plank (warmer)
  boatEngine: '#3E342A', // engine + shaft + prop (dark, muted)
  ribbonRed: '#C8453A', // prow ribbon (authentic red)
  ribbonBlue: '#2F6FB0', // prow ribbon (authentic blue)
  ribbonPale: '#EDE3CC', // tiny pale flag at the very tip

  // Voxel KARST PITONS (v15) — Option A "warm limestone grey" (slightly beige so
  // it harmonizes with the sand, not cold-blue). Darker lower, lighter upper;
  // varied block-by-block. Green crown echoes the palm fronds.
  pitonHi: '#CDB892', // upper / lit rock — warm golden limestone (was cold grey)
  pitonMid: '#B0976E', // mid rock
  pitonLo: '#8B7051', // lower / shadowed rock near the water
  pitonCrown: ['#55AA66', '#3E8B51'] as const, // small green crown (matches the fronds)

  // Voxel SUN (v26) — Option A "golden core". A vivid golden-yellow core that
  // clearly stands out from the pale-peach dawn, easing to a softer warm rim.
  // (Options B/C in the reply.) Luminous but soft (no harsh bloom).
  sunCore: '#FFB733', // saturated golden core (warmer, sun-bathed dawn)
  sunMid: '#FFCB63', // golden amber toward the disc edge
  sunEdge: '#FFE0AE', // pale warm rim / rays
  sunHalo: '#FFD27A', // warm golden halo glow
  sunEdgeLine: '#FFEAD2', // (unused now — kept for config compatibility)

  // Voxel CRUISE SHIP (v34) — Option A "Warm cream + navy", with a gentle
  // atmospheric-DISTANCE treatment vs v33: the ship stays SOLID and readable, but
  // its starkest tone (the near-black navy base) is lifted to a softer slate-blue
  // so contrast eases at distance (atmospheric perspective = lower contrast +
  // shift toward the sky, NOT translucency). Cream hull + coral funnels keep it
  // legible against the turquoise water. (Options B/C in the reply to switch to.)
  shipHull: '#F6EFD9', // warm cream — main hull + lower superstructure (stays the light element)
  shipHullHi: '#FBF5E6', // upper decks (lighter cream)
  shipWaterline: '#235A66', // teal-navy base band — echoes the turquoise water
  shipDeckLine: '#6E8A90', // slate-teal window / deck-detail band (harmonises with the base)
  shipFunnel: '#FF6B4A', // warm coral funnel (brand accent — life)
  shipFunnelDark: '#C24A32', // funnel cap rim (darker coral)
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
  frondCount: 8,
  colors: COLORS,
  hotspots: HOTSPOTS,
  // Moderate opacity bump (v32): the scene had many overlapping translucent
  // faces + white edges reading as see-through mush. Faces are now more solid so
  // each object occludes more of what's behind it, while keeping a HINT of the
  // translucent voxel character (not fully opaque — room to fine-tune). Water is
  // left roughly as-is (adjusted separately later).
  faceOpacity: 0.96, // palm + boat (was 0.9)
  baseOpacity: 0.95, // island + pitons + wet-sand fringe (was 0.88)
  waterOpacity: 0.7, // water body — unchanged for now
  shipOpacity: 0.96, // cruise ship — solid + readable, with the faintest distance haze
  rippleAmp: 0.06, // subtle bob — blocks stay overlapped, never clip the sand
  rippleSpeed: 0.9, // slow, calm
  rippleK: 1.1, // wavelength of the travelling diagonal wave
  // Calm boat idle: barely-there pitch/roll + tiny bob, slow + incommensurate
  // periods so it loops naturally; bobSpeed = rippleSpeed (0.9) to float in
  // rhythm with the waves. Keep amplitudes tiny — a boat resting, not a storm.
  boatMotion: {
    pitchAmp: 0.026, pitchSpeed: 0.55, pitchPhase: 0.0, // ~1.5° bow rise/dip, ~11 s
    rollAmp: 0.022, rollSpeed: 0.45, rollPhase: 1.7, // ~1.3° side rock, ~14 s
    bobAmp: 0.016, bobSpeed: 0.9, bobPhase: 0.6, // tiny vertical bob, synced to ripple
  },
  // Calm frond breeze: tiny sway/nod, slow, with a per-frond phase so the wind
  // ripples through the crown rather than every frond moving in lockstep.
  frondMotion: {
    swayAmp: 0.05, swaySpeed: 0.7, // ~2.9° horizontal fan, ~9 s
    nodAmp: 0.04, nodSpeed: 0.9, // ~2.3° vertical tip nod, ~7 s
    phaseStep: 0.9, // each frond offset by ~0.9 rad
  },
  // Distant liner: barely moves. A whisper of bob + a hint of roll, NO pitch,
  // slower than the boat and on its own phase so the two aren't in sync.
  shipMotion: {
    bobAmp: 0.01, bobSpeed: 0.42, bobPhase: 2.4, // tiny slow swell rise/settle, ~15 s
    rollAmp: 0.006, rollSpeed: 0.34, rollPhase: 3.5, // ~0.34° roll, ~18 s
  },
  idleRotation: false, // paused for composition; re-enable later
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
    boatBase: 0.62, boatSpan: 0.28,
    pitonBase: 0.5, pitonSpan: 0.34,
    shipBase: 0.52, shipSpan: 0.32, // distant cruise ship rises with the pitons
    rotateEaseIn: 0.6,
    edgeBuildBoost: 2.0,
    finalEdgeOpacity: 0.85,
    constructionPointsAll: true,
  },
};
