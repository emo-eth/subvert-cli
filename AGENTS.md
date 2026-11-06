# AGENTS

## What this repo is

`subvert-cli` is a case-preserving, brace-aware search-and-replace CLI for files
and streams, inspired by vim-abolish's `:Subvert`. It previews unified diffs by
default and writes only with `--write`. The published npm package exposes the
`subvert` binary; it is CLI-only (no public library exports or type
declarations).

## Layout

```text
src/                 TypeScript sources (cli, runner, core, files, transform)
test/                Vitest tests
skills/subvert/      Agent skill for driving subvert (not published in the npm tarball)
dist/                Build output from `bun run build` (gitignored)
.github/workflows/   CI verify + npm publish (OIDC)
```

## Package manager

Development and CI use Bun. The lockfile is `bun.lock`. `packageManager` is
pinned to the Bun version used for this setup.

Publishing stays on npm (`npm publish`) for trusted publishing and OIDC
provenance (`id-token: write`). Bun cannot replace that step.

## Commands (verified)

```sh
bun install --frozen-lockfile
bun run test
bun run build
bun run verify
npm pack --dry-run
```

`bun run verify` runs lint, typecheck, test, and build. `npm pack` / `npm publish`
trigger `prepack` → `bun run build`, so Bun must be available when those npm
lifecycle scripts run.
