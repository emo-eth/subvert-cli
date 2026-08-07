export type CaseMode = "abolish" | "exact"
export type IdentifierStyle =
  | "camel"
  | "pascal"
  | "snake"
  | "upper-snake"
  | "kebab"
  | "dot"
  | "identifier"

export interface ReplacementMapOptions {
  caseMode: CaseMode
  styles: IdentifierStyle[]
}

interface ParsedPattern {
  literals: string[]
  groups: string[][]
}

const maximumMappings = 10_000

export function createReplacementMap(
  from: string,
  to: string,
  options: ReplacementMapOptions,
): Map<string, string> {
  const replacements = new Map<string, string>()
  const sourcePattern = parsePattern(from)
  const targetPattern = parsePattern(to)
  if (targetPattern.groups.length > sourcePattern.groups.length) {
    throw new Error("TO cannot contain more brace groups than FROM")
  }

  const pairs = expandPairs(sourcePattern, targetPattern)

  for (const [source, target] of pairs) {
    if (source.length === 0) {
      throw new Error("FROM must not expand to an empty string")
    }
    addReplacement(replacements, source, target)
    if (options.caseMode === "abolish") {
      const lowercaseSource = source.toLowerCase()
      const lowercaseTarget = target.toLowerCase()
      addReplacement(replacements, lowercaseSource, lowercaseTarget)
      addReplacement(
        replacements,
        capitalizeWord(lowercaseSource),
        capitalizeWord(lowercaseTarget),
      )
      addReplacement(replacements, source.toUpperCase(), target.toUpperCase())
    }

    const styles: Array<Exclude<IdentifierStyle, "identifier">> =
      options.styles.includes("identifier")
        ? (["camel", "pascal", "snake", "upper-snake", "kebab", "dot"] as const)
        : options.styles.filter((style) => style !== "identifier")
    for (const style of styles) {
      addReplacement(
        replacements,
        formatIdentifier(source, style),
        formatIdentifier(target, style),
      )
    }
  }

  return replacements
}

function addReplacement(
  replacements: Map<string, string>,
  source: string,
  target: string,
): void {
  if (replacements.has(source) && replacements.get(source) !== target) {
    throw new Error(`conflicting replacements for "${source}"`)
  }
  replacements.set(source, target)
  if (replacements.size > maximumMappings) {
    throw new Error(`generated more than ${maximumMappings} mappings`)
  }
}

function parsePattern(value: string): ParsedPattern {
  const literals: string[] = []
  const groups: string[][] = []
  let literalStart = 0

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index]
    if (character === "}") {
      throw new Error(`unmatched closing brace in pattern: ${value}`)
    }
    if (character !== "{") continue

    const close = value.indexOf("}", index + 1)
    if (close === -1) {
      throw new Error(`unmatched opening brace in pattern: ${value}`)
    }
    if (value.slice(index + 1, close).includes("{")) {
      throw new Error(`nested braces are not supported: ${value}`)
    }

    literals.push(value.slice(literalStart, index))
    groups.push(value.slice(index + 1, close).split(","))
    index = close
    literalStart = close + 1
  }

  literals.push(value.slice(literalStart))
  return { literals, groups }
}

function expandPairs(
  source: ParsedPattern,
  target: ParsedPattern,
): Array<[string, string]> {
  let expansionCount = 1
  for (const alternatives of source.groups) {
    expansionCount *= alternatives.length
    if (expansionCount > maximumMappings) {
      throw new Error(`FROM expands to more than ${maximumMappings} mappings`)
    }
  }

  const pairs: Array<[string, string]> = []
  const indexes: number[] = []

  const visit = (groupIndex: number): void => {
    if (groupIndex < source.groups.length) {
      const alternatives = source.groups[groupIndex] ?? []
      for (let index = 0; index < alternatives.length; index += 1) {
        indexes[groupIndex] = index
        visit(groupIndex + 1)
      }
      return
    }

    pairs.push([
      renderSource(source, indexes),
      renderTarget(source, target, indexes),
    ])
  }

  visit(0)
  return pairs
}

function renderSource(pattern: ParsedPattern, indexes: number[]): string {
  let result = pattern.literals[0] ?? ""
  for (
    let groupIndex = 0;
    groupIndex < pattern.groups.length;
    groupIndex += 1
  ) {
    const alternatives = pattern.groups[groupIndex] ?? []
    result += alternatives[indexes[groupIndex] ?? 0] ?? ""
    result += pattern.literals[groupIndex + 1] ?? ""
  }
  return result
}

function renderTarget(
  source: ParsedPattern,
  target: ParsedPattern,
  indexes: number[],
): string {
  let result = target.literals[0] ?? ""
  for (let groupIndex = 0; groupIndex < target.groups.length; groupIndex += 1) {
    const alternatives = target.groups[groupIndex] ?? []
    const sourceIndex = indexes[groupIndex] ?? 0
    const sourceChoice = source.groups[groupIndex]?.[sourceIndex] ?? ""
    const targetChoice =
      alternatives.length === 1 && alternatives[0] === ""
        ? sourceChoice
        : (alternatives[sourceIndex % alternatives.length] ?? "")
    result += targetChoice
    result += target.literals[groupIndex + 1] ?? ""
  }
  return result
}

function splitIdentifier(value: string): string[] {
  return value
    .replace(/([\p{Lu}]+)([\p{Lu}][\p{Ll}])/gu, "$1 $2")
    .replace(/([\p{Ll}\p{N}])([\p{Lu}])/gu, "$1 $2")
    .split(/[\s_.-]+/u)
    .filter(Boolean)
    .map((word) => word.toLowerCase())
}

function capitalizeWord(value: string): string {
  const [first = "", ...rest] = value
  return first.toUpperCase() + rest.join("")
}

function formatIdentifier(
  value: string,
  style: Exclude<IdentifierStyle, "identifier">,
): string {
  const words = splitIdentifier(value)
  switch (style) {
    case "camel":
      return (words[0] ?? "") + words.slice(1).map(capitalizeWord).join("")
    case "pascal":
      return words.map(capitalizeWord).join("")
    case "snake":
      return words.join("_")
    case "upper-snake":
      return words.join("_").toUpperCase()
    case "kebab":
      return words.join("-")
    case "dot":
      return words.join(".")
  }
}
