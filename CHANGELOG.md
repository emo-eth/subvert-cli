# Changelog

## Unreleased

- Add `-V` as a short alias for `--version`.
- Show scanned file counts in summaries (`3 replacements in 2 of 12 files`)
  and print `no matches found in N files` when nothing matched.
- Replace the raw `ENOENT` error with `path not found: <path>`.
- Print a usage hint when `FROM` and `TO` are missing, and refuse to wait on
  an interactive terminal when no paths and no piped input are given.
- Expand `--help` with quoting guidance, safety guarantees, and exit codes.
- Rewrite the README with a quick start, a safe preview-first workflow, an
  audit trail tip, and troubleshooting (including the `npx` brace-group bug).

## 0.1.2 - 2026-08-12

- Add `--version` to print the installed package version.
- Make release tags drive package versions and automated npm and GitHub releases.

## 0.1.1 - 2026-08-11

- Expand `--help` to explain how replacing works (literal brace pairs, case and
  identifier-style expansion) and to show usage examples.

## 0.1.0 - 2026-08-07

- Add literal Abolish brace-pair expansion.
- Add case-preserving and opt-in identifier-style mappings.
- Add Unicode-aware identifier, word, and anywhere boundaries.
- Add ignore-aware, hidden-safe, symbolic-link-safe file traversal.
- Add unified-diff previews, explicit writes, and standard-input filtering.
