import React, { useEffect, useRef } from "react";
export default function ScrollProgress() {
  const ref = useRef();
  useEffect(() => {
    let frame;
    const update = () => {
      frame = null;
      const height = document.documentElement.scrollHeight - innerHeight;
      ref.current?.style.setProperty(
        "--progress",
        height > 0 ? scrollY / height : 0,
      );
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    schedule();
    addEventListener("scroll", schedule, { passive: true });
    addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      removeEventListener("scroll", schedule);
      removeEventListener("resize", schedule);
    };
  }, []);
  return (
    <div ref={ref} className="botanical-progress" aria-hidden="true">
      <span />
      <i>❧</i>
    </div>
  );
}
