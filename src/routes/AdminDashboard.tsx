import { useState } from "react"
import { Navigate } from "react-router-dom"
import { motion } from "motion/react"
import { db } from "../lib/db"
import { useIsAdmin } from "../lib/useIsAdmin"
import { getRandomWords, getWordsByTheme } from "../lib/wordlist"
import { generateCrosswordAsync } from "../lib/crosswordGenerator"
import type { GenerationProgress } from "../lib/crosswordGenerator"
import { WordPicker } from "../features/admin/WordPicker/WordPicker"
import { GridPreview } from "../features/admin/GridPreview/GridPreview"
import { CrosswordSaver } from "../features/admin/CrosswordSaver/CrosswordSaver"
import type { CrosswordAlgorithm, CrosswordData, PuzzleType, WordEntry } from "../types/crossword"
import styles from "./AdminDashboard.module.css"

const CLASSIC_ALGORITHMS: { value: CrosswordAlgorithm; label: string; description: string }[] = [
  { value: "smart", label: "Smart", description: "Multi-attempt, playability-optimized" },
  { value: "fitted", label: "Fitted", description: "Gap-filling, dictionary scan" },
  { value: "compact", label: "Compact", description: "Tight grid, compactness scoring" },
  { value: "dense", label: "Dense", description: "Seed cluster, high overlap" },
  { value: "original", label: "Original", description: "Strict adjacency, greedy" },
]

const FILLIN_ALGORITHMS: { value: CrosswordAlgorithm; label: string; description: string }[] = [
  { value: "fillin-smart", label: "Smart Fill", description: "CSP solver, dense grid, high playability" },
]

function AdminContent() {
  const user = db.useUser()
  const [puzzleType, setPuzzleType] = useState<PuzzleType>("classic")
  const [words, setWords] = useState<WordEntry[]>([])
  const [crosswordData, setCrosswordData] = useState<CrosswordData | null>(null)
  const [generating, setGenerating] = useState(false)
  const [genProgress, setGenProgress] = useState<GenerationProgress | null>(null)
  const [algorithm, setAlgorithm] = useState<CrosswordAlgorithm>("smart")
  const [wordCount, setWordCount] = useState(25)

  const algorithms = puzzleType === "classic" ? CLASSIC_ALGORITHMS : FILLIN_ALGORITHMS

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

  const handleThemeSearch = (theme: string) => {
    const results = getWordsByTheme(theme, wordCount)
    setWords(results)
    setCrosswordData(null)
  }

  const handleGenerateCrossword = async () => {
    if (words.length === 0) return
    setGenerating(true)
    setGenProgress(null)

    try {
      const data = await generateCrosswordAsync(words, algorithm, (progress) => {
        setGenProgress(progress)
      })
      setCrosswordData(data)
    } catch (err) {
      console.error("Generation failed:", err)
      alert("Crossword generation failed. Check console for details.")
    } finally {
      setGenerating(false)
      setGenProgress(null)
    }
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
          />

          <div className={styles.generateSection}>
            <div className={styles.algoSelector}>
              <span className={styles.algoLabel}>Puzzle Type</span>
              <div className={styles.algoOptions}>
                <button
                  className={`${styles.algoOption} ${puzzleType === "classic" ? styles.algoActive : ""}`}
                  onClick={() => {
                    setPuzzleType("classic")
                    setAlgorithm("smart")
                    setCrosswordData(null)
                  }}
                >
                  Classic
                </button>
                <button
                  className={`${styles.algoOption} ${puzzleType === "fillin" ? styles.algoActive : ""}`}
                  onClick={() => {
                    setPuzzleType("fillin")
                    setAlgorithm("fillin-smart")
                    setCrosswordData(null)
                  }}
                >
                  Fill-In
                </button>
              </div>
            </div>

            {(puzzleType === "classic" ? words.length > 0 : true) && (
              <>
                <div className={styles.algoSelector}>
                  <span className={styles.algoLabel}>Algorithm</span>
                  <div className={styles.algoOptions}>
                    {algorithms.map((algo) => (
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
                  onClick={() => void handleGenerateCrossword()}
                  disabled={generating || (puzzleType === "classic" && words.length === 0)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  {generating
                    ? genProgress
                      ? genProgress.message
                      : puzzleType === "fillin"
                        ? "Generating Fill-In Puzzle..."
                        : "Generating Crossword..."
                    : puzzleType === "fillin"
                      ? "Generate Fill-In Puzzle"
                      : "Generate Crossword"}
                </motion.button>
              </>
            )}
          </div>

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
