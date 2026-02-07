import { useState } from "react"
import { motion } from "motion/react"
import { THEME_PRESETS } from "../../../lib/themePresets"
import type { SearchProgress } from "../../../lib/semanticSearch"
import type { WordEntry } from "../../../types/crossword"
import styles from "./WordPicker.module.css"

interface WordPickerProps {
  words: WordEntry[]
  onGenerate: () => void
  wordCount: number
  onWordCountChange: (count: number) => void
  onThemeSearch: (theme: string) => void
  themeLoading: boolean
  themeProgress: SearchProgress | null
  loading?: boolean
}

const STAGE_LABELS: Record<SearchProgress["stage"], { label: string; detail: string }> = {
  "loading-model": {
    label: "Loading AI model",
    detail: "Downloading embedding model (~23MB, cached after first load)",
  },
  "embedding-words": {
    label: "Embedding words",
    detail: "Computing word vectors (one-time, cached in browser)",
  },
  searching: {
    label: "Searching",
    detail: "Finding the most relevant words for your theme",
  },
}

export function WordPicker({
  words,
  onGenerate,
  wordCount,
  onWordCountChange,
  onThemeSearch,
  themeLoading,
  themeProgress,
  loading,
}: WordPickerProps) {
  const [themeInput, setThemeInput] = useState("")
  const [selectedPreset, setSelectedPreset] = useState("")

  const handleThemeSearch = () => {
    const theme = themeInput || selectedPreset
    if (!theme) return
    onThemeSearch(theme)
  }

  const handlePresetChange = (value: string) => {
    setSelectedPreset(value)
    setThemeInput("")
    if (value) {
      onThemeSearch(value)
    }
  }

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && themeInput) {
      handleThemeSearch()
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>Words{words.length > 0 && ` (${words.length})`}</h3>
      </div>

      {/* Theme search section */}
      <div className={styles.themeSection}>
        <span className={styles.sectionLabel}>Theme</span>
        <div className={styles.themeRow}>
          <select
            value={selectedPreset}
            onChange={(e) => handlePresetChange(e.target.value)}
            className={styles.themeSelect}
            disabled={themeLoading}
          >
            <option value="">Pick a theme...</option>
            {THEME_PRESETS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <span className={styles.themeDivider}>or</span>
          <input
            type="text"
            value={themeInput}
            onChange={(e) => {
              setThemeInput(e.target.value)
              setSelectedPreset("")
            }}
            onKeyDown={handleInputKeyDown}
            placeholder="Type a custom theme..."
            className={styles.themeInput}
            disabled={themeLoading}
          />
          <motion.button
            className={styles.themeBtn}
            onClick={handleThemeSearch}
            disabled={themeLoading || (!themeInput && !selectedPreset)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
          >
            {themeLoading ? "Searching..." : "Search"}
          </motion.button>
        </div>

        {themeProgress && themeLoading && (
          <div className={styles.progressSection}>
            <div className={styles.progressHeader}>
              <span className={styles.progressLabel}>
                {STAGE_LABELS[themeProgress.stage].label}
              </span>
              <span className={styles.progressPercent}>{themeProgress.percent}%</span>
            </div>
            <div className={styles.progressTrack}>
              <motion.div
                className={styles.progressBar}
                initial={{ width: 0 }}
                animate={{ width: `${themeProgress.percent}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            <span className={styles.progressDetail}>
              {STAGE_LABELS[themeProgress.stage].detail}
            </span>
          </div>
        )}
      </div>

      {/* Divider */}
      <div className={styles.divider}>
        <span className={styles.dividerText}>or generate randomly</span>
      </div>

      {/* Random generation section */}
      <div className={styles.randomSection}>
        <div className={styles.sliderRow}>
          <label htmlFor="word-count" className={styles.sliderLabel}>
            Word count
          </label>
          <input
            id="word-count"
            type="range"
            min={6}
            max={40}
            value={wordCount}
            onChange={(e) => onWordCountChange(Number(e.target.value))}
            className={styles.slider}
          />
          <span className={styles.sliderValue}>{wordCount}</span>
        </div>

        <motion.button
          className={styles.generateBtn}
          onClick={onGenerate}
          disabled={loading}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
        >
          {loading ? "Generating..." : "Generate Random Words"}
        </motion.button>
      </div>

      {/* Word list */}
      {words.length > 0 && (
        <div className={styles.list}>
          {words.map((entry, i) => (
            <motion.div
              key={`${entry.word}-${i}`}
              className={styles.wordItem}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.02 }}
            >
              <span className={styles.word}>{entry.word}</span>
              <span className={styles.definition}>{entry.definition}</span>
            </motion.div>
          ))}
        </div>
      )}

      {words.length === 0 && !themeLoading && (
        <p className={styles.empty}>Search by theme or generate random words to get started.</p>
      )}
    </div>
  )
}
