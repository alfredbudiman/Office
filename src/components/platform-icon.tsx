import type { Platform } from "@/lib/post-schedule";

/** Logo platform sosial (SVG inline, warna brand). */
export function PlatformIcon({ platform, size = 18, className = "" }: { platform: Platform; size?: number; className?: string }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", className, "aria-hidden": true } as const;
  switch (platform) {
    case "youtube":
      return (
        <svg {...common}>
          <path
            fill="#FF0000"
            d="M23.5 6.2a3 3 0 0 0-2.12-2.14C19.5 3.55 12 3.55 12 3.55s-7.5 0-9.38.51A3 3 0 0 0 .5 6.2C0 8.07 0 12 0 12s0 3.93.5 5.8a3 3 0 0 0 2.12 2.14C4.5 20.45 12 20.45 12 20.45s7.5 0 9.38-.51A3 3 0 0 0 23.5 17.8C24 15.93 24 12 24 12s0-3.93-.5-5.8z"
          />
          <path fill="#fff" d="M9.55 15.57V8.43L15.82 12z" />
        </svg>
      );
    case "youtube_shorts":
      return (
        <svg {...common}>
          <rect x="6" y="2.4" width="12" height="19.2" rx="5.2" fill="#FF0033" />
          <path fill="#fff" d="M10.4 8.4 15.6 12l-5.2 3.6z" />
        </svg>
      );
    case "tiktok":
      return (
        <svg {...common}>
          <path
            fill="currentColor"
            d="M12.53.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"
          />
        </svg>
      );
    case "instagram":
      return (
        <svg {...common}>
          <defs>
            <linearGradient id="sprout-ig-grad" x1="0" y1="1" x2="1" y2="0">
              <stop offset="0" stopColor="#FEDA75" />
              <stop offset=".25" stopColor="#FA7E1E" />
              <stop offset=".5" stopColor="#D62976" />
              <stop offset=".75" stopColor="#962FBF" />
              <stop offset="1" stopColor="#4F5BD5" />
            </linearGradient>
          </defs>
          <rect x="2" y="2" width="20" height="20" rx="6" fill="none" stroke="url(#sprout-ig-grad)" strokeWidth="2" />
          <circle cx="12" cy="12" r="4.8" fill="none" stroke="url(#sprout-ig-grad)" strokeWidth="2" />
          <circle cx="17.4" cy="6.6" r="1.3" fill="url(#sprout-ig-grad)" />
        </svg>
      );
  }
}
