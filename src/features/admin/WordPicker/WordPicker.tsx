import { useState } from "react"
import { motion } from "motion/react"
import { getThemeList } from "../../../lib/wordlist"
import type { WordEntry } from "../../../types/crossword"
import styles from "./WordPicker.module.css"

interface WordPickerProps {
  words: WordEntry[]
  onGenerate: () => void
  wordCount: number
  onWordCountChange: (count: number) => void
  onThemeSearch: (theme: string) => void
  loading?: boolean
}

const themes = getThemeList()

export function WordPicker({
  words,
  onGenerate,
  wordCount,
  onWordCountChange,
  onThemeSearch,
  loading,
}: WordPickerProps) {
  const [selectedPreset, setSelectedPreset] = useState("")

  const handlePresetChange = (value: string) => {
    setSelectedPreset(value)
    if (value) {
      onThemeSearch(value)
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
        <select
          value={selectedPreset}
          onChange={(e) => handlePresetChange(e.target.value)}
          className={styles.themeSelect}
        >
          <option value="">Pick a theme...</option>
          {themes.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
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

      {words.length === 0 && (
        <p className={styles.empty}>Pick a theme or generate random words to get started.</p>
      )}
    </div>
  )
}
