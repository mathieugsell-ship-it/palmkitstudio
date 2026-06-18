# CLAUDE.md — Palmkit Studio

Project memory for Claude Code. Keep this file short and authoritative. Read it before every task.

## What this project is
The website for **Palmkit Studio** (palmkitstudio.com) — a web/digital/AI studio. We are building it in tightly-scoped steps. **Right now we are ONLY building the hero 3D palm tree component. Nothing else.**

## Current scope — STEP 1 (the ONLY thing to build now)
A single, self-contained **interactive 3D voxel palm tree** hero component (React Three Fiber), mounted on one demo page. 

**YOU MUST NOT**, in this step:
- scaffold site pages, routing, navigation, footer, content sections, or a design system
- add a CMS, i18n, blog, or any page other than the single demo page that mounts the palm
- add dependencies beyond those listed below without asking first
- edit or create files outside the palm component, its demo page, and config needed to run it

If you think something outside this scope is needed, **ask first**.

## Tech stack (pinned — confirm a mutually-compatible set on install)
- **Astro** (latest) + **React** integration (`@astrojs/react`)
- **three**, **@react-three/fiber** (R3F v9 line), **@react-three/drei** (v10 line, pairs with R3F v9), **@react-three/postprocessing**
- **Tailwind CSS** (for the label styling only at this stage)
- Output: **static** (`output: 'static'`). NO Cloudflare adapter, NO SSR (this is a static site deployed on Cloudflare Pages).
- Node 20+.
- Pin the versions you install in package.json and confirm the R3F v9 / React / drei v10 / three matrix is compatible before coding (this matrix has known breaking peer-dep interactions).

## Deployment
GitHub-connected repo, auto-deploys to **Cloudflare Pages**. Build command `npm run build`, output dir `dist`. Keep the build static and edge-friendly.

## Mandatory workflow
1. **Plan first.** Propose a step-by-step plan and STOP. Do not write code until I approve.
2. After approval, implement.
3. **Verify visually:** run the dev server, take a screenshot of the canvas, compare it to the reference image + the aesthetic below, list the differences, and iterate. Expect 2–3 iterations.
4. Only touch the palm component file(s). Commit in small steps.

## AESTHETIC (the palm tree) — avoid generic "AI slop"
- **Style:** stylized **voxel / low-poly palm — "Minecraft but slimmer and finer"** than the reference image. Blocky, faceted, charming, but more elegant and elongated than the chunky reference.
- **Look per shape (three layers):** solid soft faces (`flatShading`) **+** thin visible edge lines (drei `<Edges threshold={15}>`) **+** small glowing dots at the vertices/corners (emissive material, selective bloom).
- **Trunk:** stacked tapered segments, **slightly curved/arced** (not a stiff vertical pole), thinner than the reference.
- **Fronds:** 6–9 slim elongated fronds radiating from the crown, drooping gently. Slimmer than the reference's chunky leaves.
- **Background:** **pure white** `#FFFFFF` (NOT the dark/sand scene in the reference — the reference is for shape/voxel-style only).
- **Shadow:** subtle soft contact shadow on the white ground (drei `<ContactShadows>`), not harsh.
- **Lighting:** soft, layered (low ambient + one soft directional key + optional dim fill). No harsh contrast. Premium and clean.
- **Motion:** slow idle Y-rotation, framerate-independent (delta-based). Pause when offscreen/tab hidden.
- **Colors (sober, cool-leaning — NO cream/beige in UI; sandy tones only inside the model if needed):**
  - Fronds: soft muted greens, e.g. `#4E9A6B` / `#3E7E57` (vary slightly per frond layer)
  - Trunk: soft muted brown-taupe, e.g. `#9A8466` / `#7E6A50`
  - Edge lines: a darker tint of each shape's color (thin, subtle), e.g. trunk edges `#5C4E3A`, frond edges `#2E5A40`
  - Glowing vertex dots: soft luminous teal/aqua `#5FE3D6` (the brand accent), emissive
  - Hotspot connector lines + label accents: same teal `#5FE3D6` or a warm coral `#FF6B4A` — pick the one that reads best on white (use ink text on any coral fill for contrast)
- **AVOID:** Inter/Roboto/Arial fonts, purple gradients, three-card layouts, harsh shadows, neon-cyberpunk overload, washed-out ACES desaturation. Think clean, warm, premium, "smart toolbox under the palms."

## Hotspots (services)
On hover (desktop): a thin line extends from a glowing vertex dot to a small text label. On touch/mobile (no hover): auto-cycle through the hotspots one at a time. Labels are **real accessible DOM text** (drei `<Html>`), keyboard-focusable, high-contrast. Six services:
**Websites · SEO · E-commerce · AI · Strategy · Brand**

## Accessibility & performance (non-negotiable)
- `prefers-reduced-motion`: stop rotation + auto-cycle + bloom; render a static, fully-labeled pose.
- Labels: real text, high contrast (≥4.5:1), focusable, ARIA-labeled.
- WebGL-unavailable fallback (Canvas `fallback`), plus a poster image option for low-power devices.
- `dpr={[1,2]}`; pause render loop offscreen/hidden; dispose geometry/materials on unmount; memoize geometry/materials.
- Keep the 3D in ONE React island, mounted `client:only="react"`. Don't block LCP.

## Expandability (structure, don't build)
Make frond count, hotspot labels, and colors into props/config; export the palm group cleanly so the rest of the site can import it later. But do NOT build the rest of the site now.
