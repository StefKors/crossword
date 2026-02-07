import { useState } from "react"
import { id } from "@instantdb/react"
import { motion } from "motion/react"
import { db } from "../../../lib/db"
import type { CrosswordData } from "../../../types/crossword"
import styles from "./CrosswordSaver.module.css"

interface CrosswordSaverProps {
  data: CrosswordData
  userId: string
}

function formatDateTitle(dateStr: string): string {
  // Parse YYYY-MM-DD as local date (avoid timezone offset by splitting)
  const [year, month, day] = dateStr.split("-").map(Number)
  const d = new Date(year, month - 1, day)
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

export function CrosswordSaver({ data, userId }: CrosswordSaverProps) {
  const today = new Date().toISOString().split("T")[0]
  const [title, setTitle] = useState(() => formatDateTitle(today))
  const [date, setDate] = useState(today)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleDateChange = (newDate: string) => {
    setDate(newDate)
    // Update title to match new date if it's still a date-formatted title
    if (newDate) {
      setTitle(formatDateTitle(newDate))
    }
  }

  const handleSave = async () => {
    if (!title || !date) return
    setSaving(true)
    try {
      await db.transact(
        db.tx.crosswords[id()]
          .update({
            title,
            date,
            grid: data.grid,
            words: data.words,
            width: data.width,
            height: data.height,
            status: "draft",
            createdAt: Date.now(),
          })
          .link({ creator: userId }),
      )
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
      setTitle("")
    } catch (err) {
      console.error("Save failed:", err)
      alert("Failed to save crossword. Check console for details.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>Save Crossword</h3>

      <div className={styles.fields}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="cw-title">
            Title
          </label>
          <input
            id="cw-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Monday, February 7, 2026"
            className={styles.input}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="cw-date">
            Date
          </label>
          <input
            id="cw-date"
            type="date"
            value={date}
            onChange={(e) => handleDateChange(e.target.value)}
            className={styles.input}
          />
        </div>
      </div>

      <motion.button
        className={styles.saveBtn}
        onClick={handleSave}
        disabled={saving || !title || !date}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.97 }}
      >
        {saving ? "Saving..." : saved ? "Saved!" : "Save to Database"}
      </motion.button>

      {saved && (
        <motion.p
          className={styles.success}
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
        >
          Crossword saved successfully as a draft.
        </motion.p>
      )}
    </div>
  )
}
