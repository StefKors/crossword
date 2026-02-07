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

  const moveToNextCell = useCallback(
    (row: number, col: number, dir: Direction): { row: number; col: number } | null => {
      const nextRow = dir === "down" ? row + 1 : row
      const nextCol = dir === "across" ? col + 1 : col
      if (isValidCell(nextRow, nextCol)) {
        return { row: nextRow, col: nextCol }
      }
      return null
    },
    [isValidCell],
  )

  const moveToPrevCell = useCallback(
    (row: number, col: number, dir: Direction): { row: number; col: number } | null => {
      const prevRow = dir === "down" ? row - 1 : row
      const prevCol = dir === "across" ? col - 1 : col
      if (isValidCell(prevRow, prevCol)) {
        return { row: prevRow, col: prevCol }
      }
      return null
    },
    [isValidCell],
  )

  const onCellInput = useCallback(
    (row: number, col: number, value: string) => {
      const key = `${row},${col}`
      const next = { ...cellValues, [key]: value }
      setCellValuesState(next)
      onCellChange?.(next)

      // Auto-advance to next cell in current direction
      const nextCell = moveToNextCell(row, col, selectedDirection)
      if (nextCell) {
        setSelectedCell(nextCell)
      }
    },
    [cellValues, selectedDirection, moveToNextCell, onCellChange],
  )

  const onBackspace = useCallback(() => {
    if (!selectedCell) return
    const key = `${selectedCell.row},${selectedCell.col}`

    if (cellValues[key]) {
      // Clear current cell — use empty string so the change persists via merge
      const next = { ...cellValues, [key]: "" }
      setCellValuesState(next)
      onCellChange?.(next)
    } else {
      // Move back and clear that cell
      const prev = moveToPrevCell(selectedCell.row, selectedCell.col, selectedDirection)
      if (prev) {
        const prevKey = `${prev.row},${prev.col}`
        const next = { ...cellValues, [prevKey]: "" }
        setCellValuesState(next)
        onCellChange?.(next)
        setSelectedCell(prev)
      }
    }
  }, [selectedCell, cellValues, selectedDirection, moveToPrevCell, onCellChange])

  const onNavigate = useCallback(
    (dir: "up" | "down" | "left" | "right") => {
      if (!selectedCell) return
      let { row, col } = selectedCell

      switch (dir) {
        case "up":
          row--
          break
        case "down":
          row++
          break
        case "left":
          col--
          break
        case "right":
          col++
          break
      }

      if (isValidCell(row, col)) {
        setSelectedCell({ row, col })
        // Update direction based on arrow key
        if (dir === "left" || dir === "right") {
          setSelectedDirection("across")
        } else {
          setSelectedDirection("down")
        }
      }
    },
    [selectedCell, isValidCell],
  )

  const onTab = useCallback(
    (shift: boolean) => {
      // Move to next/previous word
      const sortedWords = [...data.words].sort((a, b) => {
        if (a.row !== b.row) return a.row - b.row
        return a.col - b.col
      })

      if (sortedWords.length === 0) return

      // Find current word index
      let currentIdx = -1
      if (selectedCell) {
        currentIdx = sortedWords.findIndex((w) => {
          if (w.direction !== selectedDirection) return false
          if (w.direction === "across") {
            return (
              w.row === selectedCell.row &&
              selectedCell.col >= w.col &&
              selectedCell.col < w.col + w.word.length
            )
          }
          return (
            w.col === selectedCell.col &&
            selectedCell.row >= w.row &&
            selectedCell.row < w.row + w.word.length
          )
        })
      }

      let nextIdx: number
      if (shift) {
        nextIdx = currentIdx <= 0 ? sortedWords.length - 1 : currentIdx - 1
      } else {
        nextIdx = currentIdx >= sortedWords.length - 1 ? 0 : currentIdx + 1
      }

      const nextWord = sortedWords[nextIdx]
      setSelectedCell({ row: nextWord.row, col: nextWord.col })
      setSelectedDirection(nextWord.direction)
    },
    [data.words, selectedCell, selectedDirection],
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
