// HeroExperience — the single client:only island for STEP 8. Owns the shared
// state (`selected` = expanded service, `hovered` = preview) and wires the scene
// to the services UI directly. The full-bleed <Canvas> is portalled into the
// Astro-rendered #scene-root (so it fills the whole hero), while the services
// overlay renders inline inside the max-width content column next to the static
// headline/CTA.
import { useCallback, useEffect, useState } from 'react';
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

  // Clicking the active node/service again toggles it closed; null always closes.
  const handleSelect = useCallback((id: string | null) => {
    setSelected((cur) => (id !== null && cur === id ? null : id));
  }, []);
  const handleHover = useCallback((id: string | null) => setHovered(id), []);
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
    />
  );

  return (
    <>
      {sceneRoot ? createPortal(canvas, sceneRoot) : null}
      <ServicesOverlay
        config={config}
        selected={selected}
        hovered={hovered}
        onSelect={handleSelect}
        onHover={handleHover}
        onClose={close}
      />
    </>
  );
}
