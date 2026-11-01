// Shared timings and presets. Guests never see a transition selector.
export const motion = {
  envelope: 2700,
  swap: 180,
  reveal: 650,
  threshold: 0.08,
};
export const presets = {
  horizontal: "horizontal",
  vertical: "vertical",
  crossfade: "crossfade",
  "out-in": "out-in",
};
export const reduced = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;
