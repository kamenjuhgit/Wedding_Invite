import React, { useEffect, useRef, useState } from "react";
import { wedding as w } from "./config";
import Monogram from "./Monogram";
import BotanicalScene from "./BotanicalScene";
import Transition from "./Transition";
import "./closing-refinement.css";

// This page reuses the existing portrait and the single editable monogram PNG.
export default function ClosingIllustration({ paused }) {
  const scene = useRef(null);
  const [waterActive, setWaterActive] = useState(false);
  useEffect(() => {
    // Older browsers keep the pond still; the illustration remains fully usable.
    if (!window.IntersectionObserver) return;
    let visible = false;
    const update = () => setWaterActive(visible && !document.hidden);
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      update();
    });
    observer.observe(scene.current);
    document.addEventListener("visibilitychange", update);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", update);
    };
  }, []);

  return (
    <section
      ref={scene}
      className={`closing illustrated-closing closing-blessing ${paused || !waterActive ? "water-paused" : ""}`}
      id="closing"
      aria-label="Our closing blessing"
    >
      <BotanicalScene paused={paused} />
      <Transition type="crossfade" className="closing-artwork">
        <img
          className="closing-portrait"
          src={w.portraitImage}
          srcSet={
            w.portraitImage === "/couple-pastel.webp"
              ? "/couple-480.webp 480w, /couple-800.webp 800w, /couple-pastel.webp 1024w"
              : undefined
          }
          sizes="(max-width: 680px) 100vw, 680px"
          alt="Watercolour illustration of Selam and Kamenju together beside a garden pond"
          width="1024"
          height="1536"
          loading="lazy"
        />
        {/* Light on the pond moves independently; the couple remains still.
            Hide this overlay for replacement artwork with a different pond position. */}
        {w.portraitImage === "/couple-pastel.webp" && (
          <div className="closing-water" aria-hidden="true">
            <span />
            <span />
          </div>
        )}
      </Transition>
      <div className="closing-copy">
        <Transition type="crossfade">
          <Monogram size={90} />
        </Transition>
        <Transition type="vertical" delay={80}>
          <h2 className="closing-names">{w.names.join(" & ")}</h2>
          <p className="closing-date">{w.dateLabel}</p>
        </Transition>
        <Transition type="crossfade" delay={180}>
          <p className="closing-scripture">
            We love because He first loved us.
          </p>
          <p className="closing-verse">1 John 4:19</p>
        </Transition>
      </div>
    </section>
  );
}
