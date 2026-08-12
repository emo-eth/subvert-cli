import { parseArgs } from "node:util"
import {
  type CaseMode,
  createReplacementMap,
  type IdentifierStyle,
} from "./core.js"
import {
  applyFileChanges,
  discoverFiles,
  planFileChanges,
  renderUnifiedDiff,
  type SkippedFile,
} from "./files.js"
import { type BoundaryMode, transformText } from "./transform.js"

export interface CliIo {
  cwd: string
  readStdin: () => Promise<string>
  writeStdout: (text: string) => void
  writeStderr: (text: string) => void
}

const usage = `Usage: subvert [OPTIONS] FROM TO [PATH...]

Case-preserving, brace-aware search and replace for files and streams,
inspired by vim-abolish :Subvert. Every change is previewed as a unified diff;
files are written only when you pass --write.

HOW IT WORKS
FROM and TO are literal text, not regular expressions. TO may contain brace
groups ({a,b}) that create several source -> target pairs at once, useful for
plurals: 'facilit{y,ies}' -> 'building{,s}'. Each pair is then expanded into
the case and identifier-style forms you choose and replaced exactly. Longer
overlapping sources win, so replacements never cascade into each other.

SYNTAX
  FROM   literal text to find (may contain {a,b} brace groups)
  TO     literal replacement (a brace group may be empty: {} copies the source)
  PATH   files and folders to scan; omit to read stdin and write stdout

OPTIONS
      --write                              Apply changes instead of printing a diff
      --case abolish|exact                 Case mapping mode (default: abolish)
      --styles LIST                        camel,pascal,snake,upper-snake,kebab,dot or identifier
      --boundary identifier|anywhere|word  Match boundary (default: identifier)
      --hidden                             Include hidden files during folder scans
      --no-ignore                          Do not apply .gitignore rules
  -h, --help                               Show this help

CASE AND STYLES
--case abolish (default) also matches the lowercase, initial-capital, and
uppercase forms of each pair (facility, Facility, FACILITY). --styles
identifier (short for all six styles) matches camelCase, PascalCase,
snake_case, UPPER_SNAKE, kebab-case, and dot.case at the same time, so one
command renames every spelling of a name.

EXAMPLES
  Preview a rename in a folder (read-only, prints a diff):
    subvert facility building src
  Apply the same rename:
    subvert --write facility building src
  Rename a name in every identifier style at once:
    subvert --case exact --styles identifier user_profile account_record src
  Plurals with brace pairs:
    subvert 'facilit{y,ies}' 'building{,s}' src
  Transform standard input (--write is not allowed in this mode):
    printf 'Facility facilities\\n' | subvert 'facilit{y,ies}' 'building{,s}'
`

const cliOptions = {
  write: { type: "boolean" },
  case: { type: "string" },
  styles: { type: "string" },
  boundary: { type: "string" },
  hidden: { type: "boolean" },
  "no-ignore": { type: "boolean" },
  help: { type: "boolean", short: "h" },
} as const

function parseCommandLine(args: string[]) {
  return parseArgs({
    args,
    allowPositionals: true,
    strict: true,
    options: cliOptions,
  })
}

export async function runCli(args: string[], io: CliIo): Promise<number> {
  let parsed: ReturnType<typeof parseCommandLine>
  try {
    parsed = parseCommandLine(args)
  } catch (error) {
    io.writeStderr(`subvert: ${errorMessage(error)}\n`)
    return 2
  }

  if (parsed.values.help) {
    io.writeStdout(usage)
    return 0
  }

  const [from, to, ...paths] = parsed.positionals
  if (from === undefined || to === undefined) {
    io.writeStderr("subvert: FROM and TO are required\n")
    return 2
  }

  let replacements: ReadonlyMap<string, string>
  let boundary: BoundaryMode
  try {
    const caseMode = parseCaseMode(parsed.values.case)
    const styles = parseStyles(parsed.values.styles)
    boundary = parseBoundary(parsed.values.boundary)
    replacements = createReplacementMap(from, to, { caseMode, styles })
  } catch (error) {
    io.writeStderr(`subvert: ${errorMessage(error)}\n`)
    return 2
  }

  if (paths.length === 0) {
    if (parsed.values.write) {
      io.writeStderr("subvert: --write requires at least one PATH\n")
      return 2
    }
    const input = await io.readStdin()
    io.writeStdout(transformText(input, replacements, boundary).text)
    return 0
  }

  try {
    const discovery = await discoverFiles(paths, {
      cwd: io.cwd,
      hidden: parsed.values.hidden ?? false,
      noIgnore: parsed.values["no-ignore"] ?? false,
    })
    const plan = await planFileChanges(discovery.files, replacements, boundary)
    writeSkipWarnings([...discovery.skipped, ...plan.skipped], io)

    const replacementCount = plan.changes.reduce(
      (total, change) => total + change.count,
      0,
    )
    const totals = `${formatCount(replacementCount, "replacement")} in ${formatCount(plan.changes.length, "file")}`
    if (parsed.values.write) {
      await applyFileChanges(plan.changes)
      io.writeStderr(
        `subvert: ${totals}; ${plan.changes.length > 0 ? "files updated" : "no files changed"}\n`,
      )
    } else {
      const diff = renderUnifiedDiff(plan.changes, io.cwd)
      if (diff !== "") io.writeStdout(`${diff}\n`)
      io.writeStderr(
        `subvert: ${totals}; preview only${plan.changes.length > 0 ? ", use --write to apply" : ""}\n`,
      )
    }
    return 0
  } catch (error) {
    io.writeStderr(`subvert: ${errorMessage(error)}\n`)
    return 1
  }
}

function writeSkipWarnings(skipped: SkippedFile[], io: CliIo): void {
  const sorted = [...skipped].sort((left, right) =>
    left.path.localeCompare(right.path),
  )
  for (const item of sorted) {
    io.writeStderr(`subvert: skipped ${item.path} (${item.reason})\n`)
  }
}

function formatCount(value: number, unit: string): string {
  return `${value} ${unit}${value === 1 ? "" : "s"}`
}

function parseCaseMode(value: string | undefined): CaseMode {
  if (value === undefined || value === "abolish") return "abolish"
  if (value === "exact") return "exact"
  throw new Error(`invalid case mode: ${value}`)
}

function parseStyles(value: string | undefined): IdentifierStyle[] {
  if (value === undefined) return []

  const validStyles = new Set<IdentifierStyle>([
    "camel",
    "pascal",
    "snake",
    "upper-snake",
    "kebab",
    "dot",
    "identifier",
  ])
  const styles = value.split(",")
  for (const style of styles) {
    if (!validStyles.has(style as IdentifierStyle)) {
      throw new Error(`invalid identifier style: ${style || "(empty)"}`)
    }
  }
  return styles as IdentifierStyle[]
}

function parseBoundary(value: string | undefined): BoundaryMode {
  if (value === undefined || value === "identifier") return "identifier"
  if (value === "anywhere" || value === "word") return value
  throw new Error(`invalid boundary mode: ${value}`)
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
