// Build-time only: regenerate icons, social stationery and responsive artwork.
// Replacing public/branding/monogram.png and rebuilding updates every derived asset.
import sharp from "sharp";
import { fileURLToPath } from "node:url";
// Sharp needs filesystem paths: decode spaces safely on Windows, WSL and macOS.
import { writeFile, mkdir, access } from "node:fs/promises";
import { wedding as w } from "../src/config.js";
import branding from "../src/branding.json" with { type: "json" };
const pub = new URL("../public/", import.meta.url);
const target = new URL("branding/", pub);
await mkdir(target, { recursive: true });
const source = new URL(branding.monogram.slice(1), pub);
// Supply a starting monogram once. Never overwrite the couple’s replacement PNG.
try {
  await access(source);
} catch (error) {
  if (error.code !== "ENOENT") throw error;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 160 160"><g fill="#526447" font-family="Georgia,serif" font-style="italic"><text x="20" y="105" font-size="90">S</text><text x="85" y="118" font-size="88">k</text><text x="76" y="88" font-size="28">&amp;</text></g><path d="M20 125Q80 153 141 122M26 35Q80 12 137 40" stroke="#526447" stroke-width="2" fill="none"/></svg>`;
  await sharp(Buffer.from(svg)).png().toFile(fileURLToPath(source));
}
for (const size of [32, 180, 192, 512])
  await sharp(fileURLToPath(source))
    .resize(size, size, { fit: "contain", background: "#f8f4eb" })
    .png()
    .toFile(fileURLToPath(new URL(`icon-${size}.png`, target)));
const svgText = (s) =>
  s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");
const floral = await sharp(
  fileURLToPath(new URL("garden-stationery.webp", pub)),
)
  .resize(1200, 630, { fit: "fill" })
  .toBuffer();
const logo = await sharp(fileURLToPath(source))
  .resize(130, 130, { fit: "contain", background: "#0000" })
  .png()
  .toBuffer();
const letters = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><rect x="40" y="32" width="1120" height="566" fill="none" stroke="#879477"/><rect x="210" y="55" width="780" height="520" rx="170" fill="#fbf8ed" fill-opacity=".86"/><g text-anchor="middle" fill="#465c3d" font-family="Georgia,serif"><text x="600" y="290" font-size="18" letter-spacing="5">TOGETHER, ALWAYS</text><text x="600" y="370" font-size="58">${svgText(w.names.join(" & "))}</text><text x="600" y="440" font-size="31">${svgText(w.dateLabel)}</text><text x="600" y="496" font-size="17" letter-spacing="3">SAVE THE DATE</text></g></svg>`,
);
await sharp(floral)
  .composite([{ input: letters }, { input: logo, left: 535, top: 105 }])
  .jpeg({ quality: 90 })
  .toFile(fileURLToPath(new URL("social-preview.jpg", target)));
for (const [original, prefix] of [
  ["couple-pastel.webp", "couple"],
  ["garden-stationery.webp", "garden"],
])
  for (const width of [480, 800])
    await sharp(fileURLToPath(new URL(original, pub)))
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: 84 })
      .toFile(fileURLToPath(new URL(`${prefix}-${width}.webp`, pub)));
await writeFile(
  new URL("site.webmanifest", pub),
  JSON.stringify(
    {
      name: w.names.join(" & "),
      short_name: "Wedding",
      start_url: "/",
      display: "standalone",
      background_color: branding.themeColor,
      theme_color: branding.themeColor,
      icons: [192, 512].map((size) => ({
        src: `/branding/icon-${size}.png`,
        sizes: `${size}x${size}`,
        type: "image/png",
        purpose: "any",
      })),
    },
    null,
    2,
  ),
);
console.log(
  "Branding, social preview and responsive images generated from the central assets.",
);
