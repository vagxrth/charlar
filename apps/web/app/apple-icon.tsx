import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// Full-bleed tile — iOS applies its own corner mask. The mark sits at ~75%
// so the tails stay inside the masked safe area. Colors are the dark-scheme
// brand tokens baked to hex (satori can't resolve CSS variables).
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #1a1510 0%, #0a0704 70%)",
        }}
      >
        <svg width="150" height="150" viewBox="0 0 48 48">
          <path
            d="M20.75 13.5 A7.8 7.8 0 1 1 8.78 11.6 A28.85 28.85 0 0 1 22.2 4.8 A6.94 6.94 0 0 0 20.75 13.5 Z"
            fill="#7fc39b"
          />
          <path
            d="M27.25 34.5 A7.8 7.8 0 1 1 39.22 36.4 A28.85 28.85 0 0 1 25.8 43.2 A6.94 6.94 0 0 0 27.25 34.5 Z"
            fill="#ec9c63"
          />
        </svg>
      </div>
    ),
    size
  );
}
