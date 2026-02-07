import { useMemo } from "react"
import { motion } from "motion/react"
import type { CrosswordData, Direction, PuzzleType, CellState } from "../../../types/crossword"
import styles from "./CluePanel.module.css"

interface CluePanelProps {
  data: CrosswordData
  puzzleType: PuzzleType
  cellValues: CellState
  selectedCell: { row: number; col: number } | null
  selectedDirection: Direction
  onClueClick: (row: number, col: number, direction: Direction) => void
}

export function CluePanel({
  data,
  puzzleType,
  cellValues,
  selectedCell,
  selectedDirection,
  onClueClick,
}: CluePanelProps) {
  if (puzzleType === "fillin") {
    return <FillItInPanel data={data} cellValues={cellValues} />
  }

  return (
    <ClassicPanel
      data={data}
      cellValues={cellValues}
      selectedCell={selectedCell}
      selectedDirection={selectedDirection}
      onClueClick={onClueClick}
    />
  )
}

function FillItInPanel({ data, cellValues }: { data: CrosswordData; cellValues: CellState }) {
  // Group words by length
  const groups = useMemo(() => {
    const map = new Map<number, { word: string; solved: boolean }[]>()
    for (const w of data.words) {
      const len = w.word.length
      if (!map.has(len)) map.set(len, [])

      // Check if this word is fully solved
      let solved = true
      for (let i = 0; i < w.word.length; i++) {
        const r = w.direction === "across" ? w.row : w.row + i
        const c = w.direction === "across" ? w.col + i : w.col
        const key = `${r},${c}`
        if (cellValues[key] !== w.word[i]) {
          solved = false
          break
        }
      }

      map.get(len)!.push({ word: w.word, solved })
    }

    // Sort by length, then alphabetically within each group
    return [...map.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([len, words]) => ({
        length: len,
        words: words.sort((a, b) => a.word.localeCompare(b.word)),
      }))
  }, [data.words, cellValues])

  return (
    <div className={styles.fillContainer}>
      <h3 className={styles.fillTitle}>Words to Place</h3>
      <div className={styles.fillGroups}>
        {groups.map((group) => (
          <div key={group.length} className={styles.fillGroup}>
            <h4 className={styles.groupHeader}>{group.length} letters</h4>
            <div className={styles.wordTags}>
              {group.words.map((w, i) => (
                <motion.span
                  key={`${w.word}-${i}`}
                  className={`${styles.wordTag} ${w.solved ? styles.solved : ""}`}
                  layout
                >
                  {w.word}
                </motion.span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ClassicPanel({
  data,
  cellValues,
  selectedCell,
  selectedDirection,
  onClueClick,
}: {
  data: CrosswordData
  cellValues: CellState
  selectedCell: { row: number; col: number } | null
  selectedDirection: Direction
  onClueClick: (row: number, col: number, direction: Direction) => void
}) {
  const acrossClues = data.words.filter((w) => w.direction === "across")
  const downClues = data.words.filter((w) => w.direction === "down")

  const isWordComplete = (w: (typeof data.words)[0]) => {
    for (let i = 0; i < w.word.length; i++) {
      const r = w.direction === "across" ? w.row : w.row + i
      const c = w.direction === "across" ? w.col + i : w.col
      if (cellValues[`${r},${c}`] !== w.word[i]) return false
    }
    return true
  }

  const isWordSelected = (w: (typeof data.words)[0]) => {
    if (!selectedCell || w.direction !== selectedDirection) return false
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
  }

  return (
    <div className={styles.classicContainer}>
      <div className={styles.clueColumn}>
        <h4 className={styles.columnHeader}>Across</h4>
        <div className={styles.clueScroll}>
          <ClueList
            clues={acrossClues}
            isComplete={isWordComplete}
            isSelected={isWordSelected}
            onClueClick={onClueClick}
          />
        </div>
      </div>
      <div className={styles.columnDivider} />
      <div className={styles.clueColumn}>
        <h4 className={styles.columnHeader}>Down</h4>
        <div className={styles.clueScroll}>
          <ClueList
            clues={downClues}
            isComplete={isWordComplete}
            isSelected={isWordSelected}
            onClueClick={onClueClick}
          />
        </div>
      </div>
    </div>
  )
}

function ClueList({
  clues,
  isComplete,
  isSelected,
  onClueClick,
}: {
  clues: CrosswordData["words"]
  isComplete: (w: CrosswordData["words"][0]) => boolean
  isSelected: (w: CrosswordData["words"][0]) => boolean
  onClueClick: (row: number, col: number, direction: Direction) => void
}) {
  return (
    <div className={styles.clueList}>
      {clues.map((clue) => {
        const complete = isComplete(clue)
        const selected = isSelected(clue)
        return (
          <button
            key={`${clue.clueNumber}-${clue.direction}`}
            className={`${styles.clueItem} ${complete ? styles.complete : ""} ${selected ? styles.activeClue : ""}`}
            onClick={() => onClueClick(clue.row, clue.col, clue.direction)}
          >
            <span className={styles.clueNum}>{clue.clueNumber}</span>
            <span className={styles.clueText}>{clue.definition}</span>
          </button>
        )
      })}
    </div>
  )
}
