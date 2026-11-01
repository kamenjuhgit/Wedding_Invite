import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
// Regression: URL.pathname incorrectly passes %20/%25 to Sharp in WSL/Windows folders.
test("asset generation works in folders containing spaces, percent and Unicode", async () => {
  const root = await fs.mkdtemp(join(tmpdir(), "wedding assets % é "));
  try {
    for (const name of ["scripts", "public", "src"])
      await fs.mkdir(join(root, name));
    await fs.copyFile("package.json", join(root, "package.json"));
    await fs.copyFile("scripts/assets.mjs", join(root, "scripts/assets.mjs"));
    for (const name of ["config.js", "branding.json"])
      await fs.copyFile(join("src", name), join(root, "src", name));
    await fs.cp("public", join(root, "public"), { recursive: true });
    await fs.symlink(
      resolve("node_modules"),
      join(root, "node_modules"),
      process.platform === "win32" ? "junction" : "dir",
    );
    const path = join(root, "public/branding/monogram.png");
    const hash = async () =>
      createHash("sha256")
        .update(await fs.readFile(path))
        .digest("hex");
    const before = await hash();
    execFileSync(process.execPath, [join(root, "scripts/assets.mjs")], {
      cwd: root,
      timeout: 30000,
    });
    assert.equal(
      await hash(),
      before,
      "custom monogram must not be overwritten",
    );
    assert.ok(
      (await fs.stat(join(root, "public/branding/social-preview.jpg"))).size >
        0,
    );
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
