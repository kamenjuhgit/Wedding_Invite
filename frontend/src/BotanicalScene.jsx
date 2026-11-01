import React, { memo, useEffect, useRef, useState } from "react";
// Actual watercolor floral crops reuse the existing stationery, rather than replacing its style.
export const AnimatedFlorals = memo(function AnimatedFlorals() {
  return (
    <>
      <div className="living-floral floral-a" />
      <div className="living-floral floral-b" />
      {[0, 1, 2].map((i) => (
        <span key={i} className="scene-petal" style={{ "--n": i }} />
      ))}
    </>
  );
});
export const AnimatedBirds = memo(function AnimatedBirds() {
  return (
    <>
      {[0, 1].map((i) => (
        <div key={i} className={`scene-bird bird-route-${i}`}>
          <svg viewBox="0 0 100 70">
            <path className="bird-wing far" d="M48 39 Q18 35 8 5 Q38 8 54 34" />
            <path
              className="bird-wing near"
              d="M48 40 Q75 7 96 9 Q89 39 57 43"
            />
            <path d="M28 49 Q43 33 60 35 Q69 23 75 30 L84 34 L75 37 Q63 53 45 49 L24 58Z" />
          </svg>
        </div>
      ))}
    </>
  );
});
export default memo(function BotanicalScene({ paused = false }) {
  const ref = useRef(null);
  const [inView, setInView] = useState(true);
  const [hidden, setHidden] = useState(document.hidden);
  useEffect(() => {
    const observer = new IntersectionObserver(([e]) =>
      setInView(e.isIntersecting),
    );
    observer.observe(ref.current);
    const visibility = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);
  return (
    <div
      ref={ref}
      className={`botanical-scene ${paused || !inView || hidden ? "scene-paused" : ""}`}
      aria-hidden="true"
    >
      <AnimatedFlorals />
      <AnimatedBirds />
    </div>
  );
});
