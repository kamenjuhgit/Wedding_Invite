import React from "react";
import branding from "./branding.json";
// Every abbreviated logo uses this one transparent source, including the wax stamp.
export default function Monogram({
  size = 64,
  className = "",
  tone = "natural",
  decorative = true,
}) {
  return (
    <img
      className={`brand-mark ${tone === "light" ? "brand-light" : ""} ${className}`}
      src={branding.monogram}
      width={size}
      height={size}
      alt={decorative ? "" : "Selam and Kamenju monogram"}
      style={{ objectFit: "contain" }}
      decoding="async"
    />
  );
}
