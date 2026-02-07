import { CrosswordGrid } from "../../../components/CrosswordGrid/CrosswordGrid"
import type { CrosswordAlgorithm, CrosswordData } from "../../../types/crossword"
import styles from "./GridPreview.module.css"

const ALGORITHM_LABELS: Record<CrosswordAlgorithm, string> = {
  original: "Original",
  compact: "Compact",
  dense: "Dense",
  fitted: "Fitted",
}

interface GridPreviewProps {
  data: CrosswordData
  algorithm?: CrosswordAlgorithm
  totalWords?: number
}

export function GridPreview({ data, algorithm, totalWords }: GridPreviewProps) {
  const density = calculateGridDensity(data)

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>Grid Preview</h3>
      <div className={styles.statsRow}>
        {algorithm && <span className={styles.algoTag}>{ALGORITHM_LABELS[algorithm]}</span>}
        <span className={styles.stat}>
          {data.width} &times; {data.height}
        </span>
        <span className={styles.stat}>
          {data.words.length}
          {totalWords ? ` / ${totalWords}` : ""} words
        </span>
        <span className={styles.stat}>{Math.round(density * 100)}% dense</span>
      </div>
      <div className={styles.gridWrapper}>
        <CrosswordGrid data={data} showSolution />
      </div>
    </div>
  )
}

function calculateGridDensity(data: CrosswordData): number {
  if (data.width === 0 || data.height === 0) return 0
  let filled = 0
  for (const row of data.grid) {
    for (const cell of row) {
      if (cell !== null) filled++
    }
  }
  return filled / (data.width * data.height)
}
