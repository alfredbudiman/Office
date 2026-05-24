import type { SVGProps } from "react";

/**
 * Logo SPROUT — dua daun tumbuh dari tunas. Stroke pakai currentColor agar
 * mudah dipadu warna brand. Pakai prop `size` untuk ukuran kotak; default 24.
 */
export function SproutLogo({
  size = 24,
  ...props
}: { size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      fill="none"
      role="img"
      aria-label="SPROUT"
      {...props}
    >
      {/* Tanah / garis tumbuh */}
      <path
        d="M6 26 Q16 28 26 26"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        opacity={0.35}
      />
      {/* Stem utama (dua tikungan halus) */}
      <path
        d="M16 26 C 16 22, 14.5 19, 16 15 C 17.5 11, 17 8, 16 5"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        fill="none"
      />
      {/* Daun kiri — organic blob, tilted */}
      <path
        d="M16 13.5 C 11 13.5, 8 10.5, 7.5 7 C 11.5 7, 15 9.5, 16 13.5 Z"
        fill="currentColor"
        opacity={0.92}
      />
      {/* Daun kanan — sedikit lebih besar & lebih atas */}
      <path
        d="M16 9.5 C 21.5 9.5, 25 6, 25.5 2 C 21 2, 17 5, 16 9.5 Z"
        fill="currentColor"
      />
      {/* Tunas kecil (bud) di puncak */}
      <circle cx="16" cy="5" r="1.4" fill="currentColor" />
    </svg>
  );
}
