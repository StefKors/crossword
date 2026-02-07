export type Direction = "across" | "down"

export interface PlacedWord {
  word: string
  definition: string
  row: number
  col: number
  direction: Direction
  clueNumber: number
}

export interface CrosswordData {
  grid: (string | null)[][]
  words: PlacedWord[]
  width: number
  height: number
}

export interface WordEntry {
  word: string
  definition: string
}

export type PuzzleMode = "fillin" | "classic"

export type CellState = Record<string, string>
