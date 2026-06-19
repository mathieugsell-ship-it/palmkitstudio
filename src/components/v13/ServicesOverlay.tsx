// ServicesOverlay — the DOM half of the service map, restyled into the palm's
// blueprint/holographic language (STEP 9). Overview = holographic cards (luminous
// teal edges, voxel corner brackets, a teal node dot). Detail = a larger panel
// whose frame TRACES in (SVG stroke-dashoffset, echoing the palm edges) before
// the frosted fill + content settle. Real focusable buttons; Back + ✕ + Esc to
// close. Reports its panel anchor so the scene can draw the connector to it.
import { useEffect, useRef, useState } from 'react';
import type { PalmConfig } from './config';

interface Props {
  config: PalmConfig;
  selected: string | null;
  hovered: string | null;
  onSelect: (id: string | null) => void;
  onHover: (id: string | null) => void;
  onClose: () => void;
  hasInteracted: boolean;
  panelAnchorRef: React.MutableRefObject<{ x: number; y: number } | null>;
}

export default function ServicesOverlay({
  config,
  selected,
  hovered,
  onSelect,
  onHover,
  onClose,
  hasInteracted,
  panelAnchorRef,
}: Props) {
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

  // Report the detail panel's left-edge midpoint (viewport px) so the scene can
  // aim the connector line at it. Update on open + on resize.
  const dtRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const update = () => {
      const el = dtRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      panelAnchorRef.current = { x: r.left, y: r.top + r.height / 2 };
    };
    const id = requestAnimationFrame(update); // after layout settles
    window.addEventListener('resize', update);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener('resize', update);
    };
  }, [expanded, panelAnchorRef]);

  return (
    <nav className="services-area" aria-label="Our services">
      {/* OVERVIEW — holographic cards */}
      <div className="ov" data-active={!expanded} inert={expanded} aria-hidden={expanded}>
        <p className="services-kicker">What we do</p>
        <ul className="services">
          {services.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                className="service bp-card"
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
                <span className="bp-corner bp-tl" aria-hidden="true" />
                <span className="bp-corner bp-br" aria-hidden="true" />
                <span className="bp-node" aria-hidden="true" />
                <span className="service-text">
                  <span className="label">{s.label}</span>
                  <span className="blurb">{s.blurb}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        <p className="hint" data-fade={hasInteracted} aria-hidden="true">
          <span className="hint-dot" /> Click a point to explore
        </p>
      </div>

      {/* DETAIL — blueprint panel that traces itself in */}
      <div
        className="dt bp-panel"
        ref={dtRef}
        data-active={expanded}
        inert={!expanded}
        aria-hidden={!expanded}
        role="region"
        aria-labelledby="dt-title"
      >
        <span className="bp-fill" aria-hidden="true" />
        <svg className="bp-frame" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <rect
            className="bp-frame-rect"
            x="0.6"
            y="0.6"
            width="98.8"
            height="98.8"
            rx="2.4"
            pathLength="1"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <span className="bp-corner bp-tl" aria-hidden="true" />
        <span className="bp-corner bp-tr" aria-hidden="true" />
        <span className="bp-corner bp-bl" aria-hidden="true" />
        <span className="bp-corner bp-br" aria-hidden="true" />

        <div className="dt-inner">
          <div className="dt-head">
            <button type="button" className="back" onClick={onClose}>
              <span aria-hidden="true">←</span> All services
            </button>
            <button type="button" className="dt-close" onClick={onClose} aria-label="Close service details">
              <span aria-hidden="true">✕</span>
            </button>
          </div>
          <h2 id="dt-title" className="dt-title" tabIndex={-1} ref={titleRef}>
            <span className="bp-node dt-node" aria-hidden="true" />
            {detail.label}
          </h2>
          <p className="dt-desc">{detail.detail}</p>
          <a className="cta cta-sm" href="#offers">
            See our offers
          </a>
        </div>
      </div>
    </nav>
  );
}
