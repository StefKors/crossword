/**
 * Fill-In Puzzle Generator
 *
 * Generates "ΑΜΕΡΙΚΑΝΙΚΟ ΣΤΑΥΡΟΛΕΞΟ" / Reverse Crossword puzzles.
 * These puzzles are mostly white — black squares act as thin separators.
 * The player is given a word bank (grouped by length) and must figure out
 * where each word goes based on intersections.
 *
 * Algorithm:
 * 1. Generate a high-density grid template by breaking long runs
 * 2. Extract all word slots and their crossings
 * 3. Fill via constraint-satisfaction (backtracking + MRV + forward checking)
 * 4. Run multiple attempts, pick best result
 */

import type { CrosswordData, Direction, PlacedWord } from "../types/crossword"
import { parseWordlist, getPlayabilityScore } from "./wordlist"

// ─── Types ───────────────────────────────────────────────────────

type Grid = boolean[][] // true = white, false = black

interface Slot {
  row: number
  col: number
  direction: Direction
  length: number
  crossings: Crossing[]
}

interface Crossing {
  indexInSlot: number
  otherSlotIdx: number
  indexInOtherSlot: number
}

// ─── Grid Template Generation ────────────────────────────────────

export const MAX_SLOT_LENGTH = 8
export const MIN_SLOT_LENGTH = 3

function makeWhiteGrid(w: number, h: number): Grid {
  return Array.from({ length: h }, () => Array.from({ length: w }, () => true))
}

/**
 * Find all horizontal/vertical runs of white cells in the grid.
 * Returns arrays of { start, length } for each row/col.
 */
function findRuns(
  grid: Grid,
  width: number,
  height: number,
  direction: "row" | "col",
): { line: number; start: number; length: number }[] {
  const runs: { line: number; start: number; length: number }[] = []
  const primary = direction === "row" ? height : width
  const secondary = direction === "row" ? width : height

  for (let i = 0; i < primary; i++) {
    let runStart = -1
    for (let j = 0; j <= secondary; j++) {
      const isWhite =
        j < secondary &&
        (direction === "row" ? grid[i][j] : grid[j][i])

      if (isWhite) {
        if (runStart === -1) runStart = j
      } else {
        if (runStart !== -1) {
          runs.push({ line: i, start: runStart, length: j - runStart })
          runStart = -1
        }
      }
    }
  }

  return runs
}

/**
 * Place a black cell and its 180-degree symmetric partner.
 * Returns false if placement would create invalid short slots.
 */
function placeBlackPair(
  grid: Grid,
  r: number,
  c: number,
  width: number,
  height: number,
): boolean {
  const sr = height - 1 - r
  const sc = width - 1 - c
  const isSame = r === sr && c === sc

  // Skip if already black
  if (!grid[r][c]) return false
  if (!isSame && !grid[sr][sc]) return false

  // Tentatively place
  grid[r][c] = false
  if (!isSame) grid[sr][sc] = false

  // Validate: no short slots created, whites still connected
  if (hasInvalidSlots(grid, width, height) || !isConnected(grid, width, height)) {
    grid[r][c] = true
    if (!isSame) grid[sr][sc] = true
    return false
  }

  return true
}

/**
 * Check for any run of length 1 or 2 (invalid slot lengths).
 */
function hasInvalidSlots(grid: Grid, width: number, height: number): boolean {
  // Check horizontal
  for (let r = 0; r < height; r++) {
    let run = 0
    for (let c = 0; c <= width; c++) {
      if (c < width && grid[r][c]) {
        run++
      } else {
        if (run === 1 || run === 2) return true
        run = 0
      }
    }
  }
  // Check vertical
  for (let c = 0; c < width; c++) {
    let run = 0
    for (let r = 0; r <= height; r++) {
      if (r < height && grid[r][c]) {
        run++
      } else {
        if (run === 1 || run === 2) return true
        run = 0
      }
    }
  }
  return false
}

/**
 * BFS connectivity check — all white cells must be reachable from the first one.
 */
function isConnected(grid: Grid, width: number, height: number): boolean {
  let startR = -1
  let startC = -1
  let total = 0

  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      if (grid[r][c]) {
        total++
        if (startR === -1) { startR = r; startC = c }
      }
    }
  }
  if (total === 0) return true

  const visited = Array.from({ length: height }, () => new Uint8Array(width))
  const queue: number[] = [startR, startC]
  visited[startR][startC] = 1
  let count = 0

  while (queue.length > 0) {
    const qr = queue.shift()!
    const qc = queue.shift()!
    count++
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
      const nr = qr + dr
      const nc = qc + dc
      if (nr >= 0 && nr < height && nc >= 0 && nc < width && grid[nr][nc] && !visited[nr][nc]) {
        visited[nr][nc] = 1
        queue.push(nr, nc)
      }
    }
  }

  return count === total
}

/**
 * Generate a fill-in grid template.
 *
 * Strategy:
 * 1. Start fully white
 * 2. Break any run longer than MAX_SLOT_LENGTH by inserting symmetric black pairs
 * 3. Add a few scattered blacks for variety (up to target density)
 * 4. Validate connectivity and no short slots
 */
export function generateTemplate(width: number, height: number): Grid {
  const grid = makeWhiteGrid(width, height)

  // Phase 1: Break long runs iteratively until all slots are <= MAX_SLOT_LENGTH
  for (let pass = 0; pass < 20; pass++) {
    let broke = false

    // Break long horizontal runs — try ALL valid positions (shuffled) per run
    const hRuns = findRuns(grid, width, height, "row")
    for (const run of hRuns) {
      if (run.length <= MAX_SLOT_LENGTH) continue

      const minPos = run.start + MIN_SLOT_LENGTH
      const maxPos = run.start + run.length - MIN_SLOT_LENGTH - 1
      if (minPos > maxPos) continue

      const positions: number[] = []
      for (let p = minPos; p <= maxPos; p++) positions.push(p)
      for (let i = positions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[positions[i], positions[j]] = [positions[j], positions[i]]
      }

      for (const breakCol of positions) {
        if (placeBlackPair(grid, run.line, breakCol, width, height)) {
          broke = true
          break
        }
      }
    }

    // Break long vertical runs — try ALL valid positions (shuffled) per run
    const vRuns = findRuns(grid, width, height, "col")
    for (const run of vRuns) {
      if (run.length <= MAX_SLOT_LENGTH) continue

      const minPos = run.start + MIN_SLOT_LENGTH
      const maxPos = run.start + run.length - MIN_SLOT_LENGTH - 1
      if (minPos > maxPos) continue

      const positions: number[] = []
      for (let p = minPos; p <= maxPos; p++) positions.push(p)
      for (let i = positions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[positions[i], positions[j]] = [positions[j], positions[i]]
      }

      for (const breakRow of positions) {
        if (placeBlackPair(grid, breakRow, run.line, width, height)) {
          broke = true
          break
        }
      }
    }

    if (!broke) break
  }

  // Phase 2: Add a few scatter blacks for variety (aim for ~15-20% total black)
  const totalCells = width * height
  let blackCount = 0
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      if (!grid[r][c]) blackCount++
    }
  }

  const targetBlack = Math.floor(totalCells * 0.18)
  const scatterBudget = Math.max(0, targetBlack - blackCount)

  if (scatterBudget > 0) {
    // Build shuffled candidate list (interior cells only)
    const candidates: [number, number][] = []
    for (let r = 1; r < height - 1; r++) {
      for (let c = 1; c < width - 1; c++) {
        if (grid[r][c]) candidates.push([r, c])
      }
    }
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[candidates[i], candidates[j]] = [candidates[j], candidates[i]]
    }

    let added = 0
    for (const [r, c] of candidates) {
      if (added >= scatterBudget) break
      if (!grid[r][c]) continue // already black

      const sr = height - 1 - r
      const sc = width - 1 - c
      const isSame = r === sr && c === sc

      if (placeBlackPair(grid, r, c, width, height)) {
        added += isSame ? 1 : 2
      }
    }
  }

  return grid
}

// ─── Slot Extraction ─────────────────────────────────────────────

export function extractSlots(grid: Grid, width: number, height: number): Slot[] {
  const slots: Slot[] = []
  const cellMap = new Map<string, { slotIdx: number; pos: number; dir: Direction }[]>()

  const reg = (r: number, c: number, si: number, pos: number, dir: Direction) => {
    const k = `${r},${c}`
    if (!cellMap.has(k)) cellMap.set(k, [])
    cellMap.get(k)!.push({ slotIdx: si, pos, dir })
  }

  // Horizontal slots
  for (let r = 0; r < height; r++) {
    let start = -1
    for (let c = 0; c <= width; c++) {
      if (c < width && grid[r][c]) {
        if (start === -1) start = c
      } else if (start !== -1) {
        const len = c - start
        if (len >= MIN_SLOT_LENGTH) {
          const idx = slots.length
          slots.push({ row: r, col: start, direction: "across", length: len, crossings: [] })
          for (let i = 0; i < len; i++) reg(r, start + i, idx, i, "across")
        }
        start = -1
      }
    }
  }

  // Vertical slots
  for (let c = 0; c < width; c++) {
    let start = -1
    for (let r = 0; r <= height; r++) {
      if (r < height && grid[r][c]) {
        if (start === -1) start = r
      } else if (start !== -1) {
        const len = r - start
        if (len >= MIN_SLOT_LENGTH) {
          const idx = slots.length
          slots.push({ row: start, col: c, direction: "down", length: len, crossings: [] })
          for (let i = 0; i < len; i++) reg(start + i, c, idx, i, "down")
        }
        start = -1
      }
    }
  }

  // Wire crossings
  for (const entries of cellMap.values()) {
    if (entries.length === 2 && entries[0].dir !== entries[1].dir) {
      const [a, b] = entries
      slots[a.slotIdx].crossings.push({
        indexInSlot: a.pos,
        otherSlotIdx: b.slotIdx,
        indexInOtherSlot: b.pos,
      })
      slots[b.slotIdx].crossings.push({
        indexInSlot: b.pos,
        otherSlotIdx: a.slotIdx,
        indexInOtherSlot: a.pos,
      })
    }
  }

  return slots
}

// ─── Dictionary ──────────────────────────────────────────────────

interface WordsByLength {
  [len: number]: string[]
}

let _cachedWords: WordsByLength | null = null

/** Maximum word length to include in the fill-in dictionary (matches longest words in the list) */
const MAX_WORD_LENGTH = 15

export function getWordsByLength(): WordsByLength {
  if (_cachedWords) return _cachedWords

  const all = parseWordlist()
  const byLen: WordsByLength = {}

  for (const entry of all) {
    const w = entry.word
    if (w.length < MIN_SLOT_LENGTH || w.length > MAX_WORD_LENGTH) continue
    if (!byLen[w.length]) byLen[w.length] = []
    byLen[w.length].push(w)
  }

  // Sort by playability descending, keep top N per length for performance
  const MAX_PER_LENGTH = 2000
  for (const len of Object.keys(byLen)) {
    const n = Number(len)
    byLen[n].sort((a, b) => getPlayabilityScore(b) - getPlayabilityScore(a))
    if (byLen[n].length > MAX_PER_LENGTH) {
      byLen[n] = byLen[n].slice(0, MAX_PER_LENGTH)
    }
  }

  _cachedWords = byLen
  return byLen
}

// ─── Constraint-Satisfaction Solver ──────────────────────────────

interface SolverState {
  assignments: (string | null)[]
  domains: Set<string>[]
}

function forwardCheck(
  slotIdx: number,
  word: string,
  slots: Slot[],
  state: SolverState,
): { otherSlotIdx: number; removed: string[] }[] {
  const pruned: { otherSlotIdx: number; removed: string[] }[] = []

  for (const crossing of slots[slotIdx].crossings) {
    if (state.assignments[crossing.otherSlotIdx] !== null) continue

    const requiredLetter = word[crossing.indexInSlot]
    const pos = crossing.indexInOtherSlot
    const domain = state.domains[crossing.otherSlotIdx]
    const removed: string[] = []

    for (const w of domain) {
      if (w[pos] !== requiredLetter) {
        removed.push(w)
      }
    }

    for (const w of removed) domain.delete(w)
    if (removed.length > 0) {
      pruned.push({ otherSlotIdx: crossing.otherSlotIdx, removed })
    }
  }

  return pruned
}

function restoreDomains(
  pruned: { otherSlotIdx: number; removed: string[] }[],
  state: SolverState,
): void {
  for (const { otherSlotIdx, removed } of pruned) {
    for (const w of removed) {
      state.domains[otherSlotIdx].add(w)
    }
  }
}

/**
 * MRV: pick unassigned slot with smallest domain.
 * Ties broken by most crossings (most constrained).
 */
function selectSlot(state: SolverState, slots: Slot[]): number {
  let bestIdx = -1
  let bestSize = Infinity
  let bestCrossings = -1

  for (let i = 0; i < state.assignments.length; i++) {
    if (state.assignments[i] !== null) continue
    const size = state.domains[i].size
    const cross = slots[i].crossings.length
    if (size < bestSize || (size === bestSize && cross > bestCrossings)) {
      bestSize = size
      bestIdx = i
      bestCrossings = cross
    }
  }

  return bestIdx
}

/**
 * Get domain words that are consistent with all assigned crossings.
 * Returns them in playability-biased shuffled order for variety.
 */
function getOrderedCandidates(
  slotIdx: number,
  slots: Slot[],
  state: SolverState,
  usedWords: Set<string>,
): string[] {
  const candidates: string[] = []

  for (const w of state.domains[slotIdx]) {
    if (usedWords.has(w)) continue

    // Check consistency with assigned crossings
    let ok = true
    for (const crossing of slots[slotIdx].crossings) {
      const other = state.assignments[crossing.otherSlotIdx]
      if (other !== null && w[crossing.indexInSlot] !== other[crossing.indexInOtherSlot]) {
        ok = false
        break
      }
    }

    if (ok) candidates.push(w)
  }

  // Shuffle top portion for variety, keep playability ordering otherwise
  const shuffleN = Math.min(candidates.length, 30)
  for (let i = shuffleN - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[candidates[i], candidates[j]] = [candidates[j], candidates[i]]
  }

  return candidates
}

/**
 * Tracks the best partial solution seen during solving.
 * The recursive solver backtracks all assignments on failure,
 * so without this we'd lose all progress when a full solve fails.
 */
interface BestPartial {
  assignments: (string | null)[]
  filledCount: number
}

/**
 * Recursive backtracking solver.
 * Snapshots the best partial fill into `best` whenever we beat the previous record.
 * Uses `depth` to track how many slots are assigned without scanning the array each call.
 */
function solve(
  slots: Slot[],
  state: SolverState,
  usedWords: Set<string>,
  maxBacktracks: number,
  bt: { count: number },
  best: BestPartial,
  depth: number,
): boolean {
  // Snapshot if this is the deepest fill so far
  if (depth > best.filledCount) {
    best.assignments = [...state.assignments]
    best.filledCount = depth
  }

  const idx = selectSlot(state, slots)
  if (idx === -1) return true // All filled

  const candidates = getOrderedCandidates(idx, slots, state, usedWords)

  for (const word of candidates) {
    state.assignments[idx] = word
    usedWords.add(word)

    const pruned = forwardCheck(idx, word, slots, state)

    // Check for domain wipeout
    let wipeout = false
    for (const { otherSlotIdx } of pruned) {
      if (state.domains[otherSlotIdx].size === 0) {
        wipeout = true
        break
      }
    }

    if (!wipeout && solve(slots, state, usedWords, maxBacktracks, bt, best, depth + 1)) {
      return true
    }

    // Backtrack
    bt.count++
    state.assignments[idx] = null
    usedWords.delete(word)
    restoreDomains(pruned, state)

    if (bt.count >= maxBacktracks) return false
  }

  return false
}

// ─── Greedy Patch ────────────────────────────────────────────────

/**
 * After the main solver produces a partial fill, try to fill remaining
 * slots greedily (no backtracking — just find any word that matches the
 * crossing constraints). Processes most-constrained slots first so
 * freshly placed words create new constraints for the next iteration.
 */
function greedyPatch(
  slots: Slot[],
  assignments: (string | null)[],
  wordsByLen: WordsByLength,
): (string | null)[] {
  const result = [...assignments]
  const usedWords = new Set<string>()
  for (const a of result) {
    if (a !== null) usedWords.add(a)
  }

  // Repeat until no more progress — each placed word may unlock neighbours
  let progress = true
  while (progress) {
    progress = false

    // Collect unfilled slots, sorted by most crossing letters known (most constrained first)
    const unfilled: { idx: number; fixed: number }[] = []
    for (let i = 0; i < result.length; i++) {
      if (result[i] !== null) continue
      const fixed = slots[i].crossings.filter(
        (c) => result[c.otherSlotIdx] !== null,
      ).length
      unfilled.push({ idx: i, fixed })
    }
    unfilled.sort((a, b) => b.fixed - a.fixed)

    for (const { idx } of unfilled) {
      if (result[idx] !== null) continue // filled in this iteration
      const slot = slots[idx]
      const words = wordsByLen[slot.length]
      if (!words) continue

      // Build constraint pattern from already-filled crossing words
      const pattern: (string | null)[] = new Array(slot.length).fill(null)
      for (const crossing of slot.crossings) {
        const other = result[crossing.otherSlotIdx]
        if (other !== null) {
          pattern[crossing.indexInSlot] = other[crossing.indexInOtherSlot]
        }
      }

      // Find a matching word (words are pre-sorted by playability)
      for (const word of words) {
        if (usedWords.has(word)) continue

        let matches = true
        for (let i = 0; i < slot.length; i++) {
          if (pattern[i] !== null && pattern[i] !== word[i]) {
            matches = false
            break
          }
        }

        if (matches) {
          result[idx] = word
          usedWords.add(word)
          progress = true
          break
        }
      }
    }
  }

  return result
}

// ─── Assembly ────────────────────────────────────────────────────

function assembleResult(
  template: Grid,
  width: number,
  height: number,
  slots: Slot[],
  assignments: (string | null)[],
): CrosswordData {
  const grid: (string | null)[][] = Array.from({ length: height }, (_, r) =>
    Array.from({ length: width }, (_, c) => (template[r][c] ? "" : null)),
  )

  const placed: { word: string; row: number; col: number; direction: Direction }[] = []

  for (let i = 0; i < slots.length; i++) {
    const word = assignments[i]
    if (!word) continue
    const s = slots[i]
    for (let j = 0; j < s.length; j++) {
      const r = s.direction === "across" ? s.row : s.row + j
      const c = s.direction === "across" ? s.col + j : s.col
      grid[r][c] = word[j]
    }
    placed.push({ word, row: s.row, col: s.col, direction: s.direction })
  }

  // Convert any remaining unfilled white cells to black —
  // no empty white squares should appear in the final puzzle
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      if (grid[r][c] === "") {
        grid[r][c] = null
      }
    }
  }

  // Clue numbering (reading order)
  const starts = new Map<string, { across?: (typeof placed)[0]; down?: (typeof placed)[0] }>()
  for (const w of placed) {
    const key = `${w.row},${w.col}`
    const e = starts.get(key) ?? {}
    if (w.direction === "across") e.across = w
    else e.down = w
    starts.set(key, e)
  }

  const words: PlacedWord[] = []
  let num = 1
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      const e = starts.get(`${r},${c}`)
      if (!e) continue
      const n = num++
      if (e.across) {
        words.push({ word: e.across.word, definition: "", row: r, col: c, direction: "across", clueNumber: n })
      }
      if (e.down) {
        words.push({ word: e.down.word, definition: "", row: r, col: c, direction: "down", clueNumber: n })
      }
    }
  }

  let totalPlay = 0
  for (const w of words) totalPlay += getPlayabilityScore(w.word)
  const avgPlayability = words.length > 0 ? Math.round(totalPlay / words.length) : 0

  return { grid, words, width, height, avgPlayability, puzzleType: "fillin" }
}

// ─── Public API ──────────────────────────────────────────────────

/**
 * Generate a fill-in puzzle.
 * Tries multiple template + solver attempts and picks the best complete fill.
 */
export function generateFillinSmart(
  onProgress?: (msg: string, pct: number) => void,
): CrosswordData {
  const GRID_SIZE = 13
  const NUM_ATTEMPTS = 8
  const MAX_BACKTRACKS = 20_000
  const RESTARTS_PER_TEMPLATE = 3

  const wordsByLen = getWordsByLength()

  let bestResult: CrosswordData | null = null
  let bestScore = -Infinity

  for (let attempt = 0; attempt < NUM_ATTEMPTS; attempt++) {
    const pct = (attempt / NUM_ATTEMPTS) * 100
    onProgress?.(`Fill-in ${attempt + 1}/${NUM_ATTEMPTS}: building grid...`, pct)

    // Generate template
    const template = generateTemplate(GRID_SIZE, GRID_SIZE)
    const slots = extractSlots(template, GRID_SIZE, GRID_SIZE)

    if (slots.length === 0) continue

    // Check all slot lengths have dictionary coverage
    const allCovered = slots.every((s) => {
      const words = wordsByLen[s.length]
      return words && words.length > 0
    })
    if (!allCovered) continue

    onProgress?.(
      `Fill-in ${attempt + 1}/${NUM_ATTEMPTS}: filling ${slots.length} slots...`,
      pct + 5,
    )

    // Try multiple restarts on this template
    for (let restart = 0; restart < RESTARTS_PER_TEMPLATE; restart++) {
      const state: SolverState = {
        assignments: new Array(slots.length).fill(null),
        domains: slots.map((s) => new Set(wordsByLen[s.length] ?? [])),
      }

      const bt = { count: 0 }
      const usedWords = new Set<string>()
      const best: BestPartial = {
        assignments: new Array(slots.length).fill(null),
        filledCount: 0,
      }
      const solved = solve(slots, state, usedWords, MAX_BACKTRACKS, bt, best, 0)

      // Use full solution if solved, otherwise restore best partial fill
      const baseAssignments = solved ? state.assignments : best.assignments
      const baseFilledCount = solved ? slots.length : best.filledCount

      if (baseFilledCount > 0) {
        // Greedy patch: try to fill any remaining slots without backtracking
        const patchedAssignments = solved
          ? baseAssignments
          : greedyPatch(slots, baseAssignments, wordsByLen)
        const patchedFilledCount = patchedAssignments.filter((a) => a !== null).length
        const allFilled = patchedFilledCount === slots.length

        const result = assembleResult(template, GRID_SIZE, GRID_SIZE, slots, patchedAssignments)
        const completeness = patchedFilledCount / slots.length
        const avgPlay = result.avgPlayability ?? 0
        const lengths = new Set(result.words.map((w) => w.word.length))

        const score =
          (allFilled ? 5000 : 0) +
          completeness * 2000 +
          patchedFilledCount * 100 +
          avgPlay * 0.1 +
          lengths.size * 50

        if (score > bestScore) {
          bestScore = score
          bestResult = result
        }

        // Complete fill — stop early
        if (allFilled) break
      }
    }

    // Early exit if we already found a complete fill (score includes 5000 bonus)
    if (bestScore >= 5000) {
      onProgress?.("Done!", 100)
      return bestResult!
    }
  }

  onProgress?.("Done!", 100)

  return bestResult ?? {
    grid: [[]],
    words: [],
    width: 0,
    height: 0,
    avgPlayability: 0,
    puzzleType: "fillin",
  }
}
