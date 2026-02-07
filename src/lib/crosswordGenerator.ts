import type {
  CrosswordAlgorithm,
  CrosswordData,
  Direction,
  PlacedWord,
  WordEntry,
} from "../types/crossword"
import { parseWordlist } from "./wordlist"

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
 * Validate a word placement on the grid.
 * @param strict — if true, forbids any non-intersection parallel neighbor (original behavior).
 *                 if false, only checks that the cell before/after is empty and occupied cells match.
 */
function isValidPlacement(
  grid: Grid,
  gridSize: number,
  word: string,
  row: number,
  col: number,
  direction: Direction,
  strict: boolean,
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
      // Cell occupied — must match our letter (intersection)
      if (existing !== word[i]) return false
      hasIntersection = true
    } else if (strict) {
      // Strict: empty cells must not have parallel neighbors
      if (direction === "across") {
        if (r > 0 && grid[r - 1][c] !== null) return false
        if (r < gridSize - 1 && grid[r + 1][c] !== null) return false
      } else {
        if (c > 0 && grid[r][c - 1] !== null) return false
        if (c < gridSize - 1 && grid[r][c + 1] !== null) return false
      }
    }
  }

  // Must have at least one intersection (except for the first word)
  return hasIntersection || grid.every((row) => row.every((cell) => cell === null))
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

  return { grid: trimmedGrid, words: finalWords, width, height }
}

function findPlacements(
  grid: Grid,
  gridSize: number,
  placed: GridWord[],
  word: string,
  strict: boolean,
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

        if (isValidPlacement(grid, gridSize, word, row, col, newDirection, strict)) {
          const intersections = countIntersections(grid, word, row, col, newDirection)
          const midRow = row + (newDirection === "down" ? word.length / 2 : 0)
          const midCol = col + (newDirection === "across" ? word.length / 2 : 0)
          const distFromCenter = Math.abs(midRow - center) + Math.abs(midCol - center)
          const score = intersections * 10 - distFromCenter

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
    const candidates = findPlacements(grid, gridSize, placed, entry.word, true)
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
      const candidates = findPlacements(grid, gridSize, placed, entry.word, true)
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
    const candidates = findPlacements(grid, gridSize, placed, entry.word, false)
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

/**
 * Score pairwise letter overlap between two words.
 */
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
  // Score each word by total shared letters with all other words
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
  const placed: GridWord[] = []

  // Select 6 seed words with highest letter overlap
  const seeds = selectSeedWords(words, 6)
  const remaining = words.filter((w) => !seeds.includes(w))

  // Sort seeds longest first
  seeds.sort((a, b) => b.word.length - a.word.length)

  // Place first seed
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

  // Place remaining seeds — try multiple times to get tight arrangement
  for (let i = 1; i < seeds.length; i++) {
    const entry = seeds[i]
    const candidates = findPlacements(grid, gridSize, placed, entry.word, false)
    if (candidates.length === 0) continue

    // Score by intersections and compactness
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

  // Grow: only place words with >= 2 intersections
  const sortedRemaining = [...remaining].sort((a, b) => b.word.length - a.word.length)
  const skipped: WordEntry[] = []

  for (const entry of sortedRemaining) {
    const candidates = findPlacements(grid, gridSize, placed, entry.word, false)
    const good = candidates.filter((c) => c.intersections >= 2)

    if (good.length === 0) {
      skipped.push(entry)
      continue
    }

    // Score by density
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

  // One more pass: try skipped words, now accepting 1 intersection if they don't expand much
  for (const entry of skipped) {
    const candidates = findPlacements(grid, gridSize, placed, entry.word, false)
    if (candidates.length === 0) continue

    const currentBounds = getBoundingBox(grid)
    const currentArea = currentBounds.width * currentBounds.height

    for (const c of candidates) {
      const testGrid = cloneGrid(grid)
      placeWord(testGrid, entry.word, c.row, c.col, c.direction)
      const newBounds = getBoundingBox(testGrid)
      const newArea = newBounds.width * newBounds.height
      const expansion = newArea - currentArea
      // Only accept if expansion is small
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
  const placed: GridWord[] = []
  const sorted = [...words].sort((a, b) => b.word.length - a.word.length)

  // Place first word horizontally across the middle
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
    const candidates = findPlacements(grid, gridSize, placed, entry.word, false)
    if (candidates.length === 0) {
      unplaced.push(entry)
      continue
    }

    const currentBounds = getBoundingBox(grid)
    for (const c of candidates) {
      const testGrid = cloneGrid(grid)
      placeWord(testGrid, entry.word, c.row, c.col, c.direction)
      const newBounds = getBoundingBox(testGrid)

      // Prefer placements within the current bounding box
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
      const candidates = findPlacements(grid, gridSize, placed, entry.word, false)
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

  // Gap-filling: scan the bounding box for gaps and find filler words from the full wordlist
  const bounds = getBoundingBox(grid)
  const allWords = parseWordlist()
  const placedWordSet = new Set(placed.map((p) => p.word))

  // Scan for horizontal gaps
  for (let r = bounds.minRow; r <= bounds.maxRow; r++) {
    let gapStart = -1
    for (let c = bounds.minCol; c <= bounds.maxCol + 1; c++) {
      const cell = c <= bounds.maxCol ? grid[r][c] : null
      if (cell === null && gapStart === -1) {
        gapStart = c
      } else if (cell !== null && gapStart !== -1) {
        // Found a gap from gapStart to c-1, but we want gaps between filled cells
        gapStart = -1
      }
    }
  }

  // Try to fill empty rows/columns within bounds with words from the dictionary
  for (let r = bounds.minRow; r <= bounds.maxRow; r++) {
    // Find runs of empty cells in this row that cross at least one filled column
    for (let c = bounds.minCol; c <= bounds.maxCol; c++) {
      if (grid[r][c] !== null) continue
      // Check if this is a valid start for an across word
      if (c > 0 && grid[r][c - 1] !== null) continue

      // Find run length
      let runLen = 0
      const pattern: (string | null)[] = []
      for (
        let cc = c;
        cc <= bounds.maxCol && (grid[r][cc] === null || grid[r][cc] !== null);
        cc++
      ) {
        if (cc > bounds.maxCol) break
        pattern.push(grid[r][cc])
        runLen++
        // Stop if we hit a cell after the word would end
        if (grid[r][cc] === null && cc + 1 <= bounds.maxCol && grid[r][cc + 1] === null) {
          // Keep going only if there's a crossing letter ahead
          let hasIntersection = false
          for (let ahead = cc + 1; ahead <= bounds.maxCol && ahead < c + 15; ahead++) {
            if (grid[r][ahead] !== null) {
              hasIntersection = true
              break
            }
          }
          if (!hasIntersection) {
            runLen = cc - c + 1
            break
          }
        }
      }

      if (runLen < 3 || runLen > 15) continue

      // Check if there are any crossing letters
      let crossings = 0
      for (let ci = 0; ci < runLen; ci++) {
        if (pattern[ci] !== null) crossings++
      }
      if (crossings < 2) continue

      // Search for a word that fits this pattern
      const filler = allWords.find((w) => {
        if (w.word.length !== runLen) return false
        if (placedWordSet.has(w.word)) return false
        for (let ci = 0; ci < runLen; ci++) {
          if (pattern[ci] !== null && pattern[ci] !== w.word[ci]) return false
        }
        return isValidPlacement(grid, gridSize, w.word, r, c, "across", false)
      })

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
      }
    }
  }

  // Same for vertical gaps
  for (let c = bounds.minCol; c <= bounds.maxCol; c++) {
    for (let r = bounds.minRow; r <= bounds.maxRow; r++) {
      if (grid[r][c] !== null) continue
      if (r > 0 && grid[r - 1][c] !== null) continue

      let runLen = 0
      const pattern: (string | null)[] = []
      for (let rr = r; rr <= bounds.maxRow; rr++) {
        pattern.push(grid[rr][c])
        runLen++
        if (grid[rr][c] === null && rr + 1 <= bounds.maxRow && grid[rr + 1][c] === null) {
          let hasIntersection = false
          for (let ahead = rr + 1; ahead <= bounds.maxRow && ahead < r + 15; ahead++) {
            if (grid[ahead][c] !== null) {
              hasIntersection = true
              break
            }
          }
          if (!hasIntersection) {
            runLen = rr - r + 1
            break
          }
        }
      }

      if (runLen < 3 || runLen > 15) continue

      let crossings = 0
      for (let ri = 0; ri < runLen; ri++) {
        if (pattern[ri] !== null) crossings++
      }
      if (crossings < 2) continue

      const filler = allWords.find((w) => {
        if (w.word.length !== runLen) return false
        if (placedWordSet.has(w.word)) return false
        for (let ri = 0; ri < runLen; ri++) {
          if (pattern[ri] !== null && pattern[ri] !== w.word[ri]) return false
        }
        return isValidPlacement(grid, gridSize, w.word, r, c, "down", false)
      })

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
      }
    }
  }

  return finalize(grid, placed)
}

// ─── Public dispatcher ───────────────────────────────────────────

export function generateCrossword(
  words: WordEntry[],
  algorithm: CrosswordAlgorithm = "compact",
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
    default:
      return generateCompact(words)
  }
}
