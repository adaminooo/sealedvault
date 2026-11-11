import { useId } from 'react';

interface Props {
  values: number[];
  /** barva podle vývoje (první vs. poslední bod) */
  tone?: 'pos' | 'neg' | 'neutral';
  className?: string;
  /** vyplnit plochu pod křivkou */
  area?: boolean;
  /** tloušťka čáry */
  stroke?: number;
}

/** Mini graf průběhu (bez os) – u produktů a na hlavní kartě */
export function Sparkline({ values, tone, className = '', area = true, stroke = 1.6 }: Props) {
  // bez dvojteček z useId – Safari je v odkazu url(#…) nemusí přečíst
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  if (values.length < 2) return null;
  const W = 100;
  const H = 32;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pad = 2;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * W, pad + (1 - (v - min) / span) * (H - pad * 2)] as const);
  // vyhlazená křivka (kubické Bézierovy úseky přes středy)
  let d = `M${pts[0][0].toFixed(2)},${pts[0][1].toFixed(2)}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    const mx = (x0 + x1) / 2;
    d += ` C${mx.toFixed(2)},${y0.toFixed(2)} ${mx.toFixed(2)},${y1.toFixed(2)} ${x1.toFixed(2)},${y1.toFixed(2)}`;
  }
  const dir = tone ?? (values[values.length - 1] > values[0] ? 'pos' : values[values.length - 1] < values[0] ? 'neg' : 'neutral');
  return (
    <svg className={`spark ${dir} ${className}`} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id={`sp-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="currentColor" stopOpacity="0.28" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      {area && <path d={`${d} L${W},${H} L0,${H} Z`} fill={`url(#sp-${id})`} />}
      <path d={d} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
