import { describe, it, expect } from "vitest"
import { generateCrossword } from "./crosswordGenerator"
import { parseWordlist, getPlayabilityScore, getPlayabilityMap } from "./wordlist"
import type { WordEntry, CrosswordData } from "../types/crossword"

// ─── wordlist ────────────────────────────────────────────────────

describe("wordlist", () => {
  it("parseWordlist returns a non-empty array", () => {
    const words = parseWordlist()
    expect(words.length).toBeGreaterThan(0)
  })

  it("each entry has word and definition", () => {
    const words = parseWordlist()
    for (const entry of words.slice(0, 100)) {
      expect(typeof entry.word).toBe("string")
      expect(entry.word.length).toBeGreaterThan(0)
      expect(typeof entry.definition).toBe("string")
    }
  })

  it("playability map has entries", () => {
    const map = getPlayabilityMap()
    expect(map.size).toBeGreaterThan(0)
  })

  it("known common words have high playability scores", () => {
    // Common Scrabble words should have positive scores
    const score = getPlayabilityScore("THE")
    expect(score).toBeGreaterThan(0)
  })

  it("unknown words return 0 playability", () => {
    expect(getPlayabilityScore("XYZZYNOTAWORD")).toBe(0)
  })
})

// ─── Helper: make a small word set for fast testing ──────────────

function getTestWords(count = 20): WordEntry[] {
  const all = parseWordlist()
  // Pick words of varied length that are common
  const byLen = new Map<number, WordEntry[]>()
  for (const entry of all) {
    const len = entry.word.length
    if (len < 3 || len > 12) continue
    if (!byLen.has(len)) byLen.set(len, [])
    byLen.get(len)!.push(entry)
  }

  // Pick top playability from each length bucket
  const result: WordEntry[] = []
  for (const [, words] of byLen) {
    words.sort((a, b) => getPlayabilityScore(b.word) - getPlayabilityScore(a.word))
    result.push(...words.slice(0, 3))
    if (result.length >= count) break
  }

  return result.slice(0, count)
}

// ─── Shared crossword result validators ──────────────────────────

function validateCrosswordResult(result: CrosswordData) {
  // Has the right shape
  expect(result).toHaveProperty("grid")
  expect(result).toHaveProperty("words")
  expect(result).toHaveProperty("width")
  expect(result).toHaveProperty("height")

  if (result.width === 0 || result.height === 0) return

  // Grid dimensions match
  expect(result.grid.length).toBe(result.height)
  for (const row of result.grid) {
    expect(row.length).toBe(result.width)
  }

  // Words are in bounds and match grid
  for (const placed of result.words) {
    expect(["across", "down"]).toContain(placed.direction)
    expect(placed.clueNumber).toBeGreaterThan(0)

    for (let i = 0; i < placed.word.length; i++) {
      const r = placed.direction === "across" ? placed.row : placed.row + i
      const c = placed.direction === "across" ? placed.col + i : placed.col

      expect(r).toBeGreaterThanOrEqual(0)
      expect(r).toBeLessThan(result.height)
      expect(c).toBeGreaterThanOrEqual(0)
      expect(c).toBeLessThan(result.width)
      expect(result.grid[r][c]).toBe(placed.word[i])
    }
  }
}

// ─── Classic crossword algorithms ────────────────────────────────

describe("generateCrossword (original)", () => {
  it("places words from the input", () => {
    const words = getTestWords(15)
    const result = generateCrossword(words, "original")
    validateCrosswordResult(result)
    expect(result.words.length).toBeGreaterThan(0)
  })
})

describe("generateCrossword (compact)", () => {
  it("places words from the input", () => {
    const words = getTestWords(15)
    const result = generateCrossword(words, "compact")
    validateCrosswordResult(result)
    expect(result.words.length).toBeGreaterThan(0)
  })
})

describe("generateCrossword (dense)", () => {
  it("places words from the input", () => {
    const words = getTestWords(15)
    const result = generateCrossword(words, "dense")
    validateCrosswordResult(result)
    expect(result.words.length).toBeGreaterThan(0)
  })
})

describe("generateCrossword (fitted)", () => {
  it("places words from the input", () => {
    const words = getTestWords(15)
    const result = generateCrossword(words, "fitted")
    validateCrosswordResult(result)
    expect(result.words.length).toBeGreaterThan(0)
  })
})

describe("generateCrossword (smart)", () => {
  it("places words from the input", () => {
    const words = getTestWords(15)
    const result = generateCrossword(words, "smart")
    validateCrosswordResult(result)
    expect(result.words.length).toBeGreaterThan(0)
  })

  it("reports progress", () => {
    const messages: string[] = []
    const words = getTestWords(10)
    generateCrossword(words, "smart", (msg) => messages.push(msg))
    expect(messages.length).toBeGreaterThan(0)
  })
})

// ─── Fill-in via dispatcher ──────────────────────────────────────

describe("generateCrossword (fillin-smart)", () => {
  it("dispatches to fillin generator", () => {
    const result = generateCrossword([], "fillin-smart")
    expect(result.puzzleType).toBe("fillin")
    expect(result.words.length).toBeGreaterThan(0)
  })
})
