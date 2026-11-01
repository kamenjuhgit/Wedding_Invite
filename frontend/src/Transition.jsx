import React, { useEffect, useRef, useState } from "react";
import { motion, reduced } from "./motion";
// Reveal once: backwards scrolling never hides content or replays a long sequence.
export default function Transition({
  as: Tag = "div",
  type = "vertical",
  delay = 0,
  className = "",
  children,
  ...props
}) {
  const ref = useRef(null);
  const [state, setState] = useState("");
  useEffect(() => {
    if (reduced() || !window.IntersectionObserver) return;
    setState("waiting");
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setState("visible");
          observer.disconnect();
        }
      },
      { threshold: motion.threshold },
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return (
    <Tag
      ref={ref}
      className={`transition ${state} ${className}`}
      data-transition={type}
      style={{ "--delay": `${delay}ms` }}
      {...props}
    >
      {children}
    </Tag>
  );
}
// CSS-animated exit before replacing a form/card; its caller changes state only after save succeeds.
export function useOutIn(initial) {
  const [mode, setMode] = useState(initial);
  const [leaving, setLeaving] = useState(false);
  const timer = useRef();
  useEffect(() => () => clearTimeout(timer.current), []);
  const change = (next) => {
    clearTimeout(timer.current);
    if (reduced()) {
      setMode(next);
      return;
    }
    setLeaving(true);
    timer.current = setTimeout(() => {
      setMode(next);
      setLeaving(false);
    }, motion.swap);
  };
  return [mode, change, leaving];
}
