export type BoundaryMode = "identifier" | "anywhere" | "word"

export interface TransformResult {
  text: string
  count: number
}

export function transformText(
  text: string,
  replacements: ReadonlyMap<string, string>,
  boundary: BoundaryMode,
): TransformResult {
  const sources = [...replacements.keys()].sort(
    (left, right) => right.length - left.length || left.localeCompare(right),
  )
  if (sources.length === 0) return { text, count: 0 }

  const pattern = new RegExp(sources.map(escapeRegExp).join("|"), "gu")
  let count = 0
  const transformed = text.replace(pattern, (match, offset: number) => {
    if (!matchesBoundary(text, offset, offset + match.length, boundary)) {
      return match
    }
    count += 1
    return replacements.get(match) ?? match
  })
  return { text: transformed, count }
}

function matchesBoundary(
  text: string,
  start: number,
  end: number,
  mode: BoundaryMode,
): boolean {
  if (mode === "anywhere") return true

  const previous = previousCharacter(text, start)
  const next = nextCharacter(text, end)
  if (mode === "word") {
    return !isWordCharacter(previous) && !isWordCharacter(next)
  }

  const first = nextCharacter(text, start)
  const last = previousCharacter(text, end)
  const startsAtBoundary =
    previous === undefined ||
    !isIdentifierCharacter(previous) ||
    (isLowercaseOrNumber(previous) && isUppercase(first))
  const endsAtBoundary =
    next === undefined ||
    !isIdentifierCharacter(next) ||
    (isLowercaseOrNumber(last) && isUppercase(next))
  return startsAtBoundary && endsAtBoundary
}

function previousCharacter(text: string, index: number): string | undefined {
  if (index <= 0) return undefined
  let start = index - 1
  const codeUnit = text.charCodeAt(start)
  if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff && start > 0) start -= 1
  return text.slice(start, index)
}

function nextCharacter(text: string, index: number): string | undefined {
  const codePoint = text.codePointAt(index)
  return codePoint === undefined ? undefined : String.fromCodePoint(codePoint)
}

function isWordCharacter(value: string | undefined): boolean {
  return value !== undefined && /^[\p{L}\p{N}_]$/u.test(value)
}

function isIdentifierCharacter(value: string | undefined): boolean {
  return value !== undefined && /^[\p{L}\p{N}]$/u.test(value)
}

function isLowercaseOrNumber(value: string | undefined): boolean {
  return value !== undefined && /^(?:\p{Ll}|\p{N})$/u.test(value)
}

function isUppercase(value: string | undefined): boolean {
  return value !== undefined && /^\p{Lu}$/u.test(value)
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
