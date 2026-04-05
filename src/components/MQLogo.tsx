interface MQLogoProps {
  /** Rendered pixel size (width = height) */
  size?: number;
  /** Show the black square background */
  showBackground?: boolean;
  className?: string;
}

/**
 * Marketers Quest logo mark — white geometric MQ monogram.
 * Left element: diagonal stroke with angled ticks (abstract Q / N mark).
 * Right element: clean M shape with two verticals and a centre peak.
 */
export function MQLogo({ size = 32, showBackground = true, className }: MQLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {showBackground && (
        <rect width="100" height="100" rx="20" fill="#000000" />
      )}

      {/* Left element — diagonal stroke with angled entry/exit ticks */}
      {/* Entry tick (upper-right direction) */}
      <line x1="10" y1="24" x2="24" y2="12" stroke="white" strokeWidth="7" strokeLinecap="round" />
      {/* Main diagonal (upper-left to lower-right) */}
      <line x1="24" y1="12" x2="48" y2="78" stroke="white" strokeWidth="7" strokeLinecap="round" />
      {/* Exit tick (lower-left direction) */}
      <line x1="48" y1="78" x2="34" y2="88" stroke="white" strokeWidth="7" strokeLinecap="round" />

      {/* Right element — M shape */}
      {/* Left vertical */}
      <line x1="55" y1="80" x2="55" y2="18" stroke="white" strokeWidth="7" strokeLinecap="round" />
      {/* Left peak diagonal (down to centre) */}
      <line x1="55" y1="18" x2="72" y2="52" stroke="white" strokeWidth="7" strokeLinecap="round" />
      {/* Right peak diagonal (up from centre) */}
      <line x1="72" y1="52" x2="89" y2="18" stroke="white" strokeWidth="7" strokeLinecap="round" />
      {/* Right vertical */}
      <line x1="89" y1="18" x2="89" y2="80" stroke="white" strokeWidth="7" strokeLinecap="round" />
    </svg>
  );
}
