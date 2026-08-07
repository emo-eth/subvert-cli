import { lstat, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { createTwoFilesPatch } from "diff"
import { globby } from "globby"
import { type BoundaryMode, transformText } from "./transform.js"

export interface DiscoveryOptions {
  cwd: string
  hidden: boolean
  noIgnore: boolean
}

export type SkipReason =
  | "repository-metadata"
  | "symbolic-link"
  | "binary"
  | "invalid-utf8"

export interface SkippedFile {
  path: string
  reason: SkipReason
}

export interface DiscoveryResult {
  files: string[]
  skipped: SkippedFile[]
}

export interface FileChange {
  path: string
  before: string
  after: string
  count: number
}

export interface FileChangePlan {
  changes: FileChange[]
  skipped: SkippedFile[]
}

export function renderUnifiedDiff(changes: FileChange[], cwd: string): string {
  return changes
    .map((change) => {
      const relative = path.relative(cwd, change.path)
      const label =
        relative !== "" &&
        relative !== ".." &&
        !relative.startsWith(`..${path.sep}`)
          ? relative
          : change.path
      const portableLabel = label.split(path.sep).join("/").replace(/^\//, "")
      return createTwoFilesPatch(
        `a/${portableLabel}`,
        `b/${portableLabel}`,
        change.before,
        change.after,
        "",
        "",
        { context: 3 },
      ).trimEnd()
    })
    .join("\n")
}

export async function applyFileChanges(changes: FileChange[]): Promise<void> {
  for (const change of changes) {
    await writeFile(change.path, change.after, "utf8")
  }
}

export async function planFileChanges(
  files: string[],
  replacements: ReadonlyMap<string, string>,
  boundary: BoundaryMode,
): Promise<FileChangePlan> {
  const changes: FileChange[] = []
  const skipped: SkippedFile[] = []
  const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true })

  for (const file of [...files].sort((left, right) =>
    left.localeCompare(right),
  )) {
    const bytes = await readFile(file)
    if (bytes.includes(0)) {
      skipped.push({ path: file, reason: "binary" })
      continue
    }

    let before: string
    try {
      before = decoder.decode(bytes)
    } catch {
      skipped.push({ path: file, reason: "invalid-utf8" })
      continue
    }
    if (looksBinary(before)) {
      skipped.push({ path: file, reason: "binary" })
      continue
    }

    const transformed = transformText(before, replacements, boundary)
    if (transformed.count > 0) {
      changes.push({
        path: file,
        before,
        after: transformed.text,
        count: transformed.count,
      })
    }
  }

  return { changes, skipped }
}

export async function discoverFiles(
  paths: string[],
  options: DiscoveryOptions,
): Promise<DiscoveryResult> {
  const files = new Set<string>()
  const skipped: SkippedFile[] = []

  for (const input of paths) {
    const absolute = path.resolve(options.cwd, input)
    if (isGitMetadata(absolute)) {
      skipped.push({ path: absolute, reason: "repository-metadata" })
      continue
    }

    const stats = await lstat(absolute)
    if (stats.isSymbolicLink()) {
      skipped.push({ path: absolute, reason: "symbolic-link" })
      continue
    }
    if (stats.isFile()) {
      files.add(absolute)
      continue
    }
    if (!stats.isDirectory()) continue

    const discovered = await globby("**/*", {
      cwd: absolute,
      absolute: true,
      onlyFiles: false,
      dot: options.hidden,
      gitignore: !options.noIgnore,
      followSymbolicLinks: false,
      ignore: ["**/.git", "**/.git/**"],
    })
    for (const file of discovered) {
      const resolved = path.resolve(file)
      if (isGitMetadata(resolved)) continue
      const discoveredStats = await lstat(resolved)
      if (discoveredStats.isSymbolicLink()) {
        skipped.push({ path: resolved, reason: "symbolic-link" })
      } else if (discoveredStats.isFile()) {
        files.add(resolved)
      }
    }
  }

  return {
    files: [...files].sort((left, right) => left.localeCompare(right)),
    skipped: skipped.sort((left, right) => left.path.localeCompare(right.path)),
  }
}

function isGitMetadata(file: string): boolean {
  return file.split(path.sep).includes(".git")
}

function looksBinary(text: string): boolean {
  let suspiciousCharacters = 0
  for (const character of text) {
    const codePoint = character.codePointAt(0) ?? 0
    const isAllowedWhitespace =
      codePoint === 0x09 ||
      codePoint === 0x0a ||
      codePoint === 0x0c ||
      codePoint === 0x0d
    if ((codePoint < 0x20 && !isAllowedWhitespace) || codePoint === 0x7f) {
      suspiciousCharacters += 1
    }
  }

  return suspiciousCharacters > 0 && suspiciousCharacters / text.length >= 0.1
}
