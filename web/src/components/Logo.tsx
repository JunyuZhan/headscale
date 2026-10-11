/**
 * Headscale Web UI brand mark — "Mesh".
 *
 * A hexagonal node mesh: a central control-plane hub routing six satellite
 * nodes around a tailnet perimeter. It reads as what the product actually is —
 * a self-hosted network controller / mesh VPN — rather than a bare initial.
 *
 * The glyph is single-colour (currentColor) so it adapts to any surface.
 * `tile` wraps it in the brand ember chip used on the auth panel and the app
 * sidebar; without it the bare glyph is returned for flexible placement.
 */

type LogoProps = {
  size?: number;
  tile?: boolean;
  className?: string;
  title?: string;
};

function Mark({ size, title }: { size: number; title?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      fill="none"
      role="img"
      aria-label={title ?? "Headscale Web UI"}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* tailnet perimeter */}
      <path
        d="M24.6 16 20.3 23.45 11.7 23.45 7.4 16 11.7 8.55 20.3 8.55Z"
        stroke="currentColor"
        strokeWidth={1.35}
        strokeLinejoin="round"
        opacity={0.4}
      />
      {/* routes from the hub to each node */}
      <g stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
        <path d="M16 16 24.6 16" />
        <path d="M16 16 20.3 23.45" />
        <path d="M16 16 11.7 23.45" />
        <path d="M16 16 7.4 16" />
        <path d="M16 16 11.7 8.55" />
        <path d="M16 16 20.3 8.55" />
      </g>
      {/* satellite nodes */}
      <g fill="currentColor">
        <circle cx={24.6} cy={16} r={2.15} />
        <circle cx={20.3} cy={23.45} r={2.15} />
        <circle cx={11.7} cy={23.45} r={2.15} />
        <circle cx={7.4} cy={16} r={2.15} />
        <circle cx={11.7} cy={8.55} r={2.15} />
        <circle cx={20.3} cy={8.55} r={2.15} />
      </g>
      {/* central control-plane hub */}
      <circle cx={16} cy={16} r={2.7} fill="currentColor" />
    </svg>
  );
}

export default function Logo({
  size = 40,
  tile = false,
  className = "",
  title,
}: LogoProps) {
  if (tile) {
    const glyph = Math.round(size * 0.64);
    return (
      <span
        className={`inline-flex items-center justify-center rounded-xl bg-ember text-[color:var(--on-ember)] ${className}`}
        style={{ width: size, height: size }}
        aria-hidden={!title}
      >
        <Mark size={glyph} title={title} />
      </span>
    );
  }

  return (
    <span
      className={className}
      style={{ display: "inline-flex", color: "currentColor" }}
      aria-hidden={!title}
    >
      <Mark size={size} title={title} />
    </span>
  );
}
