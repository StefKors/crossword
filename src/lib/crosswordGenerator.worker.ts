/**
 * Web Worker for crossword generation.
 * Runs the algorithm off the main thread so the UI stays responsive.
 */

import { generateCrossword } from "./crosswordGenerator"
import type { CrosswordAlgorithm, CrosswordData, WordEntry } from "../types/crossword"

interface GenerateRequest {
  type: "generate"
  id: number
  words: WordEntry[]
  algorithm: CrosswordAlgorithm
}

type WorkerMessage =
  | { type: "progress"; id: number; message: string; percent: number }
  | { type: "result"; id: number; data: CrosswordData }
  | { type: "error"; id: number; message: string }

self.onmessage = (e: MessageEvent<GenerateRequest>) => {
  if (e.data.type !== "generate") return

  const { id, words, algorithm } = e.data
  const send = (msg: WorkerMessage) => self.postMessage(msg)

  try {
    const data = generateCrossword(words, algorithm, (message, percent) => {
      send({ type: "progress", id, message, percent })
    })
    send({ type: "result", id, data })
  } catch (err) {
    send({
      type: "error",
      id,
      message: err instanceof Error ? err.message : String(err),
    })
  }
}
