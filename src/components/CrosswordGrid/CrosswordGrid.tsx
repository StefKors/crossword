import { useCallback, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "motion/react"
import type { CrosswordData, Direction, PlacedWord } from "../../types/crossword"
import styles from "./CrosswordGrid.module.css"

interface CrosswordGridProps {
  data: CrosswordData
  /** If true, cells are interactive (clickable, typeable) */
  interactive?: boolean
  /** Show solution letters (for admin preview) */
  showSolution?: boolean
  /** Current user input, keyed by "row,col" */
  cellValues?: Record<string, string>
  /** Currently selected cell */
  selectedCell?: { row: number; col: number } | null
  /** Current input direction */
  selectedDirection?: Direction
  /** Called when user clicks a cell */
  onCellSelect?: (row: number, col: number) => void
  /** Called when user types a letter */
  onCellInput?: (row: number, col: number, value: string) => void
  /** Called when user presses navigation keys */
  onNavigate?: (direction: "up" | "down" | "left" | "right") => void
  /** Called when user presses backspace */
  onBackspace?: () => void
  /** Called when user presses tab */
  onTab?: (shift: boolean) => void
}

export function CrosswordGrid({
  data,
  interactive = false,
  showSolution = false,
  cellValues = {},
  selectedCell = null,
  selectedDirection = "across",
  onCellSelect,
  onCellInput,
  onNavigate,
  onBackspace,
  onTab,
}: CrosswordGridProps) {
  const gridRef = useRef<HTMLDivElement>(null)

  // Build clue number map
  const clueNumbers = buildClueNumberMap(data.words)

  // Build set of cells that belong to the selected word
  const highlightedCells = getHighlightedCells(data, selectedCell, selectedDirection)

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!interactive || !selectedCell) return

      if (e.key.length === 1 && /^[a-zA-Z]$/.test(e.key)) {
        e.preventDefault()
        onCellInput?.(selectedCell.row, selectedCell.col, e.key.toUpperCase())
      } else if (e.key === "Backspace") {
        e.preventDefault()
        onBackspace?.()
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        onNavigate?.("up")
      } else if (e.key === "ArrowDown") {
        e.preventDefault()
        onNavigate?.("down")
      } else if (e.key === "ArrowLeft") {
        e.preventDefault()
        onNavigate?.("left")
      } else if (e.key === "ArrowRight") {
        e.preventDefault()
        onNavigate?.("right")
      } else if (e.key === "Tab") {
        e.preventDefault()
        onTab?.(e.shiftKey)
      }
    },
    [interactive, selectedCell, onCellInput, onNavigate, onBackspace, onTab],
  )

  useEffect(() => {
    const el = gridRef.current
    if (!el || !interactive) return
    el.addEventListener("keydown", handleKeyDown)
    return () => el.removeEventListener("keydown", handleKeyDown)
  }, [handleKeyDown, interactive])

  return (
    <div
      ref={gridRef}
      className={styles.grid}
      style={{
        gridTemplateColumns: `repeat(${data.width}, var(--grid-cell-size))`,
        gridTemplateRows: `repeat(${data.height}, var(--grid-cell-size))`,
      }}
      tabIndex={interactive ? 0 : undefined}
      role={interactive ? "grid" : "img"}
      aria-label="Crossword grid"
    >
      {data.grid.map((row, r) =>
        row.map((cell, c) => {
          const key = `${r},${c}`
          const clueNum = clueNumbers.get(key)
          const isBlack = cell === null
          const isSelected = selectedCell?.row === r && selectedCell?.col === c
          const isHighlighted = highlightedCells.has(key)
          const userValue = cellValues[key] ?? ""
          const solutionLetter = cell

          return (
            <motion.div
              key={key}
              className={`${styles.cell} ${isBlack ? styles.black : ""} ${isSelected ? styles.selected : ""} ${isHighlighted ? styles.highlighted : ""}`}
              onClick={interactive && !isBlack ? () => onCellSelect?.(r, c) : undefined}
              whileTap={interactive && !isBlack ? { scale: 0.95 } : undefined}
              role={interactive && !isBlack ? "gridcell" : undefined}
              aria-label={
                !isBlack
                  ? `Row ${r + 1}, Column ${c + 1}${clueNum ? `, Clue ${clueNum}` : ""}`
                  : undefined
              }
            >
              {clueNum && <span className={styles.clueNumber}>{clueNum}</span>}
              {!isBlack && (
                <AnimatePresence mode="popLayout">
                  {(showSolution && solutionLetter) || userValue ? (
                    <motion.span
                      key={showSolution ? solutionLetter : userValue}
                      className={styles.letter}
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      transition={{
                        type: "spring",
                        stiffness: 500,
                        damping: 25,
                      }}
                    >
                      {showSolution ? solutionLetter : userValue}
                    </motion.span>
                  ) : null}
                </AnimatePresence>
              )}
            </motion.div>
          )
        }),
      )}
    </div>
  )
}

function buildClueNumberMap(words: PlacedWord[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const w of words) {
    const key = `${w.row},${w.col}`
    if (!map.has(key)) {
      map.set(key, w.clueNumber)
    }
  }
  return map
}

function getHighlightedCells(
  data: CrosswordData,
  selectedCell: { row: number; col: number } | null,
  direction: Direction,
): Set<string> {
  const set = new Set<string>()
  if (!selectedCell) return set

  // Find the word at the selected cell in the given direction
  const word = data.words.find((w) => {
    if (w.direction !== direction) return false
    if (direction === "across") {
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

  if (word) {
    for (let i = 0; i < word.word.length; i++) {
      const r = word.direction === "across" ? word.row : word.row + i
      const c = word.direction === "across" ? word.col + i : word.col
      set.add(`${r},${c}`)
    }
  }

  return set
}
