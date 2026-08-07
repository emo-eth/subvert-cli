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

Case-preserving, brace-aware search and replace for files and streams.

Options:
      --write                              Apply changes instead of printing a diff
      --case abolish|exact                 Case mapping mode (default: abolish)
      --styles LIST                        camel,pascal,snake,upper-snake,kebab,dot or identifier
      --boundary identifier|anywhere|word  Match boundary (default: identifier)
      --hidden                             Include hidden files during folder scans
      --no-ignore                          Do not apply .gitignore rules
  -h, --help                               Show this help
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
