---
name: subvert
description: "Use subvert-cli (the `subvert` command) for large, case-preserving, brace-aware search and replace across files. Use when renaming an identifier, symbol, term, or user-facing string that appears in several case forms, plurals, or separator styles and you want a safe preview-then-write workflow instead of hand-editing or blind sed."
license: MIT
---

# Subvert (subvert-cli)

`subvert` is a case-preserving, brace-aware search and replace command for files
and streams. It is an independent implementation of the `:Subvert` behavior from
vim-abolish. It is for big renames where a name appears in many forms: `User`,
`user`, `USER`, `userProfile`, `user_profile`, and plurals like `users` or
`userProfiles`.

It **previews** every file change as a unified diff. It writes to files only
when you pass `--write`.

## Before you start

The npm package is `subvert-cli`. The installed command is `subvert`. Node.js 22
or newer is required.

### How to run it

Prefer a global install for interactive work, or run it on demand:

```sh
# global (installs the `subvert` command)
npm install --global subvert-cli

# on demand, no install
bunx subvert-cli --help
npx -y subvert-cli --help
```

Check what is installed with `subvert --version` (or `-V`).

Run subvert once in the repository you are renaming. With no path arguments it
reads standard input and writes the transformed text to standard output:

```sh
printf 'Facility facilities\n' | bunx subvert-cli 'facilit{y,ies}' 'building{,s}'
# Building buildings
```

### Known runner quirk: `npx` mangles brace groups

`npx subvert-cli ...` splits arguments containing `{...}` even when they are
quoted (verified against 0.1.2). A brace fragment like `building` is then
treated as a file path and the run fails with
`subvert: path not found: building` (a raw `ENOENT` on 0.1.2 and earlier).
Plain (non-brace) replacements work fine through `npx`.

Workaround: use `bunx subvert-cli`, or a global `subvert` install, for any
rename whose `FROM` or `TO` uses brace groups. Prefer `bunx` by default so the
command is identical on every machine.

Separately, always quote `FROM` and `TO`. An unquoted `{a,b}` group is
expanded by the shell itself before subvert sees it, with the same
`path not found` symptom.

## Preview first — the rename is the task

Do not spend turns reading project state, historical exceptions, or diffing by
hand before running subvert. A subvert call **without** `--write` is read-only:
it reads every file, transforms in memory, and prints a unified diff. It writes
nothing. The preview is both the plan and the verification, so run it first
thing.

If you catch yourself planning "the subvert invocation" or "the rename scope",
skip the planning and run the preview. It is the fastest way to learn exactly
what the tool would change, and it cannot modify anything. Then read the diff,
adjust `--case`/`--styles`/`--boundary` if needed, and only then `--write`.

## Fast answers to the usual cautions

The concerns that make agents hesitate are usually settled by the tool, not by
hand-auditing the repo. Resolve them in seconds, then preview.

- **Documented exceptions** — if the repo notes files to leave alone, trust
  that note without re-reading the whole project state. Exclude those files by
  passing an explicit path list, or by letting `.gitignore` / the default
  hidden-file skip handle them.
- **Credential files (`.env`, `.env.local`)** — these are hidden dotfiles, so
  the default folder scan skips them. Confirm the diff has no `.env*` hunks;
  do not pre-read the secrets.
- **Generated / fixture / evaluation files** — the default scan honors
  `.gitignore` and skips hidden files. If a fixture is deliberately unignored,
  scope `PATH` to the trees you mean to change rather than reasoning about it
  in the abstract.
- **Historical rename notes / docs that mention the old name** — if a doc is
  meant to track the current name, let subvert rename it too. Exclude it only
  when the note is explicitly historical and must keep the old spelling.

## Core workflow for a big rename

Drive renames as a preview-then-write loop: exclude the exceptions, preview,
review the summary, apply, then run the checks. Never go straight to `--write`
on a folder scan you have not reviewed.

1. **Exclude the exceptions.** Apply the documented exceptions and file-safety
   scoping (see "Fast answers to the usual cautions") so the right trees are in
   scope before you look at a diff.
2. **Scope the variants.** Find where the name appears and in which forms, so
   you know what `--case` and `--styles` settings will cover:

   ```sh
   git grep -n -E 'facility|facilities|Facility|FACILITY' src
   ```

3. **Preview.** Run without `--write`. This prints a unified diff of every
   planned change and a summary line like
   `2 replacements in 2 of 12 files; preview only, use --write to apply` —
   the second number is how many files were scanned. When nothing matches,
   the summary is `no matches found in N files` and nothing is written:

   ```sh
   subvert --case abolish --styles identifier facility showing src
   ```

4. **Read the diff.** Confirm only intended changes appear. Unexpected hunks
   mean your `FROM`, case mode, or styles are too broad.

5. **Apply.** Add `--write`:

   ```sh
   subvert --write facility showing src
   ```

6. **Catch stragglers.** Re-run the preview (no `--write`) and a scope check to
   confirm nothing was missed and nothing over-matched:

   ```sh
   subvert facility showing src
   git grep -n -i -E 'facility|facilities' src
   ```

7. **Verify.** Run the project's build and tests. Exits `0` even when there are
   no matches, so a zero exit is not proof of a replacement — check the summary
   line (`no matches found in N files` means nothing happened) and the diff.

## Options

```text
subvert [OPTIONS] FROM TO [PATH...]

      --write                              Apply changes instead of printing a diff
      --case abolish|exact                 Case mapping mode (default: abolish)
      --styles LIST                        camel,pascal,snake,upper-snake,kebab,dot or identifier
      --boundary identifier|anywhere|word  Match boundary (default: identifier)
      --hidden                             Include hidden files during folder scans
      --no-ignore                          Do not apply .gitignore rules
  -V, --version                            Show the installed version
  -h, --help                               Show help
```

- `FROM` and `TO` are literal text and may contain brace groups (`{a,b}`).
  They are not regular expressions.
- `PATH...` may be files or folders. With no paths, subvert reads stdin and
  writes stdout.
- `--write` is not valid in stdin mode.

## Case and identifier styles

- `--case abolish` (default) adds lowercase, initial-capital, and uppercase
  forms of each mapping. It changes case only — it does not change separators
  or identifier style. Example: `facility -> building` also rewrites
  `Facility -> Building` and `FACILITY -> BUILDING`.
- `--case exact` keeps only the exact `FROM`/`TO` pair, plus the identifier
  styles you enable.

Identifier styles are opt-in and let one rename cover every separator style at
once:

```sh
subvert --case exact --styles identifier user_profile account_record src
```

This rewrites all of these in a single pass:

```text
userProfile   -> accountRecord
UserProfile   -> AccountRecord
user_profile  -> account_record
USER_PROFILE  -> ACCOUNT_RECORD
user-profile  -> account-record
user.profile  -> account.record
```

`identifier` is an alias for the six styles: `camel`, `pascal`, `snake`,
`upper-snake`, `kebab`, and `dot`. All mappings apply at once; longer
overlapping sources win, so replacements do not cascade into each other.

## Boundaries

- `--boundary identifier` (default) treats punctuation and separators as name
  edges, and a lowercase-letter/number-to-uppercase change as an edge too. This
  is what lets `userProfile` be matched as one identifier.
- `--boundary word` uses whole words: Unicode letters, Unicode numbers, and
  underscore.
- `--boundary anywhere` permits matches inside larger words.

Choose `identifier` for symbol/code renames and `word` for prose.

## Brace groups

Brace groups define literal source and target pairs — they are not regexes.

```sh
subvert 'facilit{y,ies}' 'building{,s}' src
```

This creates the pairs `facility -> building` and `facilities -> buildings`
before case handling.

Usable forms:

- An empty target group `{}` copies the selected source branch, so
  `pre{a,b}{1,2} -> post{x,y}{}` keeps the source suffix.
- A target group with fewer choices repeats them, so `{a,b,c,d} -> {x,y}`
  maps `a,b -> x` and `c,d -> y`.

Expansion is capped at 10,000 mappings. Empty sources, malformed groups, and
conflicting mappings are errors.

## stdin and streams

With no paths, subvert transforms stdin to stdout:

```sh
cat file.txt | subvert 'User' 'Account' > transformed.txt
```

`--write` is rejected in this mode.

## File safety

Folder scans, by default:

- honor nested `.gitignore` files;
- skip hidden files;
- never traverse `.git` metadata;
- never follow symbolic links;
- skip binary data and invalid UTF-8 with a warning.

`--hidden` includes hidden files; `--no-ignore` disables `.gitignore` rules. An
explicit file path overrides hidden/ignore rules but not the `.git` or symlink
protection. Subvert reads and transforms every candidate before writing any
file, and it preserves line endings and file permissions.

## Exit codes

- `0` success, including no matches
- `1` a file could not be read, planned, or written
- `2` invalid options or patterns

## Rules of thumb

- Preview before writing on any folder-wide scan. `--write` is a permanent,
  cross-file change.
- A `0` exit does not mean anything was replaced — check the summary
  (`N replacements in X of Y files`, or `no matches found in N files`) or the
  diff, and re-grep for stragglers.
- Use `bunx subvert-cli` (or a global install) rather than `npx` when `FROM` or
  `TO` uses brace groups.
- Confirm file-safety defaults fit the target: for generated/vendor trees you
  may need `--no-ignore --hidden`, and that is a deliberate scope decision.