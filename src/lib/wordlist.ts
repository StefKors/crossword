import themedData from "../assets/wordlist/NWL2023-themed.json"
import type { WordEntry } from "../types/crossword"

interface ThemedWord {
  w: string
  d: string
  t: number[]
}

interface ThemedWordlist {
  themes: string[]
  words: ThemedWord[]
}

const data = themedData as ThemedWordlist

let cachedEntries: WordEntry[] | null = null

/**
 * Get all words as WordEntry[]. Results are cached after first call.
 */
export function parseWordlist(): WordEntry[] {
  if (cachedEntries) return cachedEntries

  cachedEntries = data.words.map((w) => ({
    word: w.w,
    definition: w.d,
  }))

  return cachedEntries
}

/**
 * Get the list of all available theme names.
 */
export function getThemeList(): string[] {
  return data.themes
}

/**
 * Get words tagged with a specific theme.
 * Returns `count` words shuffled randomly from the matching set.
 */
export function getWordsByTheme(
  theme: string,
  count: number,
  minLength = 3,
  maxLength = 15,
): WordEntry[] {
  const themeIdx = data.themes.indexOf(theme)
  if (themeIdx === -1) return []

  const matching = data.words.filter(
    (w) => w.t.includes(themeIdx) && w.w.length >= minLength && w.w.length <= maxLength,
  )

  // Shuffle
  const shuffled = [...matching]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }

  return shuffled.slice(0, count).map((w) => ({
    word: w.w,
    definition: w.d,
  }))
}

/**
 * Get random words suitable for crossword generation.
 * Filters to words between minLength and maxLength characters.
 */
export function getRandomWords(
  minCount = 35,
  maxCount = 45,
  minLength = 3,
  maxLength = 15,
): WordEntry[] {
  const suitable = data.words.filter((w) => w.w.length >= minLength && w.w.length <= maxLength)

  const count = minCount + Math.floor(Math.random() * (maxCount - minCount + 1))

  const shuffled = [...suitable]
  for (let idx = shuffled.length - 1; idx > 0; idx--) {
    const j = Math.floor(Math.random() * (idx + 1))
    ;[shuffled[idx], shuffled[j]] = [shuffled[j], shuffled[idx]]
  }

  return shuffled.slice(0, count).map((w) => ({
    word: w.w,
    definition: w.d,
  }))
}
