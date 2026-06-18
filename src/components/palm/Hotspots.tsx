// Hotspot overlays: a thin connector line from each glowing dot to a real,
// accessible DOM label (drei <Html>). Hover on desktop, auto-cycle on touch,
// all labels shown when reduced-motion. Lives in the same (rotating) group as
// the dots so lines/labels track their anchors.
import { useMemo } from 'react';
import { Line, Html } from '@react-three/drei';
import { buildFronds, resolveAnchor } from './layout';
import type { PalmConfig, Vec3 } from './config';

interface HotspotsProps {
  config: PalmConfig;
  activeId: string | null;
  onHover: (id: string | null) => void;
  showAll: boolean; // reduced-motion static pose: reveal every label
}

const LABEL_OFFSET = 0.55;

function labelPoint(anchor: Vec3): Vec3 {
  const [x, y, z] = anchor;
  const len = Math.hypot(x, z) || 1;
  return [x + (x / len) * LABEL_OFFSET, y + 0.28, z + (z / len) * LABEL_OFFSET];
}

export function Hotspots({ config, activeId, onHover, showAll }: HotspotsProps) {
  const { colors } = config;
  const fronds = useMemo(() => buildFronds(config.frondCount), [config.frondCount]);

  const items = useMemo(
    () =>
      config.hotspots.map((h) => {
        const anchor = resolveAnchor(h.anchor, fronds);
        return { ...h, anchor, label3: labelPoint(anchor) };
      }),
    [config.hotspots, fronds],
  );

  return (
    <>
      {items.map((it) => {
        const visible = showAll || activeId === it.id;
        return (
          <group key={it.id}>
            {visible && (
              <Line
                points={[it.anchor, it.label3]}
                color={colors.connector}
                lineWidth={1.6}
                transparent
                opacity={0.9}
              />
            )}
            <Html
              position={it.label3}
              center
              // Wrapper must not steal raycasts from the dots behind it.
              style={{ pointerEvents: 'none' }}
              zIndexRange={[20, 0]}
            >
              <button
                type="button"
                aria-label={`${it.label}: ${it.blurb}`}
                onFocus={() => onHover(it.id)}
                onBlur={() => onHover(null)}
                onClick={() => onHover(activeId === it.id ? null : it.id)}
                className={[
                  'pointer-events-auto select-none whitespace-nowrap rounded-md',
                  'border border-black/5 bg-white/95 px-2.5 py-1.5 text-left shadow-sm',
                  'shadow-black/5 backdrop-blur-sm transition-opacity duration-200',
                  'outline-none focus-visible:ring-2 focus-visible:ring-[#5FE3D6]',
                  visible ? 'opacity-100' : 'opacity-0 focus-visible:opacity-100',
                ].join(' ')}
                style={{ borderLeft: `2px solid ${colors.connector}` }}
              >
                <span
                  className="block text-[13px] font-semibold leading-tight"
                  style={{ color: colors.ink }}
                >
                  {it.label}
                </span>
                <span className="block text-[11px] leading-tight text-neutral-500">
                  {it.blurb}
                </span>
              </button>
            </Html>
          </group>
        );
      })}
    </>
  );
}
