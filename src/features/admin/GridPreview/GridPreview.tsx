import { CrosswordGrid } from "../../../components/CrosswordGrid/CrosswordGrid"
import type { CrosswordData } from "../../../types/crossword"
import styles from "./GridPreview.module.css"

interface GridPreviewProps {
  data: CrosswordData
}

export function GridPreview({ data }: GridPreviewProps) {
  return (
    <div className={styles.container}>
      <h3 className={styles.title}>Grid Preview</h3>
      <p className={styles.stats}>
        {data.width} &times; {data.height} &mdash; {data.words.length} words placed
      </p>
      <div className={styles.gridWrapper}>
        <CrosswordGrid data={data} showSolution />
      </div>
    </div>
  )
}
