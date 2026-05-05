# ADR-0009: Bundle the Claude Code CLI inside the Builder installer

**Status**: accepted, 2026-05-04.
**Relates to**: ADR-0002 (CLI as auth backend), ADR-0005 (Agent SDK in sidecar).

## Context

ADR-0005 commits the Builder to running the Claude Agent SDK in the Node sidecar; the SDK in turn shells out to the locally-installed `claude` CLI for auth. Phase F's "novice readiness" pass and live novice testing have surfaced one repeating cliff: **the install path for the CLI assumes the novice already has Node + npm, knows how to open a terminal, and can run `npm install -g`**. None of that is safe to assume for our primary user (per `spec.md` §1).

Today's failure modes seen in testing:
- Novice downloads the Builder, double-clicks, sees "install Claude Code" — the in-product copy says `npm install -g @anthropic-ai/claude-code`, which is meaningless to someone who has never opened a terminal.
- Novice has the **Claude desktop app** installed (a different product) and assumes it counts. Welcome screen says "missing"; novice gets stuck.
- Novice installs Node from nodejs.org, runs the npm command, but the Builder still says "missing" because the Finder-launched `.app` inherits a minimal PATH that doesn't include the npm-global bin folder. (The login-shell PATH augmentation in `augment_path_from_login_shell()` mitigates but doesn't eliminate this on first launch.)

Each of these is solvable by the welcome-screen copy + diagnostics that ship in this commit (ADR-0008-equivalent, light touch). But none of them remove the underlying dependency: the novice must obtain the CLI themselves. This ADR commits to closing that gap.

We considered:
- **A. Bundle the CLI inside the installer**, via `npm pack`-style vendoring into `src-tauri/claude-cli-bundle/`, exposed through Tauri's `bundle.resources` and resolved at runtime as a fallback when no system install is found.
- **B. Bundle Node *and* the CLI** (so novices don't need Node either). Larger installer (+45-70 MB on top of A), but removes the Node-install step entirely.
- **C. Status quo** (light-touch UX only): better install copy + Node detection.

A wins for the immediate Phase F goal because the installer footprint cost is ~30 MB (the CLI + its prod deps) and the Builder already requires Node for the sidecar (`spawn_sidecar` calls `Command::new("node")`). C alone leaves the cliff in place. B is the right end-state but warrants its own follow-up ADR; it touches the Tauri build pipeline more invasively (per-platform Node binaries, code signing, updater feed size) and shouldn't gate this fix.

## Decision

Ship a vendored copy of `@anthropic-ai/claude-code` inside the Tauri installer at `Resources/claude-cli-bundle/`. The runtime resolver looks for it as a **last-resort fallback**, after PATH, login-shell PATH, and well-known install locations.

### Concretely

- **New script**: `scripts/package-claude-cli.mjs` runs before `tauri build` (wired via `package.json`'s `prebuild`), `npm install`s the CLI into `src-tauri/claude-cli-bundle/` with a flat hoisted layout that Tauri's bundler can copy cleanly.
- **Tauri config**: `tauri.conf.json` `bundle.resources` adds `"claude-cli-bundle": "claude-cli-bundle"`. The directory ships under `Resources/` in the packaged `.app` / `.msi` / `.AppImage`.
- **Rust resolver**: a static `OnceLock<Option<PathBuf>>` is set during `setup()` from `app.path().resource_dir()`. `bundled_claude_paths()` reads it and returns the npm-generated wrapper path (`<root>/node_modules/.bin/claude` on Unix; `claude.cmd` on Windows). The wrapper script is what `npm install` already produces — we don't construct one ourselves.
- **Resolution order** (system install wins to respect novice's own version + auth):
  1. PATH (`which claude`)
  2. Login-shell PATH (`zsh -ilc 'command -v claude'`)
  3. Well-known install locations (Homebrew, npm-global, Bun, Volta, asdf, etc.)
  4. **Bundled fallback** (this ADR)
- **Auth UX unchanged**: the bundled CLI writes its auth state to `~/.claude/` exactly like a system install. The novice still runs `claude` once in a terminal to sign in — but they can do so against either the system CLI *or* the bundled wrapper (whichever the resolver picks). A future improvement could spawn `bundled-claude /login` from inside the Builder UI and capture the device-code flow without a terminal at all (Phase 2).

### Out of scope for this ADR

- **Bundling Node itself**: tracked separately. The current decision still requires the novice to have Node (for the sidecar). When Node is bundled, the bundled-CLI path becomes self-sufficient.
- **In-app login flow**: spawning `claude /login` from a Builder-managed terminal pane to remove the "open Terminal" step. Phase 2 follow-up.
- **Auto-update of the bundled CLI**: the bundled version is whatever was vendored at Builder build time. Updates ride the Tauri updater feed for now. If the CLI's release cadence is faster than the Builder's, we'll add a separate updater channel; not needed at v0.1.

## Consequences

**Wins**
- Novices who don't have Node installed can still get a working CLI (until Node bundling lands, they still need Node — see *Caveats*). Until then, novices who have Node but not the CLI now skip the `npm install -g` step entirely.
- Recovery story for "I uninstalled the CLI by accident": bundled fallback transparently keeps the Builder working.
- Disambiguation copy (this commit's light-touch piece) plus the bundled fallback together cover the most common stuck-on-Welcome cases.

**Losses**
- Installer size grows by ~25-35 MB per platform (the CLI + its prod node_modules). NFR `spec.md` §6 says "Installer size: under 25 MB per platform" — **this ADR breaks that NFR**. We'll either revise the NFR (preferred — the original number predates the SDK + sidecar packaging requirements) or compress more aggressively in the bundler. Either way, this is an explicit trade-off, not silent drift.
- Vendored CLI version drifts from upstream. Mitigation: pin the version in `package-claude-cli.mjs`, bump on every Builder release, list it in the SBOM (rule O28-equivalent).
- `prebuild` now runs an `npm install` against the public registry. CI must have network access at build time. No new secrets needed.
- Two CLI installs on disk for the user who already has one. The resolver prefers their system install; the bundled copy is dormant. Disk cost is bounded by the bundle size.

**Caveats**
- The bundled CLI is a Node script (`#!/usr/bin/env node` shebang on Unix; `node ... %*` wrapper on Windows). It *requires* a working `node` on PATH to execute. Today this is fine because the Builder already requires Node for the sidecar — same prerequisite, surfaced once.
- If the resolver picks the bundled CLI but the novice's `~/.claude/` is empty, the auth-diagnostics path still classifies as `unauthenticated` and the welcome screen instructs them to run `claude` to sign in. The bundled wrapper is on `Resources/.../node_modules/.bin/claude`, which won't be on the novice's PATH; the welcome copy needs to either (a) tell them to use their system terminal anyway (anyone they sign into shares `~/.claude/`), or (b) wait for the in-app login flow (Phase 2).

## Affected files

- [scripts/package-claude-cli.mjs](../../scripts/package-claude-cli.mjs) — new vendoring script
- [src-tauri/tauri.conf.json](../../src-tauri/tauri.conf.json) — `bundle.resources` adds `claude-cli-bundle`
- [src-tauri/src/lib.rs](../../src-tauri/src/lib.rs) — `BUNDLED_CLAUDE_CLI_DIR` static, `bundled_claude_paths`, resolver chain, `setup()` initialization
- [package.json](../../package.json) — `prebuild` hook wires `package-claude-cli.mjs`
- [spec.md](../../spec.md) §6 — installer-size NFR revisited (or accepted drift logged in `docs/drift-log.md`)
