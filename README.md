# subvert-cli

`subvert-cli` is a case-preserving, brace-aware search and replace command for files and streams. It is inspired by the `:Subvert` command in [vim-abolish](https://github.com/tpope/vim-abolish).

It previews file changes as a unified diff. It writes only when you add `--write`.

## Install

Node.js 22 or newer is required.

```sh
npm install --global subvert-cli
```

You can also run it without a global install:

```sh
npx subvert-cli --help
```

The npm package provides the `subvert` command.

## Usage

```text
subvert [OPTIONS] FROM TO [PATH...]
```

```text
      --write                              Apply changes instead of printing a diff
      --case abolish|exact                 Case mapping mode (default: abolish)
      --styles LIST                        Comma-separated identifier styles
      --boundary identifier|anywhere|word  Match boundary (default: identifier)
      --hidden                             Include hidden files during folder scans
      --no-ignore                          Do not apply .gitignore rules
  -h, --help                               Show help
```

`LIST` accepts `camel`, `pascal`, `snake`, `upper-snake`, `kebab`, and `dot`. Use `identifier` as an alias for all six styles.

## Preview and write

Preview changes in a folder:

```sh
subvert facility building src
```

Apply the same changes:

```sh
subvert --write facility building src
```

File mode prints summaries and warnings to standard error. Preview mode prints a plain unified diff to standard output.

With no paths, `subvert` reads standard input and writes the transformed text to standard output:

```sh
printf 'Facility facilities\n' | subvert 'facilit{y,ies}' 'building{,s}'
```

Output:

```text
Building buildings
```

`--write` is not valid in standard-input mode.

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

## Library use

Version 0.1.0 is a command-line package only. It does not provide a public JavaScript or TypeScript library interface, and it does not publish type declarations.

## Credit and license

The brace-pair and case-preserving behavior is inspired by Tim Pope's [vim-abolish](https://github.com/tpope/vim-abolish). This project is an independent command-line implementation and is not affiliated with vim-abolish.

`subvert-cli` is available under the [MIT License](LICENSE).
