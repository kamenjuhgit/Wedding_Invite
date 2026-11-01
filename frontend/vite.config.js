import { defineConfig, loadEnv } from "vite";
import branding from "./src/branding.json" with { type: "json" };
// Same-origin development proxy eliminates hardcoded browser localhost API addresses.
// Production uses VITE_API_URL; Netlify builds fail early on a missing site URL or non-HTTPS values.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const site = env.VITE_SITE_URL || env.URL || "";
  if (process.env.NETLIFY && mode !== "admin") {
    if (!/^https:\/\//.test(site))
      throw new Error(
        "Set VITE_SITE_URL to your public HTTPS frontend URL.",
      );
    // A missing API URL still deploys the invitation; RSVPs show a clear
    // "service unavailable" message until a public HTTPS backend exists.
    if (!env.VITE_API_URL)
      console.warn(
        "VITE_API_URL is not set: RSVP and guest API features are unavailable on this deploy.",
      );
    else if (!/^https:\/\//.test(env.VITE_API_URL))
      throw new Error("VITE_API_URL must be a public HTTPS backend URL.");
  }
  const escape = (value) =>
    String(value)
      .replaceAll("&", "&amp;")
      .replaceAll('"', "&quot;")
      .replaceAll("<", "&lt;");
  return {
    server: {
      allowedHosts: ["terminal.local"],
      proxy: {
        "/api/admin": {
          target: env.DEV_ADMIN_API_TARGET || "http://127.0.0.1:5001",
        },
        "/api": { target: env.DEV_API_TARGET || "http://127.0.0.1:5000" },
      },
    },
    plugins: [
      {
        name: "initial-social-metadata",
        transformIndexHtml(html) {
          const origin = site.replace(/\/$/, "");
          return html
            .replaceAll("__SITE_URL__", escape(origin || "/"))
            .replaceAll(
              "__SOCIAL_IMAGE__",
              escape(origin + branding.socialImage),
            );
        },
      },
    ],
    build: {
      outDir: mode === "admin" ? "dist-admin" : "dist",
      rollupOptions: { input: mode === "admin" ? "admin.html" : "index.html" },
    },
  };
});
