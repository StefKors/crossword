import type {
  CrosswordAlgorithm,
  CrosswordData,
  Direction,
  PlacedWord,
  WordEntry,
} from "../types/crossword"
import { parseWordlist, getPlayabilityScore } from "./wordlist"

// ─── Shared types ────────────────────────────────────────────────

interface Placement {
  row: number
  col: number
  direction: Direction
  intersections: number
  score: number
}

interface GridWord {
  word: string
  definition: string
  row: number
  col: number
  direction: Direction
}

interface BoundingBox {
  minRow: number
  maxRow: number
  minCol: number
  maxCol: number
  width: number
  height: number
}

type Grid = (string | null)[][]

// ─── Dictionary lookup (cached) ──────────────────────────────────

let _validWords: Set<string> | null = null

function getValidWords(): Set<string> {
  if (_validWords) return _validWords
  const all = parseWordlist()
  _validWords = new Set(all.map((w) => w.word))
  return _validWords
}

// ─── Shared helpers ──────────────────────────────────────────────

function makeGrid(size: number): Grid {
  return Array.from({ length: size }, () => Array.from({ length: size }, () => null))
}

function cloneGrid(grid: Grid): Grid {
  return grid.map((row) => [...row])
}

function placeWord(grid: Grid, word: string, row: number, col: number, direction: Direction): void {
  for (let i = 0; i < word.length; i++) {
    if (direction === "across") {
      grid[row][col + i] = word[i]
    } else {
      grid[row + i][col] = word[i]
    }
  }
}

function getBoundingBox(grid: Grid): BoundingBox {
  const rows = grid.length
  const cols = grid[0]?.length ?? 0
  let minRow = rows
  let maxRow = 0
  let minCol = cols
  let maxCol = 0

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] !== null) {
        minRow = Math.min(minRow, r)
        maxRow = Math.max(maxRow, r)
        minCol = Math.min(minCol, c)
        maxCol = Math.max(maxCol, c)
      }
    }
  }

  if (minRow > maxRow) {
    return { minRow: 0, maxRow: 0, minCol: 0, maxCol: 0, width: 0, height: 0 }
  }

  return {
    minRow,
    maxRow,
    minCol,
    maxCol,
    width: maxCol - minCol + 1,
    height: maxRow - minRow + 1,
  }
}

function calculateDensity(grid: Grid, bounds: BoundingBox): number {
  if (bounds.width === 0 || bounds.height === 0) return 0
  let filled = 0
  for (let r = bounds.minRow; r <= bounds.maxRow; r++) {
    for (let c = bounds.minCol; c <= bounds.maxCol; c++) {
      if (grid[r][c] !== null) filled++
    }
  }
  return filled / (bounds.width * bounds.height)
}

function countIntersections(
  grid: Grid,
  word: string,
  row: number,
  col: number,
  direction: Direction,
): number {
  let count = 0
  for (let i = 0; i < word.length; i++) {
    const r = direction === "across" ? row : row + i
    const c = direction === "across" ? col + i : col
    if (grid[r][c] === word[i]) count++
  }
  return count
}

/**
 * Read the full perpendicular word that would be formed at (r, c)
 * after placing `letter` there. Returns null if it's just the single letter
 * (no adjacent letters in the perpendicular direction).
 */
function getPerpendicularWord(
  grid: Grid,
  gridSize: number,
  r: number,
  c: number,
  letter: string,
  wordDirection: Direction,
): string | null {
  // Perpendicular direction: if word is across, check the vertical run; vice versa
  const dr = wordDirection === "across" ? 1 : 0
  const dc = wordDirection === "across" ? 0 : 1

  // Walk backwards to find start of perpendicular run
  let startR = r
  let startC = c
  while (true) {
    const prevR = startR - dr
    const prevC = startC - dc
    if (prevR < 0 || prevC < 0 || prevR >= gridSize || prevC >= gridSize) break
    if (grid[prevR][prevC] === null) break
    startR = prevR
    startC = prevC
  }

  // Walk forwards to collect the full run
  let word = ""
  let cr = startR
  let cc = startC
  while (cr >= 0 && cc >= 0 && cr < gridSize && cc < gridSize) {
    const cell = cr === r && cc === c ? letter : grid[cr][cc]
    if (cell === null) break
    word += cell
    cr += dr
    cc += dc
  }

  // Single letter = no perpendicular word formed
  if (word.length <= 1) return null
  return word
}

/**
 * Validate a word placement on the grid.
 * Checks:
 * 1. Bounds
 * 2. Cell before/after word must be empty (no extending existing words)
 * 3. Each cell is either empty or matches the letter (intersection)
 * 4. Every perpendicular letter sequence created must be a valid dictionary word
 * 5. Must have at least one intersection (except first word on empty grid)
 */
function isValidPlacement(
  grid: Grid,
  gridSize: number,
  word: string,
  row: number,
  col: number,
  direction: Direction,
  dictionary: Set<string>,
): boolean {
  const len = word.length

  // Check bounds
  if (direction === "across") {
    if (row < 0 || row >= gridSize || col < 0 || col + len > gridSize) return false
  } else {
    if (row < 0 || row + len > gridSize || col < 0 || col >= gridSize) return false
  }

  // Check the cell before the word (must be empty)
  if (direction === "across") {
    if (col > 0 && grid[row][col - 1] !== null) return false
  } else {
    if (row > 0 && grid[row - 1][col] !== null) return false
  }

  // Check the cell after the word (must be empty)
  if (direction === "across") {
    if (col + len < gridSize && grid[row][col + len] !== null) return false
  } else {
    if (row + len < gridSize && grid[row + len][col] !== null) return false
  }

  let hasIntersection = false

  for (let i = 0; i < len; i++) {
    const r = direction === "across" ? row : row + i
    const c = direction === "across" ? col + i : col
    const existing = grid[r][c]

    if (existing !== null) {
      // Cell occupied — must match our letter
      if (existing !== word[i]) return false
      hasIntersection = true
    } else {
      // Cell is empty — check what perpendicular word would be formed
      const perpWord = getPerpendicularWord(grid, gridSize, r, c, word[i], direction)
      if (perpWord !== null) {
        // A perpendicular sequence of 2+ letters is formed — it MUST be a valid word
        if (!dictionary.has(perpWord)) return false
      }
    }
  }

  // Must have at least one intersection (except for the very first word on an empty grid)
  const isEmpty = grid.every((row) => row.every((cell) => cell === null))
  return hasIntersection || isEmpty
}

function trimGrid(grid: Grid): {
  trimmedGrid: Grid
  offsetRow: number
  offsetCol: number
} {
  const bounds = getBoundingBox(grid)
  if (bounds.width === 0) {
    return { trimmedGrid: [[]], offsetRow: 0, offsetCol: 0 }
  }

  const trimmedGrid: Grid = []
  for (let r = bounds.minRow; r <= bounds.maxRow; r++) {
    const row: (string | null)[] = []
    for (let c = bounds.minCol; c <= bounds.maxCol; c++) {
      row.push(grid[r][c])
    }
    trimmedGrid.push(row)
  }

  return { trimmedGrid, offsetRow: bounds.minRow, offsetCol: bounds.minCol }
}

function assignClueNumbers(words: GridWord[], width: number, height: number): PlacedWord[] {
  const starts = new Map<string, { across?: GridWord; down?: GridWord }>()
  for (const w of words) {
    const key = `${w.row},${w.col}`
    const existing = starts.get(key) ?? {}
    if (w.direction === "across") existing.across = w
    else existing.down = w
    starts.set(key, existing)
  }

  const result: PlacedWord[] = []
  let clueNumber = 1

  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      const key = `${r},${c}`
      const entry = starts.get(key)
      if (!entry) continue

      const num = clueNumber++

      if (entry.across) {
        result.push({
          word: entry.across.word,
          definition: entry.across.definition,
          row: entry.across.row,
          col: entry.across.col,
          direction: "across",
          clueNumber: num,
        })
      }
      if (entry.down) {
        result.push({
          word: entry.down.word,
          definition: entry.down.definition,
          row: entry.down.row,
          col: entry.down.col,
          direction: "down",
          clueNumber: num,
        })
      }
    }
  }

  return result
}

function finalize(grid: Grid, placed: GridWord[]): CrosswordData {
  const { trimmedGrid, offsetRow, offsetCol } = trimGrid(grid)
  const height = trimmedGrid.length
  const width = trimmedGrid[0]?.length ?? 0

  const adjustedWords: GridWord[] = placed.map((w) => ({
    ...w,
    row: w.row - offsetRow,
    col: w.col - offsetCol,
  }))

  const finalWords = assignClueNumbers(adjustedWords, width, height)

  // Compute average playability
  let totalPlay = 0
  for (const w of finalWords) {
    totalPlay += getPlayabilityScore(w.word)
  }
  const avgPlayability = finalWords.length > 0 ? Math.round(totalPlay / finalWords.length) : 0

  return { grid: trimmedGrid, words: finalWords, width, height, avgPlayability }
}

function findPlacements(
  grid: Grid,
  gridSize: number,
  placed: GridWord[],
  word: string,
  dictionary: Set<string>,
): Placement[] {
  const candidates: Placement[] = []
  const center = gridSize / 2

  for (const existing of placed) {
    const newDirection: Direction = existing.direction === "across" ? "down" : "across"

    for (let ei = 0; ei < existing.word.length; ei++) {
      for (let wi = 0; wi < word.length; wi++) {
        if (existing.word[ei] !== word[wi]) continue

        let row: number, col: number
        if (existing.direction === "across") {
          row = existing.row - wi
          col = existing.col + ei
        } else {
          row = existing.row + ei
          col = existing.col - wi
        }

        if (isValidPlacement(grid, gridSize, word, row, col, newDirection, dictionary)) {
          const intersections = countIntersections(grid, word, row, col, newDirection)
          const midRow = row + (newDirection === "down" ? word.length / 2 : 0)
          const midCol = col + (newDirection === "across" ? word.length / 2 : 0)
          const distFromCenter = Math.abs(midRow - center) + Math.abs(midCol - center)
          const playability = getPlayabilityScore(word)
          const score = intersections * 10 - distFromCenter + Math.log(playability + 1) * 2

          candidates.push({ row, col, direction: newDirection, intersections, score })
        }
      }
    }
  }

  return candidates
}

// ─── Algorithm: Original ─────────────────────────────────────────

function generateOriginal(words: WordEntry[]): CrosswordData {
  const gridSize = 80
  const grid = makeGrid(gridSize)
  const dict = getValidWords()
  const sorted = [...words].sort((a, b) => b.word.length - a.word.length)
  const placed: GridWord[] = []
  const unplaced: WordEntry[] = []

  const first = sorted[0]
  const centerRow = Math.floor(gridSize / 2)
  const centerCol = Math.floor((gridSize - first.word.length) / 2)

  placeWord(grid, first.word, centerRow, centerCol, "across")
  placed.push({
    word: first.word,
    definition: first.definition,
    row: centerRow,
    col: centerCol,
    direction: "across",
  })

  for (let i = 1; i < sorted.length; i++) {
    const entry = sorted[i]
    const candidates = findPlacements(grid, gridSize, placed, entry.word, dict)
    if (candidates.length > 0) {
      candidates.sort((a, b) => b.score - a.score)
      const best = candidates[0]
      placeWord(grid, entry.word, best.row, best.col, best.direction)
      placed.push({
        word: entry.word,
        definition: entry.definition,
        row: best.row,
        col: best.col,
        direction: best.direction,
      })
    } else {
      unplaced.push(entry)
    }
  }

  for (let pass = 0; pass < 3; pass++) {
    const stillUnplaced: WordEntry[] = []
    for (const entry of unplaced) {
      const candidates = findPlacements(grid, gridSize, placed, entry.word, dict)
      if (candidates.length > 0) {
        candidates.sort((a, b) => b.score - a.score)
        const best = candidates[0]
        placeWord(grid, entry.word, best.row, best.col, best.direction)
        placed.push({
          word: entry.word,
          definition: entry.definition,
          row: best.row,
          col: best.col,
          direction: best.direction,
        })
      } else {
        stillUnplaced.push(entry)
      }
    }
    unplaced.length = 0
    unplaced.push(...stillUnplaced)
    if (stillUnplaced.length === 0) break
  }

  return finalize(grid, placed)
}

// ─── Algorithm: Compact ──────────────────────────────────────────

function generateCompact(words: WordEntry[]): CrosswordData {
  const gridSize = 50
  const grid = makeGrid(gridSize)
  const dict = getValidWords()
  const sorted = [...words].sort((a, b) => b.word.length - a.word.length)
  const placed: GridWord[] = []

  const first = sorted[0]
  const centerRow = Math.floor(gridSize / 2)
  const centerCol = Math.floor((gridSize - first.word.length) / 2)

  placeWord(grid, first.word, centerRow, centerCol, "across")
  placed.push({
    word: first.word,
    definition: first.definition,
    row: centerRow,
    col: centerCol,
    direction: "across",
  })

  const tryPlace = (entry: WordEntry): boolean => {
    const candidates = findPlacements(grid, gridSize, placed, entry.word, dict)
    if (candidates.length === 0) return false

    // Re-score with compactness focus
    const currentBounds = getBoundingBox(grid)
    const currentArea = currentBounds.width * currentBounds.height || 1

    for (const c of candidates) {
      const testGrid = cloneGrid(grid)
      placeWord(testGrid, entry.word, c.row, c.col, c.direction)
      const newBounds = getBoundingBox(testGrid)
      const newArea = newBounds.width * newBounds.height
      const expansion = newArea - currentArea
      const density = calculateDensity(testGrid, newBounds)

      c.score = c.intersections * 5 + density * 20 - expansion * 3
    }

    candidates.sort((a, b) => b.score - a.score)
    const best = candidates[0]

    placeWord(grid, entry.word, best.row, best.col, best.direction)
    placed.push({
      word: entry.word,
      definition: entry.definition,
      row: best.row,
      col: best.col,
      direction: best.direction,
    })
    return true
  }

  const unplaced: WordEntry[] = []
  for (let i = 1; i < sorted.length; i++) {
    if (!tryPlace(sorted[i])) {
      unplaced.push(sorted[i])
    }
  }

  // 2 retry passes
  for (let pass = 0; pass < 2; pass++) {
    const stillUnplaced: WordEntry[] = []
    for (const entry of unplaced) {
      if (!tryPlace(entry)) {
        stillUnplaced.push(entry)
      }
    }
    unplaced.length = 0
    unplaced.push(...stillUnplaced)
    if (stillUnplaced.length === 0) break
  }

  return finalize(grid, placed)
}

// ─── Algorithm: Dense ────────────────────────────────────────────

function sharedLetterScore(a: string, b: string): number {
  let score = 0
  const bLetters = new Map<string, number>()
  for (const ch of b) {
    bLetters.set(ch, (bLetters.get(ch) ?? 0) + 1)
  }
  for (const ch of a) {
    const count = bLetters.get(ch) ?? 0
    if (count > 0) {
      score++
      bLetters.set(ch, count - 1)
    }
  }
  return score
}

function selectSeedWords(words: WordEntry[], seedCount: number): WordEntry[] {
  const scores = words.map((w, i) => {
    let total = 0
    for (let j = 0; j < words.length; j++) {
      if (i !== j) total += sharedLetterScore(w.word, words[j].word)
    }
    return { entry: w, score: total }
  })

  scores.sort((a, b) => b.score - a.score)
  return scores.slice(0, seedCount).map((s) => s.entry)
}

function generateDense(words: WordEntry[]): CrosswordData {
  const gridSize = 40
  const grid = makeGrid(gridSize)
  const dict = getValidWords()
  const placed: GridWord[] = []

  const seeds = selectSeedWords(words, 6)
  const remaining = words.filter((w) => !seeds.includes(w))

  seeds.sort((a, b) => b.word.length - a.word.length)

  const first = seeds[0]
  const centerRow = Math.floor(gridSize / 2)
  const centerCol = Math.floor((gridSize - first.word.length) / 2)

  placeWord(grid, first.word, centerRow, centerCol, "across")
  placed.push({
    word: first.word,
    definition: first.definition,
    row: centerRow,
    col: centerCol,
    direction: "across",
  })

  // Place remaining seeds
  for (let i = 1; i < seeds.length; i++) {
    const entry = seeds[i]
    const candidates = findPlacements(grid, gridSize, placed, entry.word, dict)
    if (candidates.length === 0) continue

    const currentBounds = getBoundingBox(grid)
    for (const c of candidates) {
      const testGrid = cloneGrid(grid)
      placeWord(testGrid, entry.word, c.row, c.col, c.direction)
      const newBounds = getBoundingBox(testGrid)
      const expansion =
        newBounds.width * newBounds.height - currentBounds.width * currentBounds.height
      c.score = c.intersections * 15 - expansion * 5
    }

    candidates.sort((a, b) => b.score - a.score)
    const best = candidates[0]
    placeWord(grid, entry.word, best.row, best.col, best.direction)
    placed.push({
      word: entry.word,
      definition: entry.definition,
      row: best.row,
      col: best.col,
      direction: best.direction,
    })
  }

  // Grow: prefer words with >= 2 intersections, but accept 1 if compact
  const sortedRemaining = [...remaining].sort((a, b) => b.word.length - a.word.length)
  const skipped: WordEntry[] = []

  for (const entry of sortedRemaining) {
    const candidates = findPlacements(grid, gridSize, placed, entry.word, dict)
    const good = candidates.filter((c) => c.intersections >= 2)

    if (good.length === 0) {
      skipped.push(entry)
      continue
    }

    const currentBounds = getBoundingBox(grid)
    for (const c of good) {
      const testGrid = cloneGrid(grid)
      placeWord(testGrid, entry.word, c.row, c.col, c.direction)
      const newBounds = getBoundingBox(testGrid)
      const density = calculateDensity(testGrid, newBounds)
      const expansion =
        newBounds.width * newBounds.height - currentBounds.width * currentBounds.height
      c.score = c.intersections * 10 + density * 30 - expansion * 4
    }

    good.sort((a, b) => b.score - a.score)
    const best = good[0]
    placeWord(grid, entry.word, best.row, best.col, best.direction)
    placed.push({
      word: entry.word,
      definition: entry.definition,
      row: best.row,
      col: best.col,
      direction: best.direction,
    })
  }

  // Final pass for skipped words with relaxed intersection requirement
  for (const entry of skipped) {
    const candidates = findPlacements(grid, gridSize, placed, entry.word, dict)
    if (candidates.length === 0) continue

    const currentBounds = getBoundingBox(grid)
    const currentArea = currentBounds.width * currentBounds.height

    for (const c of candidates) {
      const testGrid = cloneGrid(grid)
      placeWord(testGrid, entry.word, c.row, c.col, c.direction)
      const newBounds = getBoundingBox(testGrid)
      const newArea = newBounds.width * newBounds.height
      const expansion = newArea - currentArea
      if (expansion > 20) {
        c.score = -Infinity
      } else {
        c.score = c.intersections * 10 - expansion * 5
      }
    }

    const valid = candidates.filter((c) => c.score > -Infinity)
    if (valid.length === 0) continue

    valid.sort((a, b) => b.score - a.score)
    const best = valid[0]
    placeWord(grid, entry.word, best.row, best.col, best.direction)
    placed.push({
      word: entry.word,
      definition: entry.definition,
      row: best.row,
      col: best.col,
      direction: best.direction,
    })
  }

  return finalize(grid, placed)
}

// ─── Algorithm: Fitted ───────────────────────────────────────────

function generateFitted(words: WordEntry[]): CrosswordData {
  const gridSize = 30
  const grid = makeGrid(gridSize)
  const dict = getValidWords()
  const placed: GridWord[] = []
  const sorted = [...words].sort((a, b) => b.word.length - a.word.length)

  const first = sorted[0]
  const centerRow = Math.floor(gridSize / 2)
  const centerCol = Math.floor((gridSize - first.word.length) / 2)

  placeWord(grid, first.word, centerRow, centerCol, "across")
  placed.push({
    word: first.word,
    definition: first.definition,
    row: centerRow,
    col: centerCol,
    direction: "across",
  })

  // Place remaining words, scoring by gap-filling within the bounding box
  const unplaced: WordEntry[] = []
  for (let i = 1; i < sorted.length; i++) {
    const entry = sorted[i]
    const candidates = findPlacements(grid, gridSize, placed, entry.word, dict)
    if (candidates.length === 0) {
      unplaced.push(entry)
      continue
    }

    const currentBounds = getBoundingBox(grid)
    for (const c of candidates) {
      const testGrid = cloneGrid(grid)
      placeWord(testGrid, entry.word, c.row, c.col, c.direction)
      const newBounds = getBoundingBox(testGrid)

      const withinBounds =
        c.row >= currentBounds.minRow &&
        c.col >= currentBounds.minCol &&
        (c.direction === "across"
          ? c.col + entry.word.length - 1 <= currentBounds.maxCol
          : c.row + entry.word.length - 1 <= currentBounds.maxRow)

      const density = calculateDensity(testGrid, newBounds)
      const expansion =
        newBounds.width * newBounds.height - currentBounds.width * currentBounds.height

      c.score = c.intersections * 8 + density * 25 + (withinBounds ? 15 : 0) - expansion * 4
    }

    candidates.sort((a, b) => b.score - a.score)
    const best = candidates[0]
    placeWord(grid, entry.word, best.row, best.col, best.direction)
    placed.push({
      word: entry.word,
      definition: entry.definition,
      row: best.row,
      col: best.col,
      direction: best.direction,
    })
  }

  // Retry unplaced
  for (let pass = 0; pass < 2; pass++) {
    const stillUnplaced: WordEntry[] = []
    for (const entry of unplaced) {
      const candidates = findPlacements(grid, gridSize, placed, entry.word, dict)
      if (candidates.length === 0) {
        stillUnplaced.push(entry)
        continue
      }

      const currentBounds = getBoundingBox(grid)
      for (const c of candidates) {
        const testGrid = cloneGrid(grid)
        placeWord(testGrid, entry.word, c.row, c.col, c.direction)
        const newBounds = getBoundingBox(testGrid)
        const density = calculateDensity(testGrid, newBounds)
        const expansion =
          newBounds.width * newBounds.height - currentBounds.width * currentBounds.height
        c.score = c.intersections * 8 + density * 25 - expansion * 4
      }

      candidates.sort((a, b) => b.score - a.score)
      const best = candidates[0]
      placeWord(grid, entry.word, best.row, best.col, best.direction)
      placed.push({
        word: entry.word,
        definition: entry.definition,
        row: best.row,
        col: best.col,
        direction: best.direction,
      })
    }
    unplaced.length = 0
    unplaced.push(...stillUnplaced)
    if (stillUnplaced.length === 0) break
  }

  // Gap-filling: find slots where a dictionary word fits crossing existing letters
  const bounds = getBoundingBox(grid)
  const allWords = parseWordlist()
  const placedWordSet = new Set(placed.map((p) => p.word))

  // Scan for horizontal filler opportunities
  for (let r = bounds.minRow; r <= bounds.maxRow; r++) {
    for (let c = bounds.minCol; c <= bounds.maxCol; c++) {
      if (grid[r][c] !== null) continue
      if (c > 0 && grid[r][c - 1] !== null) continue

      // Collect pattern until we hit a dead end
      const pattern: (string | null)[] = []
      let cc = c
      while (cc <= bounds.maxCol) {
        pattern.push(grid[r][cc])
        cc++
        // Stop at end of bounded area
      }

      // Try different word lengths starting at this position
      for (let len = 3; len <= Math.min(15, pattern.length); len++) {
        // Must end with empty or out-of-bounds (no extending)
        if (c + len < gridSize && grid[r][c + len] !== null) continue

        // Must have at least 2 crossing letters
        let crossings = 0
        for (let ci = 0; ci < len; ci++) {
          if (pattern[ci] !== null) crossings++
        }
        if (crossings < 2) continue

        const filler = findBestFiller(
          allWords,
          placedWordSet,
          pattern,
          len,
          grid,
          gridSize,
          r,
          c,
          "across",
          dict,
        )

        if (filler) {
          placeWord(grid, filler.word, r, c, "across")
          placed.push({
            word: filler.word,
            definition: filler.definition,
            row: r,
            col: c,
            direction: "across",
          })
          placedWordSet.add(filler.word)
          break // Move to next position
        }
      }
    }
  }

  // Scan for vertical filler opportunities
  for (let c = bounds.minCol; c <= bounds.maxCol; c++) {
    for (let r = bounds.minRow; r <= bounds.maxRow; r++) {
      if (grid[r][c] !== null) continue
      if (r > 0 && grid[r - 1][c] !== null) continue

      const pattern: (string | null)[] = []
      let rr = r
      while (rr <= bounds.maxRow) {
        pattern.push(grid[rr][c])
        rr++
      }

      for (let len = 3; len <= Math.min(15, pattern.length); len++) {
        if (r + len < gridSize && grid[r + len][c] !== null) continue

        let crossings = 0
        for (let ri = 0; ri < len; ri++) {
          if (pattern[ri] !== null) crossings++
        }
        if (crossings < 2) continue

        const filler = findBestFiller(
          allWords,
          placedWordSet,
          pattern,
          len,
          grid,
          gridSize,
          r,
          c,
          "down",
          dict,
        )

        if (filler) {
          placeWord(grid, filler.word, r, c, "down")
          placed.push({
            word: filler.word,
            definition: filler.definition,
            row: r,
            col: c,
            direction: "down",
          })
          placedWordSet.add(filler.word)
          break
        }
      }
    }
  }

  return finalize(grid, placed)
}

// ─── Best filler helper (playability-sorted) ─────────────────────

function findBestFiller(
  allWords: WordEntry[],
  placedWordSet: Set<string>,
  pattern: (string | null)[],
  len: number,
  grid: Grid,
  gridSize: number,
  row: number,
  col: number,
  direction: Direction,
  dict: Set<string>,
): WordEntry | null {
  // Collect all matching candidates
  const candidates: { entry: WordEntry; playability: number }[] = []

  for (const w of allWords) {
    if (w.word.length !== len) continue
    if (placedWordSet.has(w.word)) continue

    let matches = true
    for (let i = 0; i < len; i++) {
      if (pattern[i] !== null && pattern[i] !== w.word[i]) {
        matches = false
        break
      }
    }
    if (!matches) continue

    if (!isValidPlacement(grid, gridSize, w.word, row, col, direction, dict)) continue

    candidates.push({ entry: w, playability: getPlayabilityScore(w.word) })

    // Collect up to 50 candidates then pick best (avoid scanning all 178K for every slot)
    if (candidates.length >= 50) break
  }

  if (candidates.length === 0) return null

  // Sort by playability descending, pick best
  candidates.sort((a, b) => b.playability - a.playability)
  return candidates[0].entry
}

// ─── Algorithm: Smart ────────────────────────────────────────────

function generateSmart(
  words: WordEntry[],
  onProgress?: (msg: string, pct: number) => void,
): CrosswordData {
  const NUM_ATTEMPTS = 5
  let bestResult: CrosswordData | null = null
  let bestScore = -Infinity

  for (let attempt = 0; attempt < NUM_ATTEMPTS; attempt++) {
    onProgress?.(`Attempt ${attempt + 1}/${NUM_ATTEMPTS}...`, (attempt / NUM_ATTEMPTS) * 100)

    // Shuffle input words differently each attempt, but bias toward high-playability
    const shuffled = [...words]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }

    // Sort by a mix of playability and length (longer + more playable first)
    shuffled.sort((a, b) => {
      const aScore = b.word.length * 100 + getPlayabilityScore(b.word) * 0.001
      const bScore = a.word.length * 100 + getPlayabilityScore(a.word) * 0.001
      // Add randomness for variety between attempts
      return aScore - bScore + (Math.random() - 0.5) * 50
    })

    const result = generateSmartAttempt(shuffled, onProgress, attempt, NUM_ATTEMPTS)

    // Score: prioritize words placed, then density, then playability
    const bounds = { width: result.width, height: result.height }
    const area = bounds.width * bounds.height || 1
    let filled = 0
    for (const row of result.grid) {
      for (const cell of row) {
        if (cell !== null) filled++
      }
    }
    const density = filled / area
    const avgPlay = result.avgPlayability ?? 0

    const score =
      result.words.length * 1000 + density * 500 + Math.log(avgPlay + 1) * 100 - area * 2

    if (score > bestScore) {
      bestScore = score
      bestResult = result
    }
  }

  onProgress?.("Done!", 100)
  return bestResult ?? { grid: [[]], words: [], width: 0, height: 0, avgPlayability: 0 }
}

function generateSmartAttempt(
  sortedWords: WordEntry[],
  onProgress: ((msg: string, pct: number) => void) | undefined,
  attempt: number,
  totalAttempts: number,
): CrosswordData {
  const gridSize = 30
  const grid = makeGrid(gridSize)
  const dict = getValidWords()
  const placed: GridWord[] = []

  // Place first word
  const first = sortedWords[0]
  const centerRow = Math.floor(gridSize / 2)
  const centerCol = Math.floor((gridSize - first.word.length) / 2)

  placeWord(grid, first.word, centerRow, centerCol, "across")
  placed.push({
    word: first.word,
    definition: first.definition,
    row: centerRow,
    col: centerCol,
    direction: "across",
  })

  // Place remaining words with compactness + playability scoring
  const unplaced: WordEntry[] = []
  for (let i = 1; i < sortedWords.length; i++) {
    const entry = sortedWords[i]
    const candidates = findPlacements(grid, gridSize, placed, entry.word, dict)
    if (candidates.length === 0) {
      unplaced.push(entry)
      continue
    }

    const currentBounds = getBoundingBox(grid)
    for (const c of candidates) {
      const testGrid = cloneGrid(grid)
      placeWord(testGrid, entry.word, c.row, c.col, c.direction)
      const newBounds = getBoundingBox(testGrid)

      const withinBounds =
        c.row >= currentBounds.minRow &&
        c.col >= currentBounds.minCol &&
        (c.direction === "across"
          ? c.col + entry.word.length - 1 <= currentBounds.maxCol
          : c.row + entry.word.length - 1 <= currentBounds.maxRow)

      const density = calculateDensity(testGrid, newBounds)
      const expansion =
        newBounds.width * newBounds.height - currentBounds.width * currentBounds.height
      const playability = getPlayabilityScore(entry.word)

      c.score =
        c.intersections * 8 +
        density * 25 +
        (withinBounds ? 15 : 0) -
        expansion * 4 +
        Math.log(playability + 1) * 3
    }

    candidates.sort((a, b) => b.score - a.score)
    const best = candidates[0]
    placeWord(grid, entry.word, best.row, best.col, best.direction)
    placed.push({
      word: entry.word,
      definition: entry.definition,
      row: best.row,
      col: best.col,
      direction: best.direction,
    })
  }

  // Retry unplaced (2 passes)
  for (let pass = 0; pass < 2; pass++) {
    const stillUnplaced: WordEntry[] = []
    for (const entry of unplaced) {
      const candidates = findPlacements(grid, gridSize, placed, entry.word, dict)
      if (candidates.length === 0) {
        stillUnplaced.push(entry)
        continue
      }

      const currentBounds = getBoundingBox(grid)
      for (const c of candidates) {
        const testGrid = cloneGrid(grid)
        placeWord(testGrid, entry.word, c.row, c.col, c.direction)
        const newBounds = getBoundingBox(testGrid)
        const density = calculateDensity(testGrid, newBounds)
        const expansion =
          newBounds.width * newBounds.height - currentBounds.width * currentBounds.height
        c.score = c.intersections * 8 + density * 25 - expansion * 4
      }

      candidates.sort((a, b) => b.score - a.score)
      const best = candidates[0]
      placeWord(grid, entry.word, best.row, best.col, best.direction)
      placed.push({
        word: entry.word,
        definition: entry.definition,
        row: best.row,
        col: best.col,
        direction: best.direction,
      })
    }
    unplaced.length = 0
    unplaced.push(...stillUnplaced)
    if (stillUnplaced.length === 0) break
  }

  // Smart gap-filling: prefer high-playability words
  const basePct = (attempt / totalAttempts) * 100
  onProgress?.(`Attempt ${attempt + 1}/${totalAttempts}: Gap-filling...`, basePct + 10)

  const bounds = getBoundingBox(grid)
  const allWords = parseWordlist()
  const placedWordSet = new Set(placed.map((p) => p.word))

  // Pre-sort allWords by playability for faster best-match finding
  const sortedByPlayability = [...allWords].sort(
    (a, b) => getPlayabilityScore(b.word) - getPlayabilityScore(a.word),
  )

  // Horizontal gap-filling
  for (let r = bounds.minRow; r <= bounds.maxRow; r++) {
    for (let c = bounds.minCol; c <= bounds.maxCol; c++) {
      if (grid[r][c] !== null) continue
      if (c > 0 && grid[r][c - 1] !== null) continue

      const pattern: (string | null)[] = []
      let cc = c
      while (cc <= bounds.maxCol) {
        pattern.push(grid[r][cc])
        cc++
      }

      for (let len = 3; len <= Math.min(15, pattern.length); len++) {
        if (c + len < gridSize && grid[r][c + len] !== null) continue

        let crossings = 0
        for (let ci = 0; ci < len; ci++) {
          if (pattern[ci] !== null) crossings++
        }
        if (crossings < 2) continue

        const filler = findBestFiller(
          sortedByPlayability,
          placedWordSet,
          pattern,
          len,
          grid,
          gridSize,
          r,
          c,
          "across",
          dict,
        )

        if (filler && getPlayabilityScore(filler.word) >= 100) {
          placeWord(grid, filler.word, r, c, "across")
          placed.push({
            word: filler.word,
            definition: filler.definition,
            row: r,
            col: c,
            direction: "across",
          })
          placedWordSet.add(filler.word)
          break
        }
      }
    }
  }

  // Vertical gap-filling
  for (let c = bounds.minCol; c <= bounds.maxCol; c++) {
    for (let r = bounds.minRow; r <= bounds.maxRow; r++) {
      if (grid[r][c] !== null) continue
      if (r > 0 && grid[r - 1][c] !== null) continue

      const pattern: (string | null)[] = []
      let rr = r
      while (rr <= bounds.maxRow) {
        pattern.push(grid[rr][c])
        rr++
      }

      for (let len = 3; len <= Math.min(15, pattern.length); len++) {
        if (r + len < gridSize && grid[r + len][c] !== null) continue

        let crossings = 0
        for (let ri = 0; ri < len; ri++) {
          if (pattern[ri] !== null) crossings++
        }
        if (crossings < 2) continue

        const filler = findBestFiller(
          sortedByPlayability,
          placedWordSet,
          pattern,
          len,
          grid,
          gridSize,
          r,
          c,
          "down",
          dict,
        )

        if (filler && getPlayabilityScore(filler.word) >= 100) {
          placeWord(grid, filler.word, r, c, "down")
          placed.push({
            word: filler.word,
            definition: filler.definition,
            row: r,
            col: c,
            direction: "down",
          })
          placedWordSet.add(filler.word)
          break
        }
      }
    }
  }

  return finalize(grid, placed)
}

// ─── Public dispatcher ───────────────────────────────────────────

// ─── Async worker API ────────────────────────────────────────────

let _worker: Worker | null = null
let _requestId = 0

function getWorker(): Worker {
  if (_worker) return _worker
  _worker = new Worker(new URL("./crosswordGenerator.worker.ts", import.meta.url), {
    type: "module",
  })
  return _worker
}

export interface GenerationProgress {
  message: string
  percent: number
}

/**
 * Generate a crossword in a Web Worker (non-blocking).
 * Use this from the UI to keep the page responsive during long generation.
 */
export function generateCrosswordAsync(
  words: WordEntry[],
  algorithm: CrosswordAlgorithm = "smart",
  onProgress?: (progress: GenerationProgress) => void,
): Promise<CrosswordData> {
  return new Promise((resolve, reject) => {
    const worker = getWorker()
    const id = ++_requestId

    const handler = (e: MessageEvent) => {
      const msg = e.data
      if (msg.id !== id) return

      if (msg.type === "progress") {
        onProgress?.({ message: msg.message, percent: msg.percent })
      } else if (msg.type === "result") {
        worker.removeEventListener("message", handler)
        resolve(msg.data)
      } else if (msg.type === "error") {
        worker.removeEventListener("message", handler)
        reject(new Error(msg.message))
      }
    }

    worker.addEventListener("message", handler)
    worker.postMessage({ type: "generate", id, words, algorithm })
  })
}

// ─── Synchronous API (for worker internals) ──────────────────────

export function generateCrossword(
  words: WordEntry[],
  algorithm: CrosswordAlgorithm = "smart",
  onProgress?: (msg: string, pct: number) => void,
): CrosswordData {
  switch (algorithm) {
    case "original":
      return generateOriginal(words)
    case "compact":
      return generateCompact(words)
    case "dense":
      return generateDense(words)
    case "fitted":
      return generateFitted(words)
    case "smart":
      return generateSmart(words, onProgress)
    default:
      return generateSmart(words, onProgress)
  }
}
