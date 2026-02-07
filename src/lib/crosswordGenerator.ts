import type { CrosswordData, Direction, PlacedWord, WordEntry } from "../types/crossword"

const GRID_SIZE = 80 // oversized working grid, trimmed later

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

/**
 * Generate a crossword puzzle from a list of words.
 *
 * Algorithm:
 * 1. Sort words longest-first
 * 2. Place first word horizontally at center
 * 3. For each remaining word, find best intersecting placement
 * 4. Retry unplaced words
 * 5. Trim grid, assign clue numbers
 */
export function generateCrossword(words: WordEntry[]): CrosswordData {
  const grid: (string | null)[][] = Array.from({ length: GRID_SIZE }, () =>
    Array.from({ length: GRID_SIZE }, () => null),
  )

  // Sort by length descending (longer words first for better placement)
  const sorted = [...words].sort((a, b) => b.word.length - a.word.length)

  const placed: GridWord[] = []
  const unplaced: WordEntry[] = []

  // Place first word horizontally at center
  const first = sorted[0]
  const centerRow = Math.floor(GRID_SIZE / 2)
  const centerCol = Math.floor((GRID_SIZE - first.word.length) / 2)

  placeWord(grid, first.word, centerRow, centerCol, "across")
  placed.push({
    word: first.word,
    definition: first.definition,
    row: centerRow,
    col: centerCol,
    direction: "across",
  })

  // Try to place each remaining word
  for (let i = 1; i < sorted.length; i++) {
    const entry = sorted[i]
    const placement = findBestPlacement(grid, placed, entry.word)

    if (placement) {
      placeWord(grid, entry.word, placement.row, placement.col, placement.direction)
      placed.push({
        word: entry.word,
        definition: entry.definition,
        row: placement.row,
        col: placement.col,
        direction: placement.direction,
      })
    } else {
      unplaced.push(entry)
    }
  }

  // Retry unplaced words (some may fit now that more words are on the grid)
  for (let pass = 0; pass < 3; pass++) {
    const stillUnplaced: WordEntry[] = []
    for (const entry of unplaced) {
      const placement = findBestPlacement(grid, placed, entry.word)
      if (placement) {
        placeWord(grid, entry.word, placement.row, placement.col, placement.direction)
        placed.push({
          word: entry.word,
          definition: entry.definition,
          row: placement.row,
          col: placement.col,
          direction: placement.direction,
        })
      } else {
        stillUnplaced.push(entry)
      }
    }
    unplaced.length = 0
    unplaced.push(...stillUnplaced)
    if (stillUnplaced.length === 0) break
  }

  // Trim grid to bounding box
  const { trimmedGrid, offsetRow, offsetCol } = trimGrid(grid)
  const height = trimmedGrid.length
  const width = trimmedGrid[0]?.length ?? 0

  // Adjust word positions to trimmed grid
  const adjustedWords: GridWord[] = placed.map((w) => ({
    ...w,
    row: w.row - offsetRow,
    col: w.col - offsetCol,
  }))

  // Assign clue numbers
  const finalWords = assignClueNumbers(adjustedWords, width, height)

  return {
    grid: trimmedGrid,
    words: finalWords,
    width,
    height,
  }
}

function placeWord(
  grid: (string | null)[][],
  word: string,
  row: number,
  col: number,
  direction: Direction,
): void {
  for (let i = 0; i < word.length; i++) {
    if (direction === "across") {
      grid[row][col + i] = word[i]
    } else {
      grid[row + i][col] = word[i]
    }
  }
}

function findBestPlacement(
  grid: (string | null)[][],
  placed: GridWord[],
  word: string,
): Placement | null {
  const candidates: Placement[] = []
  const center = GRID_SIZE / 2

  for (const existing of placed) {
    // Try crossing: if existing is across, new goes down and vice versa
    const newDirection: Direction = existing.direction === "across" ? "down" : "across"

    for (let ei = 0; ei < existing.word.length; ei++) {
      for (let wi = 0; wi < word.length; wi++) {
        if (existing.word[ei] !== word[wi]) continue

        let row: number, col: number
        if (existing.direction === "across") {
          // Existing is horizontal, intersection at existing.row, existing.col + ei
          // New word goes down, so new word starts at: row = existing.row - wi, col = existing.col + ei
          row = existing.row - wi
          col = existing.col + ei
        } else {
          // Existing is vertical, intersection at existing.row + ei, existing.col
          // New word goes across, so new word starts at: row = existing.row + ei, col = existing.col - wi
          row = existing.row + ei
          col = existing.col - wi
        }

        if (isValidPlacement(grid, word, row, col, newDirection)) {
          const intersections = countIntersections(grid, word, row, col, newDirection)

          // Score: prefer more intersections and closer to center
          const midRow = row + (newDirection === "down" ? word.length / 2 : 0)
          const midCol = col + (newDirection === "across" ? word.length / 2 : 0)
          const distFromCenter = Math.abs(midRow - center) + Math.abs(midCol - center)
          const score = intersections * 10 - distFromCenter

          candidates.push({
            row,
            col,
            direction: newDirection,
            intersections,
            score,
          })
        }
      }
    }
  }

  if (candidates.length === 0) return null

  // Sort by score descending, pick best
  candidates.sort((a, b) => b.score - a.score)
  return candidates[0]
}

function isValidPlacement(
  grid: (string | null)[][],
  word: string,
  row: number,
  col: number,
  direction: Direction,
): boolean {
  const len = word.length

  // Check bounds
  if (direction === "across") {
    if (row < 0 || row >= GRID_SIZE || col < 0 || col + len > GRID_SIZE) return false
  } else {
    if (row < 0 || row + len > GRID_SIZE || col < 0 || col >= GRID_SIZE) return false
  }

  // Check the cell before the word (must be empty)
  if (direction === "across") {
    if (col > 0 && grid[row][col - 1] !== null) return false
  } else {
    if (row > 0 && grid[row - 1][col] !== null) return false
  }

  // Check the cell after the word (must be empty)
  if (direction === "across") {
    if (col + len < GRID_SIZE && grid[row][col + len] !== null) return false
  } else {
    if (row + len < GRID_SIZE && grid[row + len][col] !== null) return false
  }

  for (let i = 0; i < len; i++) {
    const r = direction === "across" ? row : row + i
    const c = direction === "across" ? col + i : col
    const existing = grid[r][c]

    if (existing !== null) {
      // Cell occupied — must match our letter (intersection)
      if (existing !== word[i]) return false
    } else {
      // Cell is empty — check that adjacent parallel cells are empty
      // to prevent creating unintended words
      if (direction === "across") {
        // Check above and below
        if (r > 0 && grid[r - 1][c] !== null) return false
        if (r < GRID_SIZE - 1 && grid[r + 1][c] !== null) return false
      } else {
        // Check left and right
        if (c > 0 && grid[r][c - 1] !== null) return false
        if (c < GRID_SIZE - 1 && grid[r][c + 1] !== null) return false
      }
    }
  }

  return true
}

function countIntersections(
  grid: (string | null)[][],
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

function trimGrid(grid: (string | null)[][]): {
  trimmedGrid: (string | null)[][]
  offsetRow: number
  offsetCol: number
} {
  let minRow = GRID_SIZE
  let maxRow = 0
  let minCol = GRID_SIZE
  let maxCol = 0

  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (grid[r][c] !== null) {
        minRow = Math.min(minRow, r)
        maxRow = Math.max(maxRow, r)
        minCol = Math.min(minCol, c)
        maxCol = Math.max(maxCol, c)
      }
    }
  }

  if (minRow > maxRow) {
    return { trimmedGrid: [[]], offsetRow: 0, offsetCol: 0 }
  }

  const trimmedGrid: (string | null)[][] = []
  for (let r = minRow; r <= maxRow; r++) {
    const row: (string | null)[] = []
    for (let c = minCol; c <= maxCol; c++) {
      row.push(grid[r][c])
    }
    trimmedGrid.push(row)
  }

  return { trimmedGrid, offsetRow: minRow, offsetCol: minCol }
}

function assignClueNumbers(words: GridWord[], width: number, height: number): PlacedWord[] {
  // Build a map of (row, col, direction) to word
  const wordMap = new Map<string, GridWord>()
  for (const w of words) {
    wordMap.set(`${w.row},${w.col},${w.direction}`, w)
  }

  // Collect all starting positions
  const starts = new Map<string, { across?: GridWord; down?: GridWord }>()
  for (const w of words) {
    const key = `${w.row},${w.col}`
    const existing = starts.get(key) ?? {}
    if (w.direction === "across") existing.across = w
    else existing.down = w
    starts.set(key, existing)
  }

  // Assign clue numbers in reading order (top-to-bottom, left-to-right)
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
