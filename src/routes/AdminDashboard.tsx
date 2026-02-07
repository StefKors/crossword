import { useCallback, useState } from "react"
import { Navigate } from "react-router-dom"
import { motion } from "motion/react"
import { db } from "../lib/db"
import { useIsAdmin } from "../lib/useIsAdmin"
import { getRandomWords, parseWordlist } from "../lib/wordlist"
import { generateCrossword } from "../lib/crosswordGenerator"
import { WordPicker } from "../features/admin/WordPicker/WordPicker"
import { GridPreview } from "../features/admin/GridPreview/GridPreview"
import { CrosswordSaver } from "../features/admin/CrosswordSaver/CrosswordSaver"
import type { SearchProgress } from "../lib/semanticSearch"
import type { CrosswordAlgorithm, CrosswordData, WordEntry } from "../types/crossword"
import styles from "./AdminDashboard.module.css"

const ALGORITHMS: { value: CrosswordAlgorithm; label: string; description: string }[] = [
  { value: "compact", label: "Compact", description: "Tight grid, relaxed adjacency" },
  { value: "dense", label: "Dense", description: "Seed cluster, high overlap" },
  { value: "fitted", label: "Fitted", description: "Gap-filling, dictionary scan" },
  { value: "original", label: "Original", description: "Strict adjacency, greedy" },
]

function AdminContent() {
  const user = db.useUser()
  const [words, setWords] = useState<WordEntry[]>([])
  const [crosswordData, setCrosswordData] = useState<CrosswordData | null>(null)
  const [generating, setGenerating] = useState(false)
  const [algorithm, setAlgorithm] = useState<CrosswordAlgorithm>("compact")
  const [wordCount, setWordCount] = useState(25)
  const [themeLoading, setThemeLoading] = useState(false)
  const [themeProgress, setThemeProgress] = useState<SearchProgress | null>(null)

  // Fetch saved crosswords
  const { data: savedData } = db.useQuery({
    crosswords: {
      $: { order: { createdAt: "desc" } },
    },
  })

  const handleGenerateWords = () => {
    const randomWords = getRandomWords(wordCount, wordCount)
    setWords(randomWords)
    setCrosswordData(null)
  }

  const handleThemeSearch = useCallback(
    async (theme: string) => {
      setThemeLoading(true)
      setThemeProgress({ stage: "loading-model", percent: 0 })
      setCrosswordData(null)

      try {
        // Dynamic import -- Vite code-splits this into a separate chunk
        const { searchByTheme } = await import("../lib/semanticSearch")

        const allWords = parseWordlist()
        const results = await searchByTheme(theme, allWords, wordCount, (progress) => {
          setThemeProgress(progress)
        })

        setWords(results)
      } catch (err) {
        console.error("Theme search failed:", err)
        alert("Theme search failed. Check console for details.")
      } finally {
        setThemeLoading(false)
        setThemeProgress(null)
      }
    },
    [wordCount],
  )

  const handleGenerateCrossword = () => {
    if (words.length === 0) return
    setGenerating(true)
    setTimeout(() => {
      const data = generateCrossword(words, algorithm)
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

  const handleDelete = async (crosswordId: string) => {
    if (!confirm("Delete this crossword? This cannot be undone.")) return
    await db.transact(db.tx.crosswords[crosswordId].delete())
  }

  const savedCrosswords = savedData?.crosswords ?? []

  return (
    <div className={styles.page}>
      <h2>Admin Dashboard</h2>

      <div className={styles.grid}>
        <div className={styles.left}>
          <WordPicker
            words={words}
            onGenerate={handleGenerateWords}
            wordCount={wordCount}
            onWordCountChange={setWordCount}
            onThemeSearch={handleThemeSearch}
            themeLoading={themeLoading}
            themeProgress={themeProgress}
          />

          {words.length > 0 && (
            <div className={styles.generateSection}>
              <div className={styles.algoSelector}>
                <span className={styles.algoLabel}>Algorithm</span>
                <div className={styles.algoOptions}>
                  {ALGORITHMS.map((algo) => (
                    <button
                      key={algo.value}
                      className={`${styles.algoOption} ${algorithm === algo.value ? styles.algoActive : ""}`}
                      onClick={() => setAlgorithm(algo.value)}
                      title={algo.description}
                    >
                      {algo.label}
                    </button>
                  ))}
                </div>
              </div>

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
            </div>
          )}

          {crosswordData && <CrosswordSaver data={crosswordData} userId={user.id} />}
        </div>

        <div className={styles.right}>
          {crosswordData && (
            <GridPreview data={crosswordData} algorithm={algorithm} totalWords={words.length} />
          )}

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
                      <motion.button
                        className={styles.deleteBtn}
                        onClick={() => handleDelete(cw.id)}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.97 }}
                        aria-label="Delete crossword"
                      >
                        Delete
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
  const { isLoading: authLoading, user } = db.useAuth()
  const { isAdmin, isLoading: adminLoading } = useIsAdmin()

  if (authLoading || adminLoading) {
    return (
      <div className={styles.loading}>
        <p>Loading...</p>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (!isAdmin) {
    return (
      <div className={styles.unauthorized}>
        <h2>Unauthorized</h2>
        <p>You don&apos;t have admin access.</p>
      </div>
    )
  }

  return <AdminContent />
}
