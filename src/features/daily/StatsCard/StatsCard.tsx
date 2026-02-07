import { Dialog } from "@base-ui-components/react/dialog"
import { motion, AnimatePresence } from "motion/react"
import styles from "./StatsCard.module.css"

interface StatsCardProps {
  open: boolean
  onClose: () => void
  timeSpent: number
  correctCells: number
  totalCells: number
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, "0")}`
}

export function StatsCard({ open, onClose, timeSpent, correctCells, totalCells }: StatsCardProps) {
  const accuracy = totalCells > 0 ? Math.round((correctCells / totalCells) * 100) : 0

  return (
    <AnimatePresence>
      {open && (
        <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
          <Dialog.Portal>
            <Dialog.Backdrop className={styles.backdrop} />
            <Dialog.Popup
              className={styles.popup}
              render={
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 20 }}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              }
            >
              <Dialog.Title className={styles.title}>Puzzle Complete!</Dialog.Title>
              <Dialog.Description className={styles.description}>
                Great work on today&apos;s crossword.
              </Dialog.Description>

              <div className={styles.statsGrid}>
                <div className={styles.stat}>
                  <span className={styles.statValue}>{formatTime(timeSpent)}</span>
                  <span className={styles.statLabel}>Time</span>
                </div>
                <div className={styles.stat}>
                  <span className={styles.statValue}>{accuracy}%</span>
                  <span className={styles.statLabel}>Accuracy</span>
                </div>
                <div className={styles.stat}>
                  <span className={styles.statValue}>
                    {correctCells}/{totalCells}
                  </span>
                  <span className={styles.statLabel}>Cells</span>
                </div>
              </div>

              <Dialog.Close className={styles.closeBtn}>Done</Dialog.Close>
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      )}
    </AnimatePresence>
  )
}
