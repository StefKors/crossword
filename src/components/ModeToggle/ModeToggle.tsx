import { Switch } from "@base-ui-components/react/switch"
import type { PuzzleMode } from "../../types/crossword"
import styles from "./ModeToggle.module.css"

interface ModeToggleProps {
  mode: PuzzleMode
  onChange: (mode: PuzzleMode) => void
}

export function ModeToggle({ mode, onChange }: ModeToggleProps) {
  const isClassic = mode === "classic"

  return (
    <div className={styles.container}>
      <span className={`${styles.label} ${!isClassic ? styles.activeLabel : ""}`}>Fill it in</span>
      <Switch.Root
        checked={isClassic}
        onCheckedChange={(checked) => onChange(checked ? "classic" : "fillin")}
        className={styles.switch}
      >
        <Switch.Thumb className={styles.thumb} />
      </Switch.Root>
      <span className={`${styles.label} ${isClassic ? styles.activeLabel : ""}`}>Classic</span>
    </div>
  )
}
