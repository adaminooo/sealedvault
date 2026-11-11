import { useEffect, useMemo, useRef, useState } from 'react';

import { t, LOCALE } from '../i18n';
export interface ChartSeries {
  id: string;
  label: string;
  color: string;
  dashed?: boolean;
  /** Plocha pod čarou (jen u hlavní řady) */
  area?: boolean;
  points: { x: number; y: number | null }[];
}

interface Props {
  series: ChartSeries[];
  height?: number;
  formatY: (v: number) => string;
  formatX?: (t: number) => string;
  /** Text místo grafu, když nejsou data */
  empty?: string;
}

const dayFmt = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'numeric', year: '2-digit' });
const PAD = { top: 12, right: 12, bottom: 24, left: 8 };

function niceTicks(min: number, max: number, count = 4): number[] {
  if (min === max) return [min];
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const start = Math.ceil(min / step) * step;
  const out: number[] = [];
  for (let v = start; v <= max + 1e-9; v += step) out.push(v);
  return out;
}

/** Jednoduchý responzivní čárový graf v SVG s nitkovým křížem a tooltipem */
export function LineChart({ series, height = 220, formatY, formatX = (t) => dayFmt.format(t), empty }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(200, e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const geo = useMemo(() => {
    const xs = [...new Set(series.flatMap((s) => s.points.map((p) => p.x)))].sort((a, b) => a - b);
    const ys = series.flatMap((s) => s.points.map((p) => p.y).filter((y): y is number => y != null));
    if (!xs.length || !ys.length) return null;
    let yMin = Math.min(...ys);
    let yMax = Math.max(...ys);
    const pad = (yMax - yMin || Math.abs(yMax) || 1) * 0.12;
    yMin -= pad;
    yMax += pad;
    if (yMin < 0 && Math.min(...ys) >= 0) yMin = 0;
    const ticks = niceTicks(yMin, yMax);
    const labelW = Math.max(...ticks.map((t) => formatY(t).length)) * 6.6 + 10;
    const left = PAD.left + labelW;
    const innerW = width - left - PAD.right;
    const innerH = height - PAD.top - PAD.bottom;
    const x0 = xs[0];
    const x1 = xs[xs.length - 1];
    const sx = (x: number) => left + (x1 === x0 ? innerW / 2 : ((x - x0) / (x1 - x0)) * innerW);
    const sy = (y: number) => PAD.top + innerH - ((y - yMin) / (yMax - yMin)) * innerH;
    return { xs, ticks, left, innerW, innerH, sx, sy };
  }, [series, width, height, formatY]);

  if (!geo) {
    return (
      <div ref={wrap} className="chart-empty" style={{ height }}>
        {empty ?? t('Zatím žádná data')}
      </div>
    );
  }

  const { xs, ticks, left, innerW, sx, sy } = geo;
  const paths = series.map((s) => {
    let d = '';
    let area = '';
    let segStart: number | null = null;
    let prev: { x: number; y: number } | null = null;
    for (const p of s.points) {
      if (p.y == null) {
        const base = PAD.top + geo.innerH;
        if (prev && segStart != null && s.area) area += `L${sx(prev.x)},${base}L${segStart},${base}Z`;
        prev = null;
        segStart = null;
        continue;
      }
      const X = sx(p.x);
      const Y = sy(p.y);
      d += prev ? `L${X},${Y}` : `M${X},${Y}`;
      if (s.area) area += prev ? `L${X},${Y}` : `M${X},${Y}`;
      if (!prev) segStart = X;
      prev = { x: p.x, y: p.y };
    }
    if (prev && segStart != null && s.area) {
      const base = PAD.top + geo.innerH;
      area += `L${sx(prev.x)},${base}L${segStart},${base}Z`;
    }
    const single = s.points.filter((p) => p.y != null).length === 1 ? s.points.find((p) => p.y != null)! : null;
    return { s, d, area, single };
  });

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * width;
    let best = 0;
    let dist = Infinity;
    xs.forEach((t, i) => {
      const dd = Math.abs(sx(t) - x);
      if (dd < dist) {
        dist = dd;
        best = i;
      }
    });
    setHover(best);
  };

  const hx = hover != null ? xs[hover] : null;
  const tipLeft = hx != null ? Math.min(Math.max(sx(hx), 90), width - 90) : 0;

  return (
    <div ref={wrap} className="linechart">
      <svg width={width} height={height} onPointerMove={onMove} onPointerLeave={() => setHover(null)} role="img">
        <defs>
          {paths.map(({ s }) => (
            <linearGradient key={s.id} id={`lc-area-${s.id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={s.color} stopOpacity="0.28" />
              <stop offset="1" stopColor={s.color} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={left} x2={left + innerW} y1={sy(t)} y2={sy(t)} className="lc-grid" />
            <text x={left - 8} y={sy(t)} className="lc-ylabel" textAnchor="end" dominantBaseline="middle">
              {formatY(t)}
            </text>
          </g>
        ))}
        {[0, Math.floor((xs.length - 1) / 2), xs.length - 1]
          .filter((v, i, a) => a.indexOf(v) === i)
          .map((i, k, arr) => (
            <text
              key={i}
              x={sx(xs[i])}
              y={height - 6}
              className="lc-xlabel"
              textAnchor={arr.length > 1 && k === 0 ? 'start' : k === arr.length - 1 && arr.length > 1 ? 'end' : 'middle'}
            >
              {formatX(xs[i])}
            </text>
          ))}
        {paths.map(({ s, area }) => area && <path key={`a-${s.id}`} d={area} fill={`url(#lc-area-${s.id})`} />)}
        {paths.map(({ s, d }) => (
          <path
            key={s.id}
            d={d}
            fill="none"
            stroke={s.color}
            strokeWidth={2}
            strokeDasharray={s.dashed ? '5 5' : undefined}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}
        {paths.map(({ s, single }) => single && <circle key={`s-${s.id}`} cx={sx(single.x)} cy={sy(single.y!)} r={4.5} fill={s.color} stroke="var(--surface)" strokeWidth={2} />)}
        {hx != null && (
          <g>
            <line x1={sx(hx)} x2={sx(hx)} y1={PAD.top} y2={PAD.top + geo.innerH} className="lc-cross" />
            {series.map((s) => {
              const p = s.points.find((q) => q.x === hx);
              return p?.y != null ? <circle key={s.id} cx={sx(hx)} cy={sy(p.y)} r={4} fill={s.color} stroke="var(--surface)" strokeWidth={2} /> : null;
            })}
          </g>
        )}
      </svg>
      {hx != null && (
        <div className="lc-tip" style={{ left: tipLeft }}>
          <b>{formatX(hx)}</b>
          {series.map((s) => {
            const p = s.points.find((q) => q.x === hx);
            return p?.y != null ? (
              <span key={s.id}>
                <i style={{ background: s.color }} />
                {s.label}
                <em>{formatY(p.y)}</em>
              </span>
            ) : null;
          })}
        </div>
      )}
      {series.length > 1 && (
        <div className="lc-legend">
          {series.map((s) => (
            <span key={s.id}>
              <i className={s.dashed ? 'dashed' : ''} style={{ background: s.dashed ? undefined : s.color, borderColor: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
