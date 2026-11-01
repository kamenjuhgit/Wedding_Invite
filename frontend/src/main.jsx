import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { wedding as w } from "./config";
import { api, API_BASE } from "./api";
// Version 2 owns its entire stylesheet; it does not import Version 1.
import "./invitation.css";
import "./refinement.css";
import RSVP from "./RSVP";
import PortraitOpening from "./PortraitOpening";
import BotanicalScene from "./BotanicalScene";
import Monogram from "./Monogram";
import Transition from "./Transition";
import WeddingTimeline from "./WeddingTimeline";
import VenueMap from "./VenueMap";
import ClosingIllustration from "./ClosingIllustration";
import ScrollProgress from "./ScrollProgress";
import { motion, reduced } from "./motion";
import "./mobile-polish.css";
import "./rsvp-updates.css";
import { NotFound, InvitationBoundary } from "./ErrorCard";

const API = API_BASE;
// Browser storage can be blocked in private browsing; the invitation still works.
const read = (key) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const save = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* Optional preference only. */
  }
};
// getRandomValues also supports local HTTP previews; IDs are not authentication tokens.
const uuid = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");

// Countdown targets midnight of the configured date in Nairobi, not the ceremony time.
function Countdown() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  if (!w.dateISO)
    return (
      <p className="date-note">
        The exact date is on its way. The joy has already begun.
      </p>
    );
  const remaining = Math.max(0, new Date(w.dateISO).getTime() - now);
  return (
    <div className="countdown" aria-label="Time until the wedding">
      {[
        [86400000, "days"],
        [3600000, "hours"],
        [60000, "minutes"],
        [1000, "seconds"],
      ].map(([unit, label], i) => (
        <div key={label}>
          <b>
            {String(
              Math.floor(remaining / unit) %
                (i === 0 ? 100000 : i === 1 ? 24 : 60),
            ).padStart(2, "0")}
          </b>
          <span>{label}</span>
        </div>
      ))}
    </div>
  );
}

function App() {
  const [opened, setOpened] = useState(false);
  const [opening, setOpening] = useState(false);
  const [hasEntered, setHasEntered] = useState(false);
  const [returning, setReturning] = useState(false);
  const returnTimer = useRef();
  function returnToEnvelope() {
    if (returning) return;
    setReturning(true);
    returnTimer.current = setTimeout(
      () => {
        setOpened(false);
        setOpening(false);
        setReturning(false);
        window.scrollTo({ top: 0, behavior: "instant" });
      },
      reduced() ? 0 : motion.swap,
    );
  }
  useEffect(() => () => clearTimeout(returnTimer.current), []);
  const [motionPaused, setMotionPaused] = useState(false);
  // Finish on the paper animation event; timeout also handles interrupted animations.
  function finishOpening() {
    clearTimeout(transitionTimer.current);
    setOpened(true);
  }
  const transitionTimer = useRef(null);
  function openLetter() {
    if (opening) return;
    setHasEntered(true);
    setOpening(true);
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    transitionTimer.current = setTimeout(
      finishOpening,
      reduced ? 20 : motion.envelope + 100,
    );
  }
  useEffect(() => () => clearTimeout(transitionTimer.current), []);
  useEffect(() => {
    document.body.style.overflow = opened ? "" : "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [opened]);
  const [choice, setChoice] = useState(() => read("sk-v2-analytics"));
  const invitation = useRef(null);
  useEffect(() => {
    if (!opened) return;
    invitation.current?.focus({ preventScroll: true });
    // Reveal on scroll, but keep content accessible when animations are disabled.
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("seen");
            observer.unobserve(entry.target);
          }
        }),
      { threshold: 0.12 },
    );
    document.querySelectorAll(".reveal").forEach((el) => {
      el.classList.add("ready");
      observer.observe(el);
    });
    return () => observer.disconnect();
  }, [opened]);
  useEffect(() => {
    if (choice !== "yes") return;
    let sid;
    try {
      sid = sessionStorage.getItem("sk-v2-visit") || uuid();
      sessionStorage.setItem("sk-v2-visit", sid);
    } catch {
      sid = uuid();
    }
    api(API, "/api/visit", {
      method: "POST",
      body: { session_id: sid, consent: true },
    }).catch(() => {});
  }, [choice]);
  function choose(value) {
    save("sk-v2-analytics", value);
    setChoice(value);
  }
  return (
    <>
      {!opened && (
        <PortraitOpening
          opening={opening}
          onOpen={openLetter}
          onComplete={finishOpening}
          paused={motionPaused}
        />
      )}
      {hasEntered && (
        <div
          className={`invitation refined-invitation ${opened ? "is-revealed" : "is-revealing"} ${returning ? "returning" : ""}`}
          hidden={!opening && !opened}
          inert={!opened}
        >
          <header className="nav">
            <a className="monogram" href="#home" aria-label="Back to the top">
              <Monogram size={42} />
            </a>
            <nav aria-label="Invitation">
              <button className="return-envelope" onClick={returnToEnvelope}>
                Back to Envelope
              </button>
              <a href="#day">The day</a>
              <a href="#place">The place</a>
              <a href="#rsvp" className="nav-rsvp">
                RSVP ↗
              </a>
            </nav>
          </header>
          <main ref={invitation} tabIndex="-1" id="home">
            {/* The couple painting is revealed only after the floral cover opens. */}
            <section
              className="hero"
              style={{ "--portrait-opacity": w.portraitOpacity }}
            >
              <BotanicalScene paused={motionPaused || !opened} />
              {/* The portrait is decorative; text carries the invitation information. */}
              <img
                className="couple-watermark"
                src={w.portraitImage}
                srcSet={
                  w.portraitImage === "/couple-pastel.webp"
                    ? "/couple-480.webp 480w, /couple-800.webp 800w, /couple-pastel.webp 1024w"
                    : undefined
                }
                sizes="(max-width: 620px) 100vw, 620px"
                width="1024"
                height="1536"
                alt=""
                fetchPriority="high"
              />

              <div className="hero-frame" />
              <div className="hero-copy">
                <p className="family-invitation">{w.familyInvitation}</p>
                <h1>
                  {w.names[0]}
                  <em>&</em>
                  {w.names[1]}
                </h1>
                <p className="hero-sub">
                  In the garden of our lives,
                  <br />
                  you are part of the story.
                </p>
                <div className="date-line">
                  <span>{w.dateLabel}</span>
                  <span>{w.venue}</span>
                </div>
                <a className="button dark" href="#rsvp">
                  Be part of our day <span>↗</span>
                </a>
                <a className="scroll-note" href="#letter">
                  Unfold the day <span>↓</span>
                </a>
              </div>
            </section>
            {/* The invitation message and date countdown follow the title page. */}
            <section className="letter section reveal" id="letter">
              <span className="eyebrow">With full hearts</span>
              <h2>
                Some days become
                <br />
                <i>part of us forever.</i>
              </h2>
              <p>
                We’re getting married, and it wouldn’t be our day without the
                people who have filled our lives with love.
              </p>
              <p>
                Join us beneath the trees for promises, happy tears, and a
                celebration that feels like home.
              </p>
              <span className="signature">
                With love, {w.names.join(" & ")}
              </span>
              <Transition type="vertical">
                <Countdown />
              </Transition>
            </section>
            <div className="chapter-divider" aria-hidden="true">
              <span />a day to remember
              <span />
            </div>
            {/* Schedule entries come from config.js so you can change timings easily. */}
            <section className="section day reveal" id="day">
              <div className="section-heading">
                <span className="eyebrow">The unfolding of our day</span>
                <h2>
                  Every little
                  <br />
                  <i>beautiful moment.</i>
                </h2>
                <p>
                  A day to slow down, come together,
                  <br />
                  and make a few forever memories.
                </p>
              </div>
              <WeddingTimeline />
            </section>
            {/* A painted venue card replaces the earlier architectural illustration. */}
            <section className="place" id="place">
              <div className="venue-vignette">
                <span className="eyebrow">A gathering in the garden</span>
                <div className="venue-medallion">
                  <Monogram size={90} />
                  <i>Where love blooms</i>
                </div>
                <span className="eyebrow">{w.venue}</span>
              </div>
              <div className="place-copy reveal" data-reveal="crossfade">
                <span className="eyebrow">Meet us among the green</span>
                <h2>
                  A little garden.
                  <br />
                  <i>A whole lot of love.</i>
                </h2>
                <h3>{w.venue}</h3>
                <p>
                  A celebration under open skies, with a little greenery and all
                  of our favourite people.
                </p>
                <VenueMap />
                <div className="dress">
                  <span className="eyebrow">A note on what to wear</span>
                  <p>{w.dressCode}</p>
                  <small>{w.dressNote}</small>
                </div>
              </div>
            </section>
            {/* The independent RSVP component handles validation and saving. */}
            <section className="section rsvp-section reveal" id="rsvp">
              <div className="rsvp-intro">
                <span className="eyebrow">A little note back to us</span>
                <h2>
                  There’s a place
                  <br />
                  <i>for you here.</i>
                </h2>
                <p>
                  Let us know if you can make it.
                  <br />
                  We’re saving you a little happiness.
                </p>
                <p className="deadline">{w.rsvpDeadline}</p>
              </div>
              <div className="form-card">
                <RSVP />
              </div>
            </section>
            {/* The final painted page closes the invitation without a gift section. */}
            <ClosingIllustration paused={motionPaused || !opened} />
          </main>
        </div>
      )}
      {opened && <ScrollProgress />}
      {opened && choice === null && (
        <aside
          className="privacy-banner"
          aria-label="Optional visit statistics"
        >
          <div>
            <strong>A small privacy note</strong>
            <p>
              Allow anonymous visit statistics (time, browser and device
              category)? Your RSVP works either way. We don’t store your IP or
              track your location.
            </p>
          </div>
          <div className="privacy-actions">
            <button onClick={() => choose("no")}>No thanks</button>
            <button onClick={() => choose("yes")}>Allow statistics</button>
          </div>
        </aside>
      )}
    </>
  );
}
createRoot(document.getElementById("root")).render(
  <InvitationBoundary>
    {["/", "/index.html"].includes(window.location.pathname) ? (
      <App />
    ) : (
      <NotFound />
    )}
  </InvitationBoundary>,
);
