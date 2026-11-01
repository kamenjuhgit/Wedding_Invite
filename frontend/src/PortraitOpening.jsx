import React, { useEffect, useRef } from "react";
import WaxSeal from "./WaxSeal";
import Monogram from "./Monogram";
import BotanicalScene from "./BotanicalScene";
import { motion } from "./motion";
// One 2.7s timeline: compress → split wax → lift flap → extract paper → dissolve.
export default function PortraitOpening({
  opening,
  onOpen,
  onComplete,
  paused = false,
}) {
  const seal = useRef();
  useEffect(() => {
    seal.current?.focus({ preventScroll: true });
  }, []);
  return (
    <section
      className={`letter-stage ${opening ? "unsealing" : ""}`}
      style={{ "--opening": `${motion.envelope}ms` }}
      aria-label="Sealed wedding invitation"
    >
      <BotanicalScene paused={paused} />
      <div className="envelope-scene">
        <div className="physical-envelope">
          <div className="envelope-back" />
          <div className="paper-letter" aria-hidden="true">
            <Monogram size={100} />
          </div>
          <div className="envelope-pocket" />
          <div className="envelope-fold fold-left" />
          <div className="envelope-fold fold-right" />
          <div className="envelope-flap" />
          <button
            ref={seal}
            className="seal-control"
            onClick={onOpen}
            disabled={opening}
            aria-label="Press to unseal"
          >
            <span className="wax-half half-left">
              <WaxSeal />
            </span>
            <span className="wax-half half-right">
              <WaxSeal />
            </span>
          </button>
        </div>
        <span className="unseal-label">Press to unseal</span>
      </div>
      <div
        className="opening-complete"
        onAnimationEnd={(e) => {
          if (e.animationName === "opening-clock") onComplete();
        }}
      />
    </section>
  );
}
