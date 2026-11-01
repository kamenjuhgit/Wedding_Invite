import React, { useEffect, useRef, useState } from "react";
import { wedding as w } from "./config";
import Monogram from "./Monogram";
import Transition from "./Transition";
let loader;
function loadGoogle(key) {
  if (window.google?.maps?.importLibrary) return Promise.resolve();
  if (!loader)
    loader = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      window.weddingMapReady = resolve;
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&loading=async&callback=weddingMapReady&v=weekly`;
      script.async = true;
      script.onerror = reject;
      document.head.append(script);
    });
  return loader;
}
// No iframe or colour filters. The credential-free card is always useful; the
// optional cloud-styled map loads only after an explicit guest action.
export default function VenueMap() {
  const ref = useRef();
  const [enabled, setEnabled] = useState(false),
    [ready, setReady] = useState(false),
    [failed, setFailed] = useState(false);
  const key = import.meta.env.VITE_GOOGLE_MAPS_KEY,
    mapId = import.meta.env.VITE_GOOGLE_MAP_ID;
  useEffect(() => {
    if (!enabled) return;
    let disposed = false,
      marker,
      map;
    const timeout = setTimeout(() => {
      if (!disposed) setFailed(true);
    }, 12000);
    const oldFailure = window.gm_authFailure;
    window.gm_authFailure = () => {
      if (!disposed) setFailed(true);
    };
    (async () => {
      try {
        await loadGoogle(key);
        const { Map } = await google.maps.importLibrary("maps");
        const { AdvancedMarkerElement } =
          await google.maps.importLibrary("marker");
        const { Place } = await google.maps.importLibrary("places");
        const place = new Place({ id: w.placeId });
        await place.fetchFields({ fields: ["location", "displayName"] });
        if (disposed) return;
        if (!place.location) throw new Error("No venue location");
        map = new Map(ref.current, {
          center: place.location,
          zoom: 15,
          mapId,
          gestureHandling: "cooperative",
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
        });
        const pin = document.createElement("div");
        pin.className = "venue-pin";
        pin.textContent = "❧";
        marker = new AdvancedMarkerElement({
          map,
          position: place.location,
          title: w.venue,
          content: pin,
        });
        google.maps.event.addListenerOnce(map, "tilesloaded", () => {
          if (!disposed) {
            clearTimeout(timeout);
            setReady(true);
          }
        });
      } catch {
        if (!disposed) setFailed(true);
      }
    })();
    return () => {
      disposed = true;
      clearTimeout(timeout);
      if (marker) marker.map = null;
      if (map) google.maps.event.clearInstanceListeners(map);
      window.gm_authFailure = oldFailure;
    };
  }, [enabled, key, mapId]);
  return (
    <Transition type="crossfade" className="venue-card">
      <div className="venue-card-heading">
        <Monogram size={65} />
        <h3>{w.venue}</h3>
        <p>{w.address}</p>
      </div>
      {key && mapId && !enabled && (
        <button
          type="button"
          className="text-button"
          onClick={() => setEnabled(true)}
        >
          Explore the interactive map
        </button>
      )}
      {enabled && (
        <>
          {!ready && !failed && <p role="status">Opening the garden map…</p>}
          {failed && (
            <p className="small">
              The interactive map is unavailable. Open directions below.
            </p>
          )}
          <div
            ref={ref}
            className={`styled-map ${ready && !failed ? "map-ready" : ""}`}
            aria-label="Eva’s Garden interactive Google map"
          />
        </>
      )}
      <a
        className="button dark"
        href={w.mapsURL}
        target="_blank"
        rel="noreferrer"
      >
        Open directions <span aria-hidden="true">↗</span>
      </a>
    </Transition>
  );
}
