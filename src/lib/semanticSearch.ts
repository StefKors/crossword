/**
 * Client-side semantic search — main thread API.
 *
 * All heavy work (model loading, ONNX inference, batch embedding,
 * IndexedDB caching, cosine similarity) runs in a Web Worker so the
 * UI stays completely responsive.
 *
 * Usage (from AdminDashboard):
 *   const { searchByTheme } = await import("../lib/semanticSearch");
 *   const results = await searchByTheme("ocean", words, 25, (p) => setProgress(p));
 */

import type { WordEntry } from "../types/crossword"

export type SearchProgress = {
  stage: "loading-model" | "embedding-words" | "searching"
  percent: number
}

// ─── Worker singleton ────────────────────────────────────────────

let _worker: Worker | null = null
let _requestId = 0

function getWorker(): Worker {
  if (_worker) return _worker
  _worker = new Worker(new URL("./semanticSearch.worker.ts", import.meta.url), {
    type: "module",
  })
  return _worker
}

/**
 * Search for words related to a theme using semantic similarity.
 * Runs entirely in a Web Worker — the main thread stays unblocked.
 */
export function searchByTheme(
  theme: string,
  words: WordEntry[],
  count: number,
  onProgress?: (progress: SearchProgress) => void,
): Promise<WordEntry[]> {
  return new Promise((resolve, reject) => {
    const worker = getWorker()
    const id = ++_requestId

    const handler = (e: MessageEvent) => {
      const msg = e.data
      if (msg.id !== id) return

      if (msg.type === "progress") {
        onProgress?.(msg.progress)
      } else if (msg.type === "result") {
        worker.removeEventListener("message", handler)
        resolve(msg.words)
      } else if (msg.type === "error") {
        worker.removeEventListener("message", handler)
        reject(new Error(msg.message))
      }
    }

    worker.addEventListener("message", handler)
    worker.postMessage({ type: "search", id, theme, words, count })
  })
}
