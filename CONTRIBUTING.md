# Contributing

## Requirements

- Node.js 22 or newer
- npm 11 or newer

## Set up

```sh
git clone https://github.com/emo-eth/subvert-cli.git
cd subvert-cli
npm ci
npm run verify
```

## Make a change

Add or update a test before you change behavior. Keep file operations safe by default and keep output deterministic across Linux, macOS, and Windows.

Run all checks before you open a pull request:

```sh
npm run verify
```

Use `npm pack --dry-run` to inspect the published files when you change package metadata or build output.

## Report a problem

Open an issue at <https://github.com/emo-eth/subvert-cli/issues>. Include the command, operating system, Node.js version, expected result, and actual result. Do not include private source code unless you have permission to share it.
