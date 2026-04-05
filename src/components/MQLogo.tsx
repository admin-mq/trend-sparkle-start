interface MQLogoProps {
  /** Rendered pixel size (width = height) */
  size?: number;
  /** Show the black square background */
  showBackground?: boolean;
  className?: string;
}

/**
 * Marketers Quest logo mark — white geometric NM monogram on black.
 * Left element:  N shape — left upright, diagonal (top-left → bottom-right), right upright.
 * Right element: M shape — left upright, two peak diagonals meeting at centre, right upright.
 * All strokes use rounded line caps to match the original logo style.
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
        <rect width="100" height="100" rx="18" fill="#000000" />
      )}

      {/* ── Left element: N ── */}
      {/* Left upright */}
      <line x1="9"  y1="80" x2="9"  y2="16" stroke="white" strokeWidth="7" strokeLinecap="round" />
      {/* Diagonal (top-left → bottom-right) */}
      <line x1="9"  y1="16" x2="43" y2="80" stroke="white" strokeWidth="7" strokeLinecap="round" />
      {/* Right upright */}
      <line x1="43" y1="16" x2="43" y2="80" stroke="white" strokeWidth="7" strokeLinecap="round" />

      {/* ── Right element: M ── */}
      {/* Left upright */}
      <line x1="54" y1="80" x2="54" y2="16" stroke="white" strokeWidth="7" strokeLinecap="round" />
      {/* Left peak (top-left → centre-bottom) */}
      <line x1="54" y1="16" x2="72" y2="52" stroke="white" strokeWidth="7" strokeLinecap="round" />
      {/* Right peak (centre-bottom → top-right) */}
      <line x1="72" y1="52" x2="90" y2="16" stroke="white" strokeWidth="7" strokeLinecap="round" />
      {/* Right upright */}
      <line x1="90" y1="16" x2="90" y2="80" stroke="white" strokeWidth="7" strokeLinecap="round" />
    </svg>
  );
}
