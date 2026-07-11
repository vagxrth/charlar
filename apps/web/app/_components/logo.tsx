/**
 * The charlar mark — "the room between".
 *
 * An opening and a closing quotation mark facing each other across shared
 * negative space: two voices, one ephemeral room. The sage quote picks up
 * `--accent`, the ember quote `--ember` — the same two presences that drift
 * through the home-page mesh — so the mark adapts to light/dark on its own.
 *
 * Geometry is three tangent-continuous circular arcs per glyph (ball, outer
 * tail, inner tail); the opening quote is the closing one rotated 180°.
 */

interface CharlarMarkProps {
  size?: number;
  /** Decorative placement (next to visible text) — hides it from AT. */
  decorative?: boolean;
  className?: string;
}

export function CharlarMark({
  size = 40,
  decorative = false,
  className,
}: CharlarMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      className={className}
      {...(decorative
        ? { "aria-hidden": true }
        : { role: "img", "aria-label": "charlar" })}
    >
      <path
        d="M20.75 13.5 A7.8 7.8 0 1 1 8.78 11.6 A28.85 28.85 0 0 1 22.2 4.8 A6.94 6.94 0 0 0 20.75 13.5 Z"
        fill="var(--accent)"
      />
      <path
        d="M27.25 34.5 A7.8 7.8 0 1 1 39.22 36.4 A28.85 28.85 0 0 1 25.8 43.2 A6.94 6.94 0 0 0 27.25 34.5 Z"
        fill="var(--ember)"
      />
    </svg>
  );
}
