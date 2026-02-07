import rawWordlist from "../assets/wordlist/NWL2023.txt?raw"
import type { WordEntry } from "../types/crossword"

interface ParsedLine {
  word: string
  definition: string
}

/**
 * Parse a single line from NWL2023.txt
 * Format: "WORD definition [part-of-speech FORMS]"
 * Handles:
 *   - {variant=pos} references → replaces with the variant word
 *   - <ref=pos> references → replaces with the ref word
 *   - Multiple definitions separated by " / "
 */
function parseLine(line: string): ParsedLine | null {
  const trimmed = line.trim()
  if (!trimmed) return null

  // Split word from definition: first space separates them
  const spaceIdx = trimmed.indexOf(" ")
  if (spaceIdx === -1) return null

  const word = trimmed.slice(0, spaceIdx)
  let rest = trimmed.slice(spaceIdx + 1)

  // Take only the first definition if multiple (separated by " / ")
  const slashIdx = rest.indexOf(" / ")
  if (slashIdx !== -1) {
    rest = rest.slice(0, slashIdx)
  }

  // Remove the [part-of-speech FORMS] bracket at the end
  const bracketIdx = rest.lastIndexOf("[")
  if (bracketIdx !== -1) {
    rest = rest.slice(0, bracketIdx).trim()
  }

  // Replace {variant=pos} with just the variant word
  rest = rest.replace(/\{(\w+)=\w+\}/g, "$1")

  // Replace <ref=pos> with just the ref word
  rest = rest.replace(/<(\w+)=\w+>/g, "$1")

  // Clean up extra whitespace
  const definition = rest.trim()
  if (!definition) return null

  return { word, definition }
}

let cachedEntries: WordEntry[] | null = null

/**
 * Parse the full wordlist. Results are cached after first call.
 */
export function parseWordlist(): WordEntry[] {
  if (cachedEntries) return cachedEntries

  const lines = rawWordlist.split("\n")
  const entries: WordEntry[] = []

  for (const line of lines) {
    const parsed = parseLine(line)
    if (parsed) {
      entries.push({
        word: parsed.word,
        definition: parsed.definition,
      })
    }
  }

  cachedEntries = entries
  return entries
}

/**
 * Get random words suitable for crossword generation.
 * Filters to words between minLength and maxLength characters,
 * then picks a random count between minCount and maxCount.
 */
export function getRandomWords(
  minCount = 35,
  maxCount = 45,
  minLength = 3,
  maxLength = 15,
): WordEntry[] {
  const all = parseWordlist()

  // Filter to reasonable crossword word lengths
  const suitable = all.filter((e) => e.word.length >= minLength && e.word.length <= maxLength)

  // Determine how many words to pick
  const count = minCount + Math.floor(Math.random() * (maxCount - minCount + 1))

  // Shuffle using Fisher-Yates and take first `count`
  const shuffled = [...suitable]
  for (let idx = shuffled.length - 1; idx > 0; idx--) {
    const j = Math.floor(Math.random() * (idx + 1))
    ;[shuffled[idx], shuffled[j]] = [shuffled[j], shuffled[idx]]
  }

  return shuffled.slice(0, count)
}
