"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { niceTicks } from "@/lib/body/trend";

export type ChartPoint = { date: string; value: number };

const HEIGHT = 200;
const PAD = { top: 12, right: 12, bottom: 28, left: 44 };

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

const shortDate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
};
const longDate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
};

/**
 * Single-series trend line (one hue, so no legend box: the card title names it). Values are
 * already in display units. Crosshair + tooltip on hover/touch and on keyboard (arrow keys).
 * The accompanying table carries every value, so the tooltip never gates information.
 */
export function TrendChart({
  points,
  unit,
  decimals = 1,
  label,
}: {
  points: ChartPoint[];
  unit: string;
  decimals?: number;
  /** Accessible summary, e.g. "Body weight, 12 weigh-ins from Oct 1 to Oct 28, 82.5 to 80.4 kg". */
  label: string;
}) {
  const [wrapRef, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const tipId = useId();

  const geo = useMemo(() => {
    if (!points.length || width < 100) return null;
    const values = points.map((p) => p.value);
    const ticks = niceTicks(Math.min(...values), Math.max(...values), 4);
    const yMin = ticks[0];
    const yMax = ticks[ticks.length - 1];
    const t0 = Date.parse(points[0].date);
    const t1 = Date.parse(points[points.length - 1].date);
    const innerW = width - PAD.left - PAD.right;
    const innerH = HEIGHT - PAD.top - PAD.bottom;
    const x = (iso: string) => (t1 === t0 ? PAD.left + innerW / 2 : PAD.left + ((Date.parse(iso) - t0) / (t1 - t0)) * innerW);
    const y = (v: number) => PAD.top + (1 - (v - yMin) / (yMax - yMin || 1)) * innerH;
    const xy = points.map((p) => ({ ...p, cx: x(p.date), cy: y(p.value) }));
    const path = xy.map((p, i) => `${i ? "L" : "M"}${p.cx.toFixed(1)},${p.cy.toFixed(1)}`).join("");
    return { ticks, xy, path, y, innerW };
  }, [points, width]);

  const fmt = (v: number) => `${v.toLocaleString(undefined, { maximumFractionDigits: decimals, minimumFractionDigits: 0 })} ${unit}`;

  function nearest(clientX: number, rect: DOMRect) {
    if (!geo) return null;
    const px = clientX - rect.left;
    let best = 0;
    for (let i = 1; i < geo.xy.length; i++) if (Math.abs(geo.xy[i].cx - px) < Math.abs(geo.xy[best].cx - px)) best = i;
    return best;
  }

  function onPointer(e: PointerEvent<SVGSVGElement>) {
    setActive(nearest(e.clientX, e.currentTarget.getBoundingClientRect()));
  }

  function onKey(e: KeyboardEvent<SVGSVGElement>) {
    if (!geo) return;
    const last = geo.xy.length - 1;
    const map: Record<string, number> = { ArrowLeft: (active ?? last + 1) - 1, ArrowRight: (active ?? -1) + 1, Home: 0, End: last };
    if (!(e.key in map)) return;
    e.preventDefault();
    setActive(Math.max(0, Math.min(last, map[e.key])));
  }

  const a = geo && active != null ? geo.xy[active] : null;
  const labelIdx = geo ? Array.from(new Set([0, Math.floor((geo.xy.length - 1) / 2), geo.xy.length - 1])) : [];

  return (
    <div ref={wrapRef} className="relative w-full">
      {geo && (
        <svg
          width={width}
          height={HEIGHT}
          role="img"
          aria-label={`${label}. Use left and right arrow keys to read values; all values are also in the table below.`}
          aria-describedby={a ? tipId : undefined}
          tabIndex={0}
          onPointerMove={onPointer}
          onPointerDown={onPointer}
          onPointerLeave={() => setActive(null)}
          onKeyDown={onKey}
          onBlur={() => setActive(null)}
          className="block touch-pan-y rounded-lg"
        >
          {/* Recessive hairline grid + y ticks */}
          {geo.ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={width - PAD.right} y1={geo.y(t)} y2={geo.y(t)} stroke="var(--border)" strokeWidth={1} />
              <text x={PAD.left - 8} y={geo.y(t)} dy="0.32em" textAnchor="end" className="fill-muted text-[11px] tabular-nums">
                {t.toLocaleString(undefined, { maximumFractionDigits: 1 })}
              </text>
            </g>
          ))}
          {/* Sparse x labels: first, middle, last */}
          {labelIdx.map((i) => (
            <text
              key={i}
              x={geo.xy[i].cx}
              y={HEIGHT - 8}
              textAnchor={i === 0 ? "start" : i === geo.xy.length - 1 ? "end" : "middle"}
              className="fill-muted text-[11px]"
            >
              {shortDate(geo.xy[i].date)}
            </text>
          ))}

          {/* Soft area wash under the line */}
          {geo.xy.length > 1 && (
            <path
              d={`${geo.path}L${geo.xy[geo.xy.length - 1].cx},${HEIGHT - PAD.bottom}L${geo.xy[0].cx},${HEIGHT - PAD.bottom}Z`}
              fill="var(--chart-1)"
              opacity={0.1}
            />
          )}
          <path d={geo.path} fill="none" stroke="var(--chart-1)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

          {/* Markers only when sparse enough to read; always the last point */}
          {geo.xy.map((p, i) =>
            geo.xy.length <= 40 || i === geo.xy.length - 1 ? (
              <circle key={p.date} cx={p.cx} cy={p.cy} r={4} fill="var(--chart-1)" stroke="var(--surface)" strokeWidth={2} />
            ) : null,
          )}
          {/* End value label */}
          <text
            x={geo.xy[geo.xy.length - 1].cx}
            y={geo.xy[geo.xy.length - 1].cy - 10}
            textAnchor="end"
            // Surface-coloured halo keeps the end label legible where it crosses the line.
            stroke="var(--surface)"
            strokeWidth={4}
            paintOrder="stroke"
            strokeLinejoin="round"
            className="fill-text text-[12px] font-semibold tabular-nums"
          >
            {fmt(geo.xy[geo.xy.length - 1].value)}
          </text>

          {a && (
            <g pointerEvents="none">
              <line x1={a.cx} x2={a.cx} y1={PAD.top} y2={HEIGHT - PAD.bottom} stroke="var(--border-strong)" strokeWidth={1} />
              <circle cx={a.cx} cy={a.cy} r={5} fill="var(--chart-1)" stroke="var(--surface)" strokeWidth={2} />
            </g>
          )}
        </svg>
      )}
      {a && geo && (
        <div
          id={tipId}
          role="status"
          className="pointer-events-none absolute top-0 rounded-lg border border-border-strong bg-surface-2 px-2.5 py-1.5 text-xs shadow-lg"
          style={{ left: Math.min(Math.max(a.cx - 70, 0), width - 140), width: 140 }}
        >
          <span className="block text-sm font-semibold tabular-nums text-text">{fmt(a.value)}</span>
          <span className="flex items-center gap-1.5 whitespace-nowrap text-muted">
            <span aria-hidden className="inline-block h-0.5 w-3 rounded bg-chart-1" />
            {longDate(a.date)}
          </span>
        </div>
      )}
    </div>
  );
}
