# subvert-cli

`subvert-cli` is a case-preserving, brace-aware search and replace command for files and streams. It is inspired by the `:Subvert` command in [vim-abolish](https://github.com/tpope/vim-abolish).

It previews every file change as a unified diff. It writes only when you add `--write`.

## Try it

Node.js 22 or newer is required. No install is needed:

```sh
printf 'Facility facilities\n' | bunx subvert-cli 'facilit{y,ies}' 'building{,s}'
```

Output:

```text
Building buildings
```

Two rules for a first try:

- Always quote `FROM` and `TO`. Without quotes, the shell expands `{a,b}` groups before `subvert` sees them.
- `npx subvert-cli` mangles brace groups even when quoted. This is a known npx argument bug, not a `subvert` bug. Use `bunx subvert-cli` or a global install for any rename that uses `{...}`. Plain renames without braces work through `npx`.

## Install

```sh
npm install --global subvert-cli
```

The npm package provides the `subvert` command.

## Usage

```text
subvert [OPTIONS] FROM TO [PATH...]
```

```text
      --write                              Apply changes instead of printing a diff
      --case abolish|exact                 Case mapping mode (default: abolish)
      --styles LIST                        camel,pascal,snake,upper-snake,kebab,dot or identifier
      --boundary identifier|anywhere|word  Match boundary (default: identifier)
      --hidden                             Include hidden files during folder scans
      --no-ignore                          Do not apply .gitignore rules
  -V, --version                            Show the installed version
  -h, --help                               Show help
```

`LIST` accepts `camel`, `pascal`, `snake`, `upper-snake`, `kebab`, and `dot`. Use `identifier` as an alias for all six styles.

## The safe workflow

Use this loop for any rename across files:

1. **Preview.** Run without `--write`. This is read-only. It prints a unified diff to standard output and a summary to standard error:

   ```sh
   subvert facility building src
   ```

2. **Read the diff.** Confirm only the changes you want appear. Unexpected hunks mean `FROM`, the case mode, or the styles are too broad.

3. **Apply.** Add `--write`:

   ```sh
   subvert --write facility building src
   ```

4. **Check for stragglers.** Run the preview again and search for the old name:

   ```sh
   subvert facility building src
   git grep -n -i facility src
   ```

The summary line tells you the scope of the run:

```text
subvert: 3 replacements in 2 of 12 files; preview only, use --write to apply
```

This means 12 files were scanned and 2 of them changed. `no matches found in 12 files` means nothing matched and nothing was written.

Exit code 0 does not prove a replacement happened. `subvert` exits 0 when nothing matches. Check the summary line or the diff.

To keep an audit record, save the preview diff:

```sh
subvert facility building src > rename.diff
```

## Standard input

With no paths, `subvert` reads standard input and writes the transformed text to standard output:

```sh
printf 'Facility facilities\n' | subvert 'facilit{y,ies}' 'building{,s}'
```

`--write` is not valid in standard-input mode. If there are no paths and nothing is piped in, `subvert` prints a hint and exits instead of waiting for input.

## Brace pairs

Brace groups define literal source and target pairs. They are not regular expressions.

```sh
subvert 'facilit{y,ies}' 'building{,s}' src
```

This creates these exact pairs before case handling:

```text
facility   -> building
facilities -> buildings
```

An empty target group copies the selected source branch:

```text
pre{a,b}{1,2} -> post{x,y}{}
prea1          -> postx1
prea2          -> postx2
preb1          -> posty1
preb2          -> posty2
```

When a target group has fewer choices, its choices repeat:

```text
{a,b,c,d} -> {x,y}
a         -> x
b         -> y
c         -> x
d         -> y
```

Expansion is limited to 10,000 mappings. Empty sources, malformed groups, and conflicting mappings are errors.

## Case and identifier styles

The default `--case abolish` mode adds lowercase, initial-capital, and uppercase forms. It changes case only; it does not change separators or identifier style.

Use `--case exact` to keep only exact brace mappings:

```sh
subvert --case exact old_name new_name src
```

Identifier styles are opt-in:

```sh
subvert --case exact --styles identifier user_profile account_record src
```

This can match and replace all of these forms at the same time:

```text
userProfile   -> accountRecord
UserProfile   -> AccountRecord
user_profile  -> account_record
USER_PROFILE  -> ACCOUNT_RECORD
user-profile  -> account-record
user.profile  -> account.record
```

All mappings are applied at the same time. Longer overlapping sources take priority, so replacements do not cascade into later replacements.

## Boundaries

`--boundary identifier` is the default. Punctuation and separators form name edges. A lowercase-letter or number to uppercase-letter change also forms an edge, as in `userProfile`.

`--boundary word` uses whole words. Unicode letters, Unicode numbers, and underscore are word characters.

`--boundary anywhere` permits matches inside larger words.

Boundary checks use Unicode letters and numbers.

## File safety

Folder scans:

- Honor nested `.gitignore` files by default.
- Skip hidden files by default.
- Never traverse `.git` repository metadata.
- Never follow symbolic links.
- Skip binary data and invalid UTF-8 with a warning.

Use `--hidden` to include hidden files and `--no-ignore` to disable `.gitignore` rules. An explicit file path overrides hidden and ignore rules, but it does not override `.git` protection or symbolic-link protection.

Subvert reads and transforms every candidate before it writes any file. Existing line endings and file permissions are preserved.

## Exit codes

```text
0  Success, including no matches
1  A file could not be read, planned, or written
2  Invalid options or patterns
```

## Troubleshooting

**`subvert: path not found: building` after a brace command.** The shell or the runner split the `{...}` group, and a fragment became a path argument. Quote `FROM` and `TO`. If you used `npx`, switch to `bunx` or a global install.

**Nothing changed.** Exit code 0 includes the no-match case. Read the summary line: `no matches found in N files` means the pattern matched nothing. Check the spelling of `FROM`, the case mode, and the boundary.

**Files you expected were not scanned.** Folder scans skip hidden files and `.gitignore` matches by default. Use `--hidden` and `--no-ignore` deliberately.

## Library use

`subvert-cli` is a command-line package only. It does not provide a public JavaScript or TypeScript library interface, and it does not publish type declarations.

## Credit and license

The brace-pair and case-preserving behavior is inspired by Tim Pope's [vim-abolish](https://github.com/tpope/vim-abolish). This project is an independent command-line implementation and is not affiliated with vim-abolish.

`subvert-cli` is available under the [MIT License](LICENSE).
