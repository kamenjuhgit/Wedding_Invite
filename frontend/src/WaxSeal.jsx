import React, { useId } from "react";
import branding from "./branding.json";

// A scalable wax impression: irregular pooled rim, inset stamp and raised initials.
// Light and shadow are separate SVG passes, so the monogram stays sharp on phones.
export default function WaxSeal() {
  const uid = useId().replace(/:/g, "");
  const rim =
    "M80 7 C93 3 98 13 109 12 S123 20 128 29 S146 39 145 52 S154 69 150 82 S155 102 143 112 S139 131 124 136 S109 151 96 148 S77 158 65 149 S44 148 37 135 S20 128 18 113 S5 96 10 83 S3 62 14 51 S17 31 31 26 S44 11 58 13 S68 4 80 7Z";
  return (
    <svg className="wax-art" viewBox="0 0 160 165" aria-hidden="true">
      <defs>
        <linearGradient id={`${uid}-wax-rim`} x1="0" y1="0" x2=".8" y2="1">
          <stop stopColor="#f2c5ae" />
          <stop offset=".23" stopColor="#c78972" />
          <stop offset=".5" stopColor="#a65f51" />
          <stop offset=".74" stopColor="#d89c82" />
          <stop offset="1" stopColor="#7f4339" />
        </linearGradient>
        <radialGradient id={`${uid}-wax-face`} cx=".35" cy=".25" r=".85">
          <stop stopColor="#e7b59e" />
          <stop offset=".5" stopColor="#c78973" />
          <stop offset="1" stopColor="#a56757" />
        </radialGradient>
        <filter
          id={`${uid}-wax-shadow`}
          x="-30%"
          y="-30%"
          width="160%"
          height="170%"
        >
          <feDropShadow
            dx="0"
            dy="5"
            stdDeviation="3"
            floodColor="#583c30"
            floodOpacity=".4"
          />
        </filter>
        <filter id={`${uid}-wax-grain`}>
          <feTurbulence
            type="fractalNoise"
            baseFrequency=".65"
            numOctaves="3"
            seed="8"
          />
          <feColorMatrix type="saturate" values="0" />
          <feComposite in2="SourceGraphic" operator="in" />
          <feBlend in="SourceGraphic" mode="soft-light" />
        </filter>
      </defs>
      <g filter={`url(#${uid}-wax-shadow)`}>
        <path
          d={rim}
          fill={`url(#${uid}-wax-rim)`}
          stroke="#975849"
          strokeWidth=".8"
        />
        <path
          d={rim}
          fill="none"
          stroke="#f3c8ab"
          strokeWidth="1.2"
          opacity=".65"
          transform="translate(3 2) scale(.96)"
        />
        <circle cx="80" cy="80" r="57" fill="#905245" />
        <circle
          cx="80"
          cy="81.5"
          r="54.5"
          fill={`url(#${uid}-wax-face)`}
          stroke="#ebbb9f"
          strokeWidth="1.5"
        />
        <circle
          cx="80"
          cy="80"
          r="49"
          fill="none"
          stroke="#975f50"
          strokeWidth=".7"
        />
        <circle
          cx="80"
          cy="80"
          r="46"
          fill="none"
          stroke="#ecc0a3"
          strokeWidth=".6"
          opacity=".7"
        />
        {/* Native SVG coordinates avoid Safari foreignObject/filter positioning bugs.
            The 78 × 78 image is centred at (80, 80) and preserves PNG transparency. */}
        <image
          href={branding.monogram}
          x="41"
          y="41"
          width="78"
          height="78"
          preserveAspectRatio="xMidYMid meet"
          opacity="0.85"
          pointerEvents="none"
        />
        <circle
          cx="80"
          cy="80"
          r="54"
          fill="#bf8e75"
          filter={`url(#${uid}-wax-grain)`}
          opacity=".12"
        />
        <path
          d="M21 64 Q18 42 42 25 M110 136 Q139 126 142 103"
          stroke="#f8cfb2"
          strokeWidth="2.5"
          fill="none"
          opacity=".55"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}
