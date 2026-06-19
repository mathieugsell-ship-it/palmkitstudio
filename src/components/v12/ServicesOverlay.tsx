// ServicesOverlay — the DOM half of the service map (STEP 8). Lives in the same
// React island as the scene, so it shares `selected`/`hovered` directly (no
// event bus). It cross-fades between the OVERVIEW (6 service buttons) and the
// DETAIL panel (title + long description + Back + contextual CTA). Real,
// focusable, high-contrast text — works even if WebGL fails.
import { useEffect, useRef, useState } from 'react';
import type { PalmConfig } from './config';

interface Props {
  config: PalmConfig;
  selected: string | null;
  hovered: string | null;
  onSelect: (id: string | null) => void;
  onHover: (id: string | null) => void;
  onClose: () => void;
}

export default function ServicesOverlay({ config, selected, hovered, onSelect, onHover, onClose }: Props) {
  const services = config.hotspots;
  const expanded = selected !== null;

  // Keep the last opened id so the detail content stays put while it fades out.
  const [lastId, setLastId] = useState<string>(services[0].id);
  useEffect(() => {
    if (selected) setLastId(selected);
  }, [selected]);
  const detail = services.find((s) => s.id === (selected ?? lastId)) ?? services[0];

  // Focus management: into the detail on open, back to the service on close.
  const titleRef = useRef<HTMLHeadingElement>(null);
  const btnRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const prevExpanded = useRef(false);
  useEffect(() => {
    if (expanded && !prevExpanded.current) titleRef.current?.focus();
    else if (!expanded && prevExpanded.current) btnRefs.current[lastId]?.focus();
    prevExpanded.current = expanded;
  }, [expanded, lastId]);

  return (
    <nav className="services-area text-scrim" aria-label="Our services">
      {/* OVERVIEW */}
      <div className="ov" data-active={!expanded} inert={expanded} aria-hidden={expanded}>
        <p className="services-kicker">What we do</p>
        <ul className="services">
          {services.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                className="service"
                data-hot={hovered === s.id}
                ref={(el) => {
                  btnRefs.current[s.id] = el;
                }}
                onMouseEnter={() => onHover(s.id)}
                onMouseLeave={() => onHover(null)}
                onFocus={() => onHover(s.id)}
                onBlur={() => onHover(null)}
                onClick={() => onSelect(s.id)}
              >
                <span className="dot" aria-hidden="true" />
                <span className="service-text">
                  <span className="label">{s.label}</span>
                  <span className="blurb">{s.blurb}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        <p className="hint" aria-hidden="true">
          <span className="hint-dot" /> Click a point to explore
        </p>
      </div>

      {/* DETAIL */}
      <div
        className="dt"
        data-active={expanded}
        inert={!expanded}
        aria-hidden={!expanded}
        role="region"
        aria-labelledby="dt-title"
      >
        <button type="button" className="back" onClick={onClose}>
          <span aria-hidden="true">←</span> All services
        </button>
        <h2 id="dt-title" className="dt-title" tabIndex={-1} ref={titleRef}>
          {detail.label}
        </h2>
        <p className="dt-desc">{detail.detail}</p>
        <a className="cta cta-sm" href="#offers">
          See our offers
        </a>
      </div>
    </nav>
  );
}
