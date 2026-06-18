// Hotspot overlays: a thin connector line from each coral hotspot dot to a real,
// accessible DOM label (drei <Html>). Hover on desktop, auto-cycle on touch,
// all labels shown when reduced-motion. Shares the palm's (rotating) space so
// lines/labels track their anchors. Per-hotspot labelOffset tidies placement.
import { useMemo } from 'react';
import { Line, Html } from '@react-three/drei';
import { buildPalm } from './layout';
import type { PalmConfig, Vec3 } from './config';

interface HotspotsProps {
  config: PalmConfig;
  activeId: string | null;
  onHover: (id: string | null) => void;
  showAll: boolean; // reduced-motion static pose: reveal every label
}

const LABEL_OUT = 0.6;

function labelPoint(anchor: Vec3, off?: { dx?: number; dy?: number; out?: number }): Vec3 {
  const [x, y, z] = anchor;
  const len = Math.hypot(x, z) || 1;
  const out = LABEL_OUT + (off?.out ?? 0);
  return [x + (x / len) * out + (off?.dx ?? 0), y + 0.28 + (off?.dy ?? 0), z + (z / len) * out];
}

export function Hotspots({ config, activeId, onHover, showAll }: HotspotsProps) {
  const { colors } = config;
  const model = useMemo(() => buildPalm(config), [config]);

  const items = useMemo(
    () =>
      config.hotspots.map((h) => {
        const anchor = model.anchorsById[h.id];
        return { ...h, anchor, label3: labelPoint(anchor, h.labelOffset) };
      }),
    [config.hotspots, model],
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
                  'outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B4A]',
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
