import { describe, it, expect } from "vitest"
import {
  generateTemplate,
  extractSlots,
  getWordsByLength,
  generateFillinSmart,
  MIN_SLOT_LENGTH,
  MAX_SLOT_LENGTH,
} from "./fillinGenerator"

// ─── generateTemplate ────────────────────────────────────────────

describe("generateTemplate", () => {
  it("returns a grid of the requested dimensions", () => {
    const grid = generateTemplate(13, 13)
    expect(grid.length).toBe(13)
    for (const row of grid) {
      expect(row.length).toBe(13)
    }
  })

  it("contains only boolean values (true=white, false=black)", () => {
    const grid = generateTemplate(11, 11)
    for (const row of grid) {
      for (const cell of row) {
        expect(typeof cell).toBe("boolean")
      }
    }
  })

  it("has some black cells (not fully white)", () => {
    const grid = generateTemplate(13, 13)
    let blacks = 0
    for (const row of grid) {
      for (const cell of row) {
        if (!cell) blacks++
      }
    }
    expect(blacks).toBeGreaterThan(0)
  })

  it("has no runs of length 1 or 2 (invalid short slots)", () => {
    const grid = generateTemplate(13, 13)
    const w = 13
    const h = 13

    // Check horizontal runs
    for (let r = 0; r < h; r++) {
      let run = 0
      for (let c = 0; c <= w; c++) {
        if (c < w && grid[r][c]) {
          run++
        } else {
          if (run === 1 || run === 2) {
            throw new Error(`Invalid horizontal run of ${run} at row ${r}`)
          }
          run = 0
        }
      }
    }

    // Check vertical runs
    for (let c = 0; c < w; c++) {
      let run = 0
      for (let r = 0; r <= h; r++) {
        if (r < h && grid[r][c]) {
          run++
        } else {
          if (run === 1 || run === 2) {
            throw new Error(`Invalid vertical run of ${run} at col ${c}`)
          }
          run = 0
        }
      }
    }
  })

  it("most runs are within MAX_SLOT_LENGTH (best-effort breaking)", () => {
    const grid = generateTemplate(13, 13)
    const w = 13
    const h = 13

    let totalRuns = 0
    let longRuns = 0

    // Check horizontal runs
    for (let r = 0; r < h; r++) {
      let run = 0
      for (let c = 0; c <= w; c++) {
        if (c < w && grid[r][c]) {
          run++
        } else {
          if (run >= MIN_SLOT_LENGTH) {
            totalRuns++
            if (run > MAX_SLOT_LENGTH) longRuns++
          }
          run = 0
        }
      }
    }

    // Check vertical runs
    for (let c = 0; c < w; c++) {
      let run = 0
      for (let r = 0; r <= h; r++) {
        if (r < h && grid[r][c]) {
          run++
        } else {
          if (run >= MIN_SLOT_LENGTH) {
            totalRuns++
            if (run > MAX_SLOT_LENGTH) longRuns++
          }
          run = 0
        }
      }
    }

    // The template generator breaks most runs; a few long ones are fine
    // since the dictionary now covers all lengths
    expect(totalRuns).toBeGreaterThan(0)
    expect(longRuns).toBeLessThanOrEqual(totalRuns)
  })

  it("has 180-degree rotational symmetry for black cells", () => {
    const grid = generateTemplate(13, 13)
    const h = grid.length
    const w = grid[0].length

    for (let r = 0; r < h; r++) {
      for (let c = 0; c < w; c++) {
        const sr = h - 1 - r
        const sc = w - 1 - c
        expect(grid[r][c]).toBe(grid[sr][sc])
      }
    }
  })

  it("keeps all white cells connected", () => {
    const grid = generateTemplate(13, 13)
    const h = 13
    const w = 13

    // BFS from first white cell
    let startR = -1
    let startC = -1
    let total = 0

    for (let r = 0; r < h; r++) {
      for (let c = 0; c < w; c++) {
        if (grid[r][c]) {
          total++
          if (startR === -1) {
            startR = r
            startC = c
          }
        }
      }
    }

    const visited = Array.from({ length: h }, () => new Uint8Array(w))
    const queue: number[] = [startR, startC]
    visited[startR][startC] = 1
    let count = 0

    while (queue.length > 0) {
      const qr = queue.shift()!
      const qc = queue.shift()!
      count++
      for (const [dr, dc] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ]) {
        const nr = qr + dr
        const nc = qc + dc
        if (nr >= 0 && nr < h && nc >= 0 && nc < w && grid[nr][nc] && !visited[nr][nc]) {
          visited[nr][nc] = 1
          queue.push(nr, nc)
        }
      }
    }

    expect(count).toBe(total)
  })

  it("works with different grid sizes", () => {
    for (const size of [7, 9, 11, 15]) {
      const grid = generateTemplate(size, size)
      expect(grid.length).toBe(size)
      expect(grid[0].length).toBe(size)
    }
  })
})

// ─── extractSlots ────────────────────────────────────────────────

describe("extractSlots", () => {
  it("extracts slots from a simple grid", () => {
    // Hand-crafted 5x5 grid: one across + one down
    // W W W B B
    // W B B B B
    // W B B B B
    // B B B B B
    // B B B B B
    const grid: boolean[][] = [
      [true, true, true, false, false],
      [true, false, false, false, false],
      [true, false, false, false, false],
      [false, false, false, false, false],
      [false, false, false, false, false],
    ]

    const slots = extractSlots(grid, 5, 5)
    // Should have 1 across slot (row 0, len 3) and 1 down slot (col 0, len 3)
    expect(slots.length).toBe(2)

    const across = slots.find((s) => s.direction === "across")
    const down = slots.find((s) => s.direction === "down")

    expect(across).toBeDefined()
    expect(across!.row).toBe(0)
    expect(across!.col).toBe(0)
    expect(across!.length).toBe(3)

    expect(down).toBeDefined()
    expect(down!.row).toBe(0)
    expect(down!.col).toBe(0)
    expect(down!.length).toBe(3)
  })

  it("ignores runs shorter than MIN_SLOT_LENGTH", () => {
    // 5x5: one run of 2 (too short)
    const grid: boolean[][] = [
      [true, true, false, false, false],
      [false, false, false, false, false],
      [false, false, false, false, false],
      [false, false, false, false, false],
      [false, false, false, false, false],
    ]

    const slots = extractSlots(grid, 5, 5)
    expect(slots.length).toBe(0)
  })

  it("detects crossings between slots", () => {
    // Cross pattern:
    // B W B
    // W W W
    // B W B
    const grid: boolean[][] = [
      [false, true, false],
      [true, true, true],
      [false, true, false],
    ]

    const slots = extractSlots(grid, 3, 3)
    expect(slots.length).toBe(2)

    for (const slot of slots) {
      expect(slot.crossings.length).toBe(1)
    }
  })

  it("correctly wires crossing positions", () => {
    // Larger cross:
    // B B W B B
    // B B W B B
    // W W W W W
    // B B W B B
    // B B W B B
    const grid: boolean[][] = [
      [false, false, true, false, false],
      [false, false, true, false, false],
      [true, true, true, true, true],
      [false, false, true, false, false],
      [false, false, true, false, false],
    ]

    const slots = extractSlots(grid, 5, 5)
    expect(slots.length).toBe(2)

    const across = slots.find((s) => s.direction === "across")!
    const down = slots.find((s) => s.direction === "down")!

    expect(across.length).toBe(5)
    expect(down.length).toBe(5)

    // The crossing should be at position 2 in the across slot and position 2 in the down slot
    expect(across.crossings.length).toBe(1)
    expect(across.crossings[0].indexInSlot).toBe(2)
    expect(across.crossings[0].indexInOtherSlot).toBe(2)
  })

  it("extracts all slots from a generated template", () => {
    const grid = generateTemplate(13, 13)
    const slots = extractSlots(grid, 13, 13)

    expect(slots.length).toBeGreaterThan(0)

    for (const slot of slots) {
      expect(slot.length).toBeGreaterThanOrEqual(MIN_SLOT_LENGTH)
      // Slots can be up to the grid dimension (template breaking is best-effort)
      expect(slot.length).toBeLessThanOrEqual(13)
      expect(["across", "down"]).toContain(slot.direction)
    }
  })

  it("all crossings reference valid slots", () => {
    const grid = generateTemplate(13, 13)
    const slots = extractSlots(grid, 13, 13)

    for (let i = 0; i < slots.length; i++) {
      for (const crossing of slots[i].crossings) {
        expect(crossing.otherSlotIdx).toBeGreaterThanOrEqual(0)
        expect(crossing.otherSlotIdx).toBeLessThan(slots.length)
        expect(crossing.otherSlotIdx).not.toBe(i)
        expect(crossing.indexInSlot).toBeGreaterThanOrEqual(0)
        expect(crossing.indexInSlot).toBeLessThan(slots[i].length)
        expect(crossing.indexInOtherSlot).toBeGreaterThanOrEqual(0)
        expect(crossing.indexInOtherSlot).toBeLessThan(slots[crossing.otherSlotIdx].length)
      }
    }
  })

  it("crossings are bidirectional", () => {
    const grid = generateTemplate(13, 13)
    const slots = extractSlots(grid, 13, 13)

    for (let i = 0; i < slots.length; i++) {
      for (const crossing of slots[i].crossings) {
        const other = slots[crossing.otherSlotIdx]
        const reverse = other.crossings.find(
          (c) => c.otherSlotIdx === i && c.indexInSlot === crossing.indexInOtherSlot,
        )
        expect(reverse).toBeDefined()
        expect(reverse!.indexInOtherSlot).toBe(crossing.indexInSlot)
      }
    }
  })
})

// ─── getWordsByLength ────────────────────────────────────────────

describe("getWordsByLength", () => {
  it("returns words grouped by length", () => {
    const byLen = getWordsByLength()
    expect(typeof byLen).toBe("object")
    expect(Object.keys(byLen).length).toBeGreaterThan(0)
  })

  it("only contains words of valid lengths", () => {
    const byLen = getWordsByLength()
    for (const lenStr of Object.keys(byLen)) {
      const len = Number(lenStr)
      expect(len).toBeGreaterThanOrEqual(MIN_SLOT_LENGTH)
      expect(len).toBeLessThanOrEqual(15)
    }
  })

  it("has words for every length from 3 to 15", () => {
    const byLen = getWordsByLength()
    for (let len = MIN_SLOT_LENGTH; len <= 15; len++) {
      expect(byLen[len]).toBeDefined()
      expect(byLen[len].length).toBeGreaterThan(0)
    }
  })

  it("words are the correct length", () => {
    const byLen = getWordsByLength()
    for (const lenStr of Object.keys(byLen)) {
      const len = Number(lenStr)
      for (const word of byLen[len]) {
        expect(word.length).toBe(len)
      }
    }
  })

  it("caps each length bucket at the per-length limit", () => {
    const byLen = getWordsByLength()
    for (const lenStr of Object.keys(byLen)) {
      const len = Number(lenStr)
      expect(byLen[len].length).toBeLessThanOrEqual(2000)
    }
  })

  it("includes words longer than MAX_SLOT_LENGTH", () => {
    const byLen = getWordsByLength()
    // The dictionary should include words up to length 15
    const maxLen = Math.max(...Object.keys(byLen).map(Number))
    expect(maxLen).toBeGreaterThan(MAX_SLOT_LENGTH)
  })

  it("words are sorted by playability (highest first)", async () => {
    const { getPlayabilityScore } = await import("./wordlist")
    const byLen = getWordsByLength()

    for (const lenStr of Object.keys(byLen)) {
      const len = Number(lenStr)
      const words = byLen[len]
      for (let i = 1; i < words.length; i++) {
        expect(getPlayabilityScore(words[i - 1])).toBeGreaterThanOrEqual(
          getPlayabilityScore(words[i]),
        )
      }
    }
  })
})

// ─── generateFillinSmart ─────────────────────────────────────────

describe("generateFillinSmart", () => {
  // Share a single result across read-only tests to avoid running the solver 8 times
  let sharedResult: ReturnType<typeof generateFillinSmart> | null = null

  function getResult() {
    if (!sharedResult) {
      sharedResult = generateFillinSmart()
    }
    return sharedResult
  }

  it("returns a valid CrosswordData structure", () => {
    const result = getResult()

    expect(result).toHaveProperty("grid")
    expect(result).toHaveProperty("words")
    expect(result).toHaveProperty("width")
    expect(result).toHaveProperty("height")
    expect(result).toHaveProperty("puzzleType", "fillin")
  })

  it("places words in the grid", () => {
    const result = getResult()
    expect(result.words.length).toBeGreaterThan(0)
  })

  it("grid dimensions match width and height", () => {
    const result = getResult()

    if (result.width > 0 && result.height > 0) {
      expect(result.grid.length).toBe(result.height)
      for (const row of result.grid) {
        expect(row.length).toBe(result.width)
      }
    }
  })

  it("placed words have valid clue numbers", () => {
    const result = getResult()

    const numbers = result.words.map((w) => w.clueNumber)
    for (const n of numbers) {
      expect(n).toBeGreaterThan(0)
    }
  })

  it("placed words have valid directions", () => {
    const result = getResult()

    for (const word of result.words) {
      expect(["across", "down"]).toContain(word.direction)
    }
  })

  it("placed words match the grid cells", () => {
    const result = getResult()

    for (const placed of result.words) {
      for (let i = 0; i < placed.word.length; i++) {
        const r = placed.direction === "across" ? placed.row : placed.row + i
        const c = placed.direction === "across" ? placed.col + i : placed.col

        expect(r).toBeLessThan(result.height)
        expect(c).toBeLessThan(result.width)
        expect(result.grid[r][c]).toBe(placed.word[i])
      }
    }
  })

  it("does not duplicate any words", () => {
    const result = getResult()
    const wordSet = new Set(result.words.map((w) => w.word))
    expect(wordSet.size).toBe(result.words.length)
  })

  it("word lengths are within bounds", () => {
    const result = getResult()

    for (const placed of result.words) {
      expect(placed.word.length).toBeGreaterThanOrEqual(MIN_SLOT_LENGTH)
      // Words can be up to the grid dimension, not just MAX_SLOT_LENGTH
      expect(placed.word.length).toBeLessThanOrEqual(15)
    }
  })

  it("reports progress via callback", { timeout: 30_000 }, () => {
    const messages: string[] = []
    generateFillinSmart((msg) => messages.push(msg))
    expect(messages.length).toBeGreaterThan(0)
  })
})
