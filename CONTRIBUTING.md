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

## Release

The release tag is the source of truth for the package version. Do not bump
`package.json` manually for a release.

After changes are merged to `main`, push a semantic version tag:

```sh
git tag v0.1.3
git push origin v0.1.3
```

The tag workflow automatically:

1. Sets `package.json` and `package-lock.json` to the tag version.
2. Runs `npm run verify`.
3. Publishes that version to npm.
4. Creates a GitHub Release with generated notes.

Use a new `vMAJOR.MINOR.PATCH` tag for each release. Do not create the GitHub
Release manually.

## Report a problem

Open an issue at <https://github.com/emo-eth/subvert-cli/issues>. Include the command, operating system, Node.js version, expected result, and actual result. Do not include private source code unless you have permission to share it.
