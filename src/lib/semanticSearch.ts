/**
 * Client-side semantic search using @huggingface/transformers.
 *
 * This module is designed to be lazy-loaded via dynamic import() so that
 * the ~23MB embedding model and ONNX runtime never enter the user-facing bundle.
 *
 * Usage (from AdminDashboard):
 *   const { searchByTheme } = await import("../lib/semanticSearch");
 *   const results = await searchByTheme("ocean", words, 25, (pct) => setProgress(pct));
 */

import type { WordEntry } from "../types/crossword"

// ─── Lazy pipeline singleton ─────────────────────────────────────

type FeatureExtractionPipeline = (
  texts: string | string[],
  options?: { pooling?: string; normalize?: boolean },
) => Promise<{ tolist: () => number[][] }>

let _pipeline: FeatureExtractionPipeline | null = null
let _pipelinePromise: Promise<FeatureExtractionPipeline> | null = null

async function getEmbedder(): Promise<FeatureExtractionPipeline> {
  if (_pipeline) return _pipeline
  if (_pipelinePromise) return _pipelinePromise

  _pipelinePromise = (async () => {
    const { pipeline } = await import("@huggingface/transformers")
    const p = await pipeline("feature-extraction", "TaylorAI/gte-tiny", {
      dtype: "q8" as const,
    })
    _pipeline = p as unknown as FeatureExtractionPipeline
    return _pipeline
  })()

  return _pipelinePromise
}

// ─── Vector math ─────────────────────────────────────────────────

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-8)
}

// ─── IndexedDB cache ─────────────────────────────────────────────

const DB_NAME = "crossword-embeddings"
const DB_VERSION = 1
const STORE_NAME = "vectors"

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function getCachedVectors(): Promise<Map<string, number[]> | null> {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly")
      const store = tx.objectStore(STORE_NAME)
      const req = store.get("word-vectors")
      req.onsuccess = () => {
        const data = req.result as Record<string, number[]> | undefined
        if (data) {
          resolve(new Map(Object.entries(data)))
        } else {
          resolve(null)
        }
      }
      req.onerror = () => reject(req.error)
    })
  } catch {
    return null
  }
}

async function setCachedVectors(vectors: Map<string, number[]>): Promise<void> {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite")
      const store = tx.objectStore(STORE_NAME)
      const data = Object.fromEntries(vectors)
      const req = store.put(data, "word-vectors")
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  } catch {
    // Silently fail -- cache is optional
  }
}

// ─── Batch embedding ─────────────────────────────────────────────

async function embedTexts(
  texts: string[],
  onProgress?: (completed: number, total: number) => void,
): Promise<number[][]> {
  const embedder = await getEmbedder()
  const BATCH_SIZE = 64
  const results: number[][] = []

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE)
    const output = await embedder(batch, { pooling: "mean", normalize: true })
    const vectors = output.tolist()
    results.push(...vectors)
    onProgress?.(Math.min(i + BATCH_SIZE, texts.length), texts.length)
  }

  return results
}

// ─── Public API ──────────────────────────────────────────────────

export type SearchProgress = {
  stage: "loading-model" | "embedding-words" | "searching"
  percent: number
}

/**
 * Search for words related to a theme using semantic similarity.
 *
 * @param theme - The theme text (e.g. "ocean", "space exploration")
 * @param words - The word list to search through
 * @param count - How many words to return
 * @param onProgress - Progress callback for UI updates
 * @returns Top `count` words sorted by relevance to the theme
 */
export async function searchByTheme(
  theme: string,
  words: WordEntry[],
  count: number,
  onProgress?: (progress: SearchProgress) => void,
): Promise<WordEntry[]> {
  // Step 1: Load the model
  onProgress?.({ stage: "loading-model", percent: 0 })
  await getEmbedder()
  onProgress?.({ stage: "loading-model", percent: 100 })

  // Step 2: Get or compute word definition embeddings
  onProgress?.({ stage: "embedding-words", percent: 0 })

  // Filter to crossword-suitable words
  const suitable = words.filter((w) => w.word.length >= 3 && w.word.length <= 15)

  // Check cache
  let vectorMap = await getCachedVectors()
  const uncachedWords: WordEntry[] = []
  const uncachedTexts: string[] = []

  if (!vectorMap) {
    vectorMap = new Map()
  }

  for (const w of suitable) {
    if (!vectorMap.has(w.word)) {
      uncachedWords.push(w)
      uncachedTexts.push(`${w.word.toLowerCase()}: ${w.definition}`)
    }
  }

  if (uncachedTexts.length > 0) {
    const vectors = await embedTexts(uncachedTexts, (done, total) => {
      onProgress?.({ stage: "embedding-words", percent: Math.round((done / total) * 100) })
    })

    for (let i = 0; i < uncachedWords.length; i++) {
      vectorMap.set(uncachedWords[i].word, vectors[i])
    }

    // Cache for next time
    void setCachedVectors(vectorMap)
  }

  onProgress?.({ stage: "embedding-words", percent: 100 })

  // Step 3: Embed the theme and compute similarities
  onProgress?.({ stage: "searching", percent: 0 })

  const [themeVector] = await embedTexts([theme])

  const scored = suitable
    .map((w) => {
      const vec = vectorMap!.get(w.word)
      if (!vec) return { entry: w, score: -1 }
      return { entry: w, score: cosineSimilarity(themeVector, vec) }
    })
    .filter((s) => s.score >= 0)

  scored.sort((a, b) => b.score - a.score)

  onProgress?.({ stage: "searching", percent: 100 })

  return scored.slice(0, count).map((s) => s.entry)
}
