import { useCallback, useEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import { id as instantId } from "@instantdb/react"
import { db } from "../lib/db"
import { useCrosswordInteraction } from "../lib/useCrosswordInteraction"
import { CrosswordGrid } from "../components/CrosswordGrid/CrosswordGrid"
import { ModeToggle } from "../components/ModeToggle/ModeToggle"
import { CluePanel } from "../features/daily/CluePanel/CluePanel"
import { ProgressBar } from "../features/daily/ProgressBar/ProgressBar"
import { StatsCard } from "../features/daily/StatsCard/StatsCard"
import type { CrosswordData, Direction, PuzzleMode, CellState } from "../types/crossword"
import styles from "./DailyCrossword.module.css"

export function DailyCrossword() {
  const today = new Date().toISOString().split("T")[0]

  const { data, isLoading } = db.useQuery({
    crosswords: {
      $: { where: { date: today, status: "published" } },
    },
  })

  if (isLoading) {
    return (
      <div className={styles.loading}>
        <p>Loading today&apos;s puzzle...</p>
      </div>
    )
  }

  const crossword = data?.crosswords?.[0]
  if (!crossword) {
    return (
      <div className={styles.empty}>
        <h2>No Puzzle Today</h2>
        <p>Check back tomorrow for a new crossword!</p>
      </div>
    )
  }

  const puzzleData: CrosswordData = {
    grid: crossword.grid as (string | null)[][],
    words: crossword.words as CrosswordData["words"],
    width: crossword.width,
    height: crossword.height,
  }

  return <PuzzlePlayer data={puzzleData} crosswordId={crossword.id} date={today} />
}

function PuzzlePlayer({
  data,
  crosswordId,
  date,
}: {
  data: CrosswordData
  crosswordId: string
  date: string
}) {
  const [mode, setMode] = useState<PuzzleMode>("classic")
  const [showStats, setShowStats] = useState(false)
  const [startTime] = useState(() => Date.now())
  const [elapsed, setElapsed] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const { user } = db.useAuth()
  const progressIdRef = useRef<string | null>(null)

  // Query existing progress
  const { data: progressData } = db.useQuery(
    user
      ? {
          userProgress: {
            $: {
              where: {
                "user.id": user.id,
                "crossword.id": crosswordId,
              },
            },
          },
        }
      : null,
  )

  const existingProgress = progressData?.userProgress?.[0]

  const handleCellChange = useCallback(
    (values: CellState) => {
      if (!user) return

      const pid = progressIdRef.current ?? existingProgress?.id ?? instantId()
      progressIdRef.current = pid

      const elapsedSec = Math.floor((Date.now() - startTime) / 1000)

      void db.transact(
        db.tx.userProgress[pid]
          .merge({
            cellState: values,
            timeSpent: elapsedSec,
            mode,
            date,
          })
          .link({ user: user.id, crossword: crosswordId }),
      )
    },
    [user, existingProgress?.id, startTime, mode, date, crosswordId],
  )

  const interaction = useCrosswordInteraction(data, handleCellChange)

  // Restore saved cell state
  useEffect(() => {
    if (existingProgress?.cellState && Object.keys(interaction.cellValues).length === 0) {
      interaction.setCellValues(existingProgress.cellState as CellState)
      progressIdRef.current = existingProgress.id
    }
  }, [existingProgress]) // eslint-disable-line react-hooks/exhaustive-deps

  // Timer
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000))
    }, 1000)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [startTime])

  // Check for completion
  useEffect(() => {
    if (interaction.isComplete && !showStats) {
      setShowStats(true)
      if (timerRef.current) clearInterval(timerRef.current)

      // Save final state
      if (user) {
        const pid = progressIdRef.current ?? existingProgress?.id ?? instantId()
        void db.transact(
          db.tx.userProgress[pid]
            .merge({
              completedAt: Date.now(),
              correctCells: interaction.correctCount,
              totalCells: interaction.totalCount,
              timeSpent: elapsed,
            })
            .link({ user: user.id, crossword: crosswordId }),
        )
      }
    }
  }, [interaction.isComplete]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleClueClick = useCallback(
    (row: number, col: number, _direction: Direction) => {
      interaction.onCellSelect(row, col)
      // Force direction to match the clue
      // We do a second click to toggle if needed
      setTimeout(() => {
        interaction.onCellSelect(row, col)
      }, 0)
    },
    [interaction],
  )

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, "0")}`
  }

  return (
    <motion.div
      className={styles.page}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div className={styles.header}>
        <h2>Daily Crossword</h2>
        <div className={styles.controls}>
          <span className={styles.timer}>{formatTime(elapsed)}</span>
          <ModeToggle mode={mode} onChange={setMode} />
        </div>
      </div>

      <div
        className={`${styles.content} ${mode === "classic" ? styles.classicLayout : styles.fillinLayout}`}
      >
        <div className={styles.clueSection}>
          <AnimatePresence mode="wait">
            <motion.div
              key={mode}
              initial={{ opacity: 0, x: mode === "classic" ? -10 : 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: mode === "classic" ? -10 : 10 }}
              transition={{ duration: 0.2 }}
              className={styles.cluePanelWrapper}
            >
              <CluePanel
                data={data}
                mode={mode}
                cellValues={interaction.cellValues}
                selectedCell={interaction.selectedCell}
                selectedDirection={interaction.selectedDirection}
                onClueClick={handleClueClick}
              />
            </motion.div>
          </AnimatePresence>
        </div>

        <div className={styles.gridSection}>
          <CrosswordGrid
            data={data}
            interactive
            cellValues={interaction.cellValues}
            selectedCell={interaction.selectedCell}
            selectedDirection={interaction.selectedDirection}
            onCellSelect={interaction.onCellSelect}
            onCellInput={interaction.onCellInput}
            onNavigate={interaction.onNavigate}
            onBackspace={interaction.onBackspace}
            onTab={interaction.onTab}
          />
          <ProgressBar correct={interaction.correctCount} total={interaction.totalCount} />
        </div>
      </div>

      <StatsCard
        open={showStats}
        onClose={() => setShowStats(false)}
        timeSpent={elapsed}
        correctCells={interaction.correctCount}
        totalCells={interaction.totalCount}
      />
    </motion.div>
  )
}
