import { Progress } from "@base-ui-components/react/progress"
import styles from "./ProgressBar.module.css"

interface ProgressBarProps {
  correct: number
  total: number
}

export function ProgressBar({ correct, total }: ProgressBarProps) {
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0

  return (
    <div className={styles.container}>
      <Progress.Root value={correct} max={total} className={styles.root}>
        <div className={styles.header}>
          <span className={styles.label}>Progress</span>
          <span className={styles.value}>{pct}%</span>
        </div>
        <Progress.Track className={styles.track}>
          <Progress.Indicator className={styles.indicator} />
        </Progress.Track>
      </Progress.Root>
    </div>
  )
}
