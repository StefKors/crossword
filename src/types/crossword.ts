export type Direction = "across" | "down"

export interface PlacedWord {
  word: string
  definition: string
  row: number
  col: number
  direction: Direction
  clueNumber: number
}

export type PuzzleType = "classic" | "fillin"

export interface CrosswordData {
  grid: (string | null)[][]
  words: PlacedWord[]
  width: number
  height: number
  avgPlayability?: number
  puzzleType?: PuzzleType
}

export interface WordEntry {
  word: string
  definition: string
}

// ─── Classic crossword algorithms ────────────────────────────────
export type ClassicAlgorithm = "original" | "compact" | "dense" | "fitted" | "smart"

// ─── Fill-in puzzle algorithms ───────────────────────────────────
export type FillinAlgorithm = "fillin-smart"

export type CrosswordAlgorithm = ClassicAlgorithm | FillinAlgorithm

export type CellState = Record<string, string>
