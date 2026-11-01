import React from "react";

// One persistent, pointer-transparent layer follows the visitor through every
// section. Transform-only flight is light on mobile GPUs; nothing intercepts taps.
export default function GardenAtmosphere({ paused }) {
  return (
    <div
      className={`garden-atmosphere ${paused ? "breeze-paused" : ""}`}
      aria-hidden="true"
    >
      <div className="garden-air">
        {[1, 2, 3].map((index) => (
          <div key={index} className={`air-bird air-bird-${index}`}>
            <svg viewBox="0 0 100 70">
              <path
                className="bird-wing far"
                d="M48 39 Q18 35 8 5 Q38 8 54 34"
              />
              <path
                className="bird-wing near"
                d="M48 40 Q75 7 96 9 Q89 39 57 43"
              />
              <path d="M28 49 Q43 33 60 35 Q69 23 75 30 L84 34 L75 37 Q63 53 45 49 L24 58Z" />
            </svg>
          </div>
        ))}
        {[0, 1].map((i) => (
          <svg
            key={i}
            className={`edge-foliage edge-foliage-${i}`}
            viewBox="0 0 110 250"
          >
            <path
              d="M55 250 Q15 140 65 0"
              fill="none"
              stroke="#78886a"
              strokeWidth="1.5"
            />
            {[30, 65, 100, 135, 170, 205].map((y, j) => (
              <ellipse
                key={y}
                cx={j % 2 ? 55 : 35}
                cy={y}
                rx="12"
                ry="28"
                fill={j % 2 ? "#a6b596" : "#b9c3a4"}
                transform={`rotate(${j % 2 ? 35 : -35} ${j % 2 ? 55 : 35} ${y})`}
              />
            ))}
          </svg>
        ))}
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="air-petal" style={{ "--petal": i }} />
        ))}
      </div>
    </div>
  );
}
