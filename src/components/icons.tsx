const base = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

export const TrendIcon = ({ dir }: { dir: 'pos' | 'neg' | 'neutral' }) => (
  <svg {...base} width={14} height={14} strokeWidth="2">
    {dir === 'pos' && <path d="M7 17 17 7M9 7h8v8" />}
    {dir === 'neg' && <path d="M7 7l10 10M17 9v8H9" />}
    {dir === 'neutral' && <path d="M5 12h14" />}
  </svg>
);

export const SearchIcon = () => (
  <svg {...base}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
);

export const SlidersIcon = () => (
  <svg {...base}>
    <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" />
    <circle cx="16" cy="6" r="2" />
    <circle cx="10" cy="12" r="2" />
    <circle cx="18" cy="18" r="2" />
  </svg>
);

export const DownloadIcon = () => (
  <svg {...base}>
    <path d="M12 3v12m0 0-4-4m4 4 4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
  </svg>
);

export const GearIcon = () => (
  <svg {...base}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </svg>
);

export const PlusIcon = () => (
  <svg {...base} strokeWidth="2">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const CrownIcon = ({ size = 18 }: { size?: number }) => (
  <svg {...base} width={size} height={size}>
    <path d="M3 7l4.5 4L12 4l4.5 7L21 7l-2 12H5L3 7z" />
  </svg>
);

export const LockIcon = ({ size = 14 }: { size?: number }) => (
  <svg {...base} width={size} height={size} strokeWidth="2">
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
);

export const ChevronIcon = () => (
  <svg {...base} width={16} height={16}>
    <path d="m9 6 6 6-6 6" />
  </svg>
);

// ---------- Jednotná sada ikon (stejný tah, zakulacení a mřížka 24×24) ----------
type IconProps = { size?: number; className?: string };
const mk = (paths: string[]) =>
  function SvgIcon({ size = 16, className }: IconProps) {
    return (
      <svg {...base} width={size} height={size} className={`icon ${className ?? ''}`}>
        {paths.map((d) => (
          <path key={d} d={d} />
        ))}
      </svg>
    );
  };

export const XIcon = mk(['M18 6 6 18', 'm6 6 12 12']);
export const CheckIcon = mk(['M20 6 9 17l-5-5']);
export const ExternalIcon = mk(['M7 17 17 7', 'M8 7h9v9']);
export const BellIcon = mk(['M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9', 'M10.3 21a1.94 1.94 0 0 0 3.4 0']);
export const TrophyIcon = mk(['M6 9H4.5a2.5 2.5 0 0 1 0-5H6', 'M18 9h1.5a2.5 2.5 0 0 0 0-5H18', 'M4 22h16', 'M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22', 'M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22', 'M18 2H6v7a6 6 0 0 0 12 0V2Z']);
export const TrendDownIcon = mk(['m22 17-8.5-8.5-5 5L2 7', 'M16 17h6v-6']);
export const TargetIcon = mk(['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z', 'M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z', 'M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z']);
export const AlertIcon = mk(['m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3', 'M12 9v4', 'M12 17h.01']);
export const ShareIcon = mk(['M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7', 'm16 6-4-4-4 4', 'M12 2v13']);
export const RefreshIcon = mk(['M21 12a9 9 0 1 1-2.6-6.4', 'M21 4v5h-5']);
export const CameraIcon = mk(['M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z', 'M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z']);

/** Logo SealedVault – zdroj je public/logo.svg (z něj se generují i ikony appky) */
export const Logo = ({ size = 32 }: { size?: number }) => (
  <img src={`${import.meta.env.BASE_URL}logo.svg`} width={size} height={size} alt="" className="logo-img" draggable={false} />
);
