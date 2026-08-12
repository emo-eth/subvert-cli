# Papercuts

Small frictions agents hit while working in this repository. These are not full bug reports; they are sandpaper notes for later cleanup.

## Entries

- **2026-08-12T15:43:39Z** `gpt-5.6-luna`
  - cwd: `.`
  - note: Running the focused typecheck and tests in the fresh worktree -> npm scripts failed because node_modules is not installed, so the required tsc binary was missing.
- **2026-08-12T17:36:29Z** `gpt-5.6-luna`
  - cwd: `.`
  - note: Pushing the release commit to main over the repository's HTTPS remote -> GitHub rejected the push because the active OAuth token lacks workflow scope; switching the local remote to the configured SSH protocol resolves it.
