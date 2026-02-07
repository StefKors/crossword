import { motion } from "motion/react"
import type { WordEntry } from "../../../types/crossword"
import styles from "./WordPicker.module.css"

interface WordPickerProps {
  words: WordEntry[]
  onGenerate: () => void
  loading?: boolean
}

export function WordPicker({ words, onGenerate, loading }: WordPickerProps) {
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>Words{words.length > 0 && ` (${words.length})`}</h3>
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
        <p className={styles.empty}>
          Click &ldquo;Generate Random Words&rdquo; to select 35-45 words for your crossword.
        </p>
      )}
    </div>
  )
}
