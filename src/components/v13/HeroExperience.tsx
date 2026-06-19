// HeroExperience — the single client:only island (STEP 9). Owns the shared
// state (`selected` = expanded service, `hovered` = preview, `hasInteracted` for
// the hint) and wires the scene to the blueprint services UI directly. The
// full-bleed <Canvas> is portalled into #scene-root; the services overlay and a
// fixed SVG connector + hover-label chip render next to the static headline/CTA.
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import SceneCanvas from './SceneCanvas';
import ServicesOverlay from './ServicesOverlay';
import { DEFAULT_CONFIG, type PalmConfig } from './config';

function useMediaQuery(query: string): boolean {
  const [match, setMatch] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatch(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return match;
}

export default function HeroExperience({ config = DEFAULT_CONFIG }: { config?: PalmConfig }) {
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const noHover = useMediaQuery('(hover: none)');
  const mobile = useMediaQuery('(max-width: 1023px)');

  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [hasInteracted, setHasInteracted] = useState(false);

  // Clicking the active node/service again toggles it closed; null always closes.
  const handleSelect = useCallback((id: string | null) => {
    if (id !== null) setHasInteracted(true);
    setSelected((cur) => (id !== null && cur === id ? null : id));
  }, []);
  const handleHover = useCallback((id: string | null) => {
    if (id !== null) setHasInteracted(true);
    setHovered(id);
  }, []);
  const close = useCallback(() => setSelected(null), []);

  // Esc closes the expanded service.
  useEffect(() => {
    if (selected === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelected(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected]);

  // Refs shared between the scene (projection) and the DOM overlay (connector +
  // hover label). The scene writes screen coords imperatively each frame; the
  // overlay reports where the detail panel connects.
  const connectorRef = useRef<SVGLineElement | null>(null);
  const labelRef = useRef<HTMLDivElement | null>(null);
  const panelAnchorRef = useRef<{ x: number; y: number } | null>(null);

  const hoveredLabel = config.hotspots.find((h) => h.id === hovered)?.label ?? '';
  const showLabel = !mobile && hovered !== null && selected === null;

  // Portal target for the full-bleed canvas (rendered empty by Astro in the hero).
  const [sceneRoot, setSceneRoot] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setSceneRoot(document.getElementById('scene-root'));
  }, []);

  const canvas = (
    <SceneCanvas
      config={config}
      reducedMotion={reducedMotion}
      noHover={noHover}
      mobile={mobile}
      selected={selected}
      hovered={hovered}
      onSelect={handleSelect}
      onHover={handleHover}
      connectorRef={connectorRef}
      labelRef={labelRef}
      panelAnchorRef={panelAnchorRef}
    />
  );

  return (
    <>
      {sceneRoot ? createPortal(canvas, sceneRoot) : null}

      {/* Connector line (desktop): drawn from the clicked point to the panel.
          Positioned imperatively by the scene's projector; hidden otherwise. */}
      {!mobile && (
        <svg className="connector" aria-hidden="true">
          <line ref={connectorRef} className="connector-line" x1="0" y1="0" x2="0" y2="0" />
        </svg>
      )}

      {/* Floating blueprint label chip near the hovered point (desktop). */}
      {!mobile && (
        <div ref={labelRef} className="node-label" data-show={showLabel} aria-hidden="true">
          <span className="node-label-dot" /> {hoveredLabel}
        </div>
      )}

      <ServicesOverlay
        config={config}
        selected={selected}
        hovered={hovered}
        onSelect={handleSelect}
        onHover={handleHover}
        onClose={close}
        hasInteracted={hasInteracted}
        panelAnchorRef={panelAnchorRef}
      />
    </>
  );
}
