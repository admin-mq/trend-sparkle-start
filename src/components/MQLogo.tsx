import mqLogo from "@/assets/mq-logo.png";

interface MQLogoProps {
  size?: number;
  showBackground?: boolean;
  className?: string;
}

export function MQLogo({ size = 32, className }: MQLogoProps) {
  return (
    <img
      src={mqLogo}
      alt="Marketers Quest"
      width={size}
      height={size}
      className={className}
      style={{ borderRadius: size * 0.18 }}
    />
  );
}
