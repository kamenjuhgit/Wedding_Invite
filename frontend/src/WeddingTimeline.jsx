import React, { useEffect, useRef } from "react";
import Transition from "./Transition";
import { wedding as w } from "./config";
export default function WeddingTimeline() {
  const ref = useRef();
  useEffect(() => {
    let frame;
    const draw = () => {
      frame = null;
      const rect = ref.current.getBoundingClientRect();
      const progress = Math.max(
        0,
        Math.min(1, (innerHeight * 0.7 - rect.top) / rect.height),
      );
      ref.current.style.setProperty("--line-progress", progress);
    };
    const scroll = () => {
      if (!frame) frame = requestAnimationFrame(draw);
    };
    scroll();
    addEventListener("scroll", scroll, { passive: true });
    addEventListener("resize", scroll);
    return () => {
      cancelAnimationFrame(frame);
      removeEventListener("scroll", scroll);
      removeEventListener("resize", scroll);
    };
  }, []);
  return (
    <div ref={ref} className="timeline progressive-timeline">
      <div className="timeline-rail" aria-hidden="true">
        <span />
      </div>
      {w.schedule.map((event, i) => (
        <Transition as="article" type="horizontal" key={event.title}>
          <div className="timeline-number">0{i + 1}</div>
          <div>
            <span className="eyebrow">{event.time}</span>
            <h3>{event.title}</h3>
            <p>{event.text}</p>
          </div>
        </Transition>
      ))}
      <p className="small">Final timings will be shared closer to the day.</p>
    </div>
  );
}
