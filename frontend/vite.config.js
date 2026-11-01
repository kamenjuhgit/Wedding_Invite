import { defineConfig, loadEnv } from "vite";
import branding from "./src/branding.json" with { type: "json" };
// Same-origin development proxy eliminates hardcoded browser localhost API addresses.
// Production uses VITE_API_URL; Netlify builds fail early if deployment values are missing.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const site = env.VITE_SITE_URL || env.URL || "";
  if (
    process.env.NETLIFY &&
    mode !== "admin" &&
    (!/^https:\/\//.test(site) || !/^https:\/\//.test(env.VITE_API_URL || ""))
  )
    throw new Error(
      "Set VITE_SITE_URL and VITE_API_URL to your public HTTPS frontend and backend URLs.",
    );
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
