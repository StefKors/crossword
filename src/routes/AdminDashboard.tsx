import { useState } from "react"
import { Navigate } from "react-router-dom"
import { motion } from "motion/react"
import { db } from "../lib/db"
import { getRandomWords } from "../lib/wordlist"
import { generateCrossword } from "../lib/crosswordGenerator"
import { WordPicker } from "../features/admin/WordPicker/WordPicker"
import { GridPreview } from "../features/admin/GridPreview/GridPreview"
import { CrosswordSaver } from "../features/admin/CrosswordSaver/CrosswordSaver"
import type { CrosswordData, WordEntry } from "../types/crossword"
import styles from "./AdminDashboard.module.css"

function AdminContent() {
  const user = db.useUser()
  const [words, setWords] = useState<WordEntry[]>([])
  const [crosswordData, setCrosswordData] = useState<CrosswordData | null>(null)
  const [generating, setGenerating] = useState(false)

  // Fetch saved crosswords
  const { data: savedData } = db.useQuery({
    crosswords: {
      $: { order: { createdAt: "desc" } },
    },
  })

  const handleGenerateWords = () => {
    const randomWords = getRandomWords(35, 45)
    setWords(randomWords)
    setCrosswordData(null)
  }

  const handleGenerateCrossword = () => {
    if (words.length === 0) return
    setGenerating(true)
    // Use setTimeout to avoid blocking the UI during generation
    setTimeout(() => {
      const data = generateCrossword(words)
      setCrosswordData(data)
      setGenerating(false)
    }, 50)
  }

  const handlePublish = async (crosswordId: string) => {
    await db.transact(db.tx.crosswords[crosswordId].update({ status: "published" }))
  }

  const handleUnpublish = async (crosswordId: string) => {
    await db.transact(db.tx.crosswords[crosswordId].update({ status: "draft" }))
  }

  const savedCrosswords = savedData?.crosswords ?? []

  return (
    <div className={styles.page}>
      <h2>Admin Dashboard</h2>

      <div className={styles.grid}>
        <div className={styles.left}>
          <WordPicker words={words} onGenerate={handleGenerateWords} />

          {words.length > 0 && (
            <motion.button
              className={styles.buildBtn}
              onClick={handleGenerateCrossword}
              disabled={generating}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {generating ? "Generating Crossword..." : "Generate Crossword"}
            </motion.button>
          )}

          {crosswordData && <CrosswordSaver data={crosswordData} userId={user.id} />}
        </div>

        <div className={styles.right}>
          {crosswordData && <GridPreview data={crosswordData} />}

          {savedCrosswords.length > 0 && (
            <div className={styles.savedSection}>
              <h3 className={styles.savedTitle}>Saved Crosswords</h3>
              <div className={styles.savedList}>
                {savedCrosswords.map((cw) => (
                  <div key={cw.id} className={styles.savedItem}>
                    <div className={styles.savedInfo}>
                      <span className={styles.savedName}>{cw.title}</span>
                      <span className={styles.savedDate}>{cw.date}</span>
                    </div>
                    <div className={styles.savedActions}>
                      <span
                        className={`${styles.badge} ${cw.status === "published" ? styles.published : styles.draft}`}
                      >
                        {cw.status}
                      </span>
                      <motion.button
                        className={styles.publishBtn}
                        onClick={() =>
                          cw.status === "published" ? handleUnpublish(cw.id) : handlePublish(cw.id)
                        }
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.97 }}
                      >
                        {cw.status === "published" ? "Unpublish" : "Publish"}
                      </motion.button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function AdminDashboard() {
  const { isLoading, user } = db.useAuth()

  if (isLoading) {
    return (
      <div className={styles.loading}>
        <p>Loading...</p>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return <AdminContent />
}
