import { useCallback, useState } from "react"
import type { CrosswordData, Direction, CellState } from "../types/crossword"

interface UseCrosswordInteractionReturn {
  selectedCell: { row: number; col: number } | null
  selectedDirection: Direction
  cellValues: CellState
  onCellSelect: (row: number, col: number) => void
  onCellInput: (row: number, col: number, value: string) => void
  onNavigate: (dir: "up" | "down" | "left" | "right") => void
  onBackspace: () => void
  onTab: (shift: boolean) => void
  setCellValues: (values: CellState) => void
  isComplete: boolean
  correctCount: number
  totalCount: number
}

export function useCrosswordInteraction(
  data: CrosswordData,
  onCellChange?: (values: CellState) => void,
): UseCrosswordInteractionReturn {
  const [selectedCell, setSelectedCell] = useState<{
    row: number
    col: number
  } | null>(null)
  const [selectedDirection, setSelectedDirection] = useState<Direction>("across")
  const [cellValues, setCellValuesState] = useState<CellState>({})

  const setCellValues = useCallback((values: CellState) => {
    setCellValuesState(values)
  }, [])

  // Count fillable cells
  const fillableCells = new Set<string>()
  for (let r = 0; r < data.height; r++) {
    for (let c = 0; c < data.width; c++) {
      if (data.grid[r][c] !== null) {
        fillableCells.add(`${r},${c}`)
      }
    }
  }
  const totalCount = fillableCells.size

  // Count correct cells
  let correctCount = 0
  for (const key of fillableCells) {
    const [r, c] = key.split(",").map(Number)
    if (cellValues[key] === data.grid[r][c]) {
      correctCount++
    }
  }
  const isComplete = correctCount === totalCount && totalCount > 0

  const isValidCell = useCallback(
    (row: number, col: number) => {
      return (
        row >= 0 &&
        row < data.height &&
        col >= 0 &&
        col < data.width &&
        data.grid[row][col] !== null
      )
    },
    [data],
  )

  /**
   * Find the next valid cell in a direction, skipping over black squares.
   * If we go past the edge of the grid, wrap to the next row/column.
   * Returns null if no valid cell is found (shouldn't happen in a normal grid).
   */
  const findNextValidCell = useCallback(
    (
      startRow: number,
      startCol: number,
      dir: "up" | "down" | "left" | "right",
    ): { row: number; col: number } | null => {
      let row = startRow
      let col = startCol

      // Try scanning in the given direction, wrapping rows/columns
      for (let attempts = 0; attempts < data.width * data.height; attempts++) {
        switch (dir) {
          case "right":
            col++
            if (col >= data.width) {
              col = 0
              row++
              if (row >= data.height) row = 0
            }
            break
          case "left":
            col--
            if (col < 0) {
              col = data.width - 1
              row--
              if (row < 0) row = data.height - 1
            }
            break
          case "down":
            row++
            if (row >= data.height) {
              row = 0
              col++
              if (col >= data.width) col = 0
            }
            break
          case "up":
            row--
            if (row < 0) {
              row = data.height - 1
              col--
              if (col < 0) col = data.width - 1
            }
            break
        }

        if (isValidCell(row, col)) {
          return { row, col }
        }
      }
      return null
    },
    [data, isValidCell],
  )

  /** Find the first valid cell in reading order */
  const findFirstCell = useCallback((): { row: number; col: number } | null => {
    for (let r = 0; r < data.height; r++) {
      for (let c = 0; c < data.width; c++) {
        if (data.grid[r][c] !== null) {
          return { row: r, col: c }
        }
      }
    }
    return null
  }, [data])

  const onCellSelect = useCallback(
    (row: number, col: number) => {
      if (!isValidCell(row, col)) return

      // If clicking the same cell, toggle direction
      if (selectedCell?.row === row && selectedCell?.col === col) {
        setSelectedDirection((d) => (d === "across" ? "down" : "across"))
      } else {
        setSelectedCell({ row, col })
      }
    },
    [selectedCell, isValidCell],
  )

  const onCellInput = useCallback(
    (row: number, col: number, value: string) => {
      const key = `${row},${col}`
      const next = { ...cellValues, [key]: value }
      setCellValuesState(next)
      onCellChange?.(next)

      // Auto-advance to next cell in current direction, skipping gaps
      const advanceDir = selectedDirection === "across" ? "right" : "down"
      const nextCell = findNextValidCell(row, col, advanceDir as "right" | "down")
      if (nextCell) {
        setSelectedCell(nextCell)
      }
    },
    [cellValues, selectedDirection, findNextValidCell, onCellChange],
  )

  const onBackspace = useCallback(() => {
    if (!selectedCell) return
    const key = `${selectedCell.row},${selectedCell.col}`

    if (cellValues[key]) {
      // Clear current cell
      const next = { ...cellValues, [key]: "" }
      setCellValuesState(next)
      onCellChange?.(next)
    } else {
      // Move back and clear that cell
      const backDir = selectedDirection === "across" ? "left" : "up"
      const prev = findNextValidCell(selectedCell.row, selectedCell.col, backDir as "left" | "up")
      if (prev) {
        const prevKey = `${prev.row},${prev.col}`
        const next = { ...cellValues, [prevKey]: "" }
        setCellValuesState(next)
        onCellChange?.(next)
        setSelectedCell(prev)
      }
    }
  }, [selectedCell, cellValues, selectedDirection, findNextValidCell, onCellChange])

  const onNavigate = useCallback(
    (dir: "up" | "down" | "left" | "right") => {
      if (!selectedCell) {
        // No cell selected — select first cell
        const first = findFirstCell()
        if (first) setSelectedCell(first)
        return
      }

      const next = findNextValidCell(selectedCell.row, selectedCell.col, dir)
      if (next) {
        setSelectedCell(next)
        // Update direction based on arrow key
        if (dir === "left" || dir === "right") {
          setSelectedDirection("across")
        } else {
          setSelectedDirection("down")
        }
      }
    },
    [selectedCell, findNextValidCell, findFirstCell],
  )

  const onTab = useCallback(
    (_shift: boolean) => {
      if (!selectedCell) {
        const first = findFirstCell()
        if (first) setSelectedCell(first)
        return
      }

      // Toggle direction on current cell
      setSelectedDirection((d) => (d === "across" ? "down" : "across"))
    },
    [selectedCell, findFirstCell],
  )

  return {
    selectedCell,
    selectedDirection,
    cellValues,
    onCellSelect,
    onCellInput,
    onNavigate,
    onBackspace,
    onTab,
    setCellValues,
    isComplete,
    correctCount,
    totalCount,
  }
}
