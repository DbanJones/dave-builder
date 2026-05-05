#!/usr/bin/env node
// Vendor `@anthropic-ai/claude-code` into the Tauri installer (ADR-0009).
// Runs before `tauri build` (wired via package.json's `prebuild`). The
// resulting directory is referenced by tauri.conf.json's bundle.resources
// so it lands under Resources/ in the packaged .app/.msi/.AppImage. The
// Rust resolver picks it up as a last-resort fallback after the user's
// system install (see src-tauri/src/lib.rs::bundled_claude_paths).
//
// Layout produced:
//   src-tauri/claude-cli-bundle/
//     package.json
//     node_modules/
//       .bin/
//         claude       (Unix wrapper script written by npm)
//         claude.cmd   (Windows wrapper written by npm)
//       @anthropic-ai/claude-code/...
//
// Idempotent: nukes the dest first (preserves .gitkeep so codegen still
// resolves the path between builds).
//
// Pinned version note: bumping CLAUDE_CODE_VERSION constitutes a Builder
// release per ADR-0009. The bundled CLI must remain compatible with the
// Claude Agent SDK pinned in sidecar/package.json.

import { execSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const CLAUDE_CODE_VERSION = "2.1.128"; // pin per ADR-0009; bump on Builder release

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..");
const dest = join(repoRoot, "src-tauri", "claude-cli-bundle");

console.log("package-claude-cli: cleaning", dest);
mkdirSync(dest, { recursive: true });
for (const name of readdirSync(dest)) {
  if (name === ".gitkeep") continue;
  rmSync(join(dest, name), { recursive: true, force: true });
}

// Minimal package.json so `npm install` knows where to drop deps.
writeFileSync(
  join(dest, "package.json"),
  JSON.stringify(
    {
      name: "dave-builder-claude-cli-bundle",
      version: "0.0.0",
      private: true,
      description:
        "Vendored @anthropic-ai/claude-code shipped inside the Builder installer (ADR-0009). Do not edit by hand.",
      dependencies: {
        "@anthropic-ai/claude-code": CLAUDE_CODE_VERSION,
      },
    },
    null,
    2,
  ) + "\n",
);

console.log(`package-claude-cli: installing @anthropic-ai/claude-code@${CLAUDE_CODE_VERSION}`);
// `npm install` over corepack pnpm here: pnpm's symlinked store breaks
// the wrapper script's relative-path lookup of node_modules/@anthropic-ai/...
// when Tauri bundles the directory, because the bundler doesn't follow
// symlinks. Plain npm produces a flat layout that copies cleanly.
//
// --omit=dev: prod deps only.
// --no-audit / --no-fund: noisy output we don't care about in CI.
execSync(
  "npm install --omit=dev --no-audit --no-fund --no-package-lock",
  { cwd: dest, stdio: "inherit" },
);

// Sanity-check the wrapper exists. If npm changed its bin layout we'd
// rather fail the build than ship a broken installer.
const unixBin = join(dest, "node_modules", ".bin", "claude");
const winBin = join(dest, "node_modules", ".bin", "claude.cmd");
if (!existsSync(unixBin) && !existsSync(winBin)) {
  console.error(
    "package-claude-cli: expected wrapper at node_modules/.bin/claude(.cmd) — npm install layout changed?",
  );
  process.exit(1);
}

console.log("package-claude-cli: done");
