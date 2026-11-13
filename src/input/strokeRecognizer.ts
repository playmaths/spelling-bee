/**
 * Offline single-letter handwriting recogniser (prototype).
 * Point-cloud matching ($P-style): stroke order and direction do not matter,
 * so it tolerates the way a child happens to form a letter. No model download.
 */

export type Point = [number, number]
export type Stroke = Point[]

const N = 32

/** Points along an ellipse arc; angles in degrees, 0 = right, 90 = down (screen coordinates). */
function arc(cx: number, cy: number, rx: number, ry: number, from: number, to: number): Point[] {
  const steps = Math.max(4, Math.ceil(Math.abs(to - from) / 20))
  return Array.from({ length: steps + 1 }, (_, i) => {
    const a = ((from + ((to - from) * i) / steps) * Math.PI) / 180
    return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)] as Point
  })
}

const stem: Stroke = [[0, 0], [0, 1]]

/** Letter shapes on a unit box (x right, y down). Several variants per letter are allowed. */
const TEMPLATES: [string, Stroke[]][] = [
  ['A', [[[0, 1], [0.5, 0], [1, 1]], [[0.2, 0.6], [0.8, 0.6]]]],
  ['A', [[...arc(0.45, 0.55, 0.45, 0.45, 0, -360)], [[0.9, 0.1], [0.9, 1]]]],
  ['B', [stem, [[0, 0], ...arc(0, 0.25, 0.7, 0.25, -90, 90), ...arc(0, 0.75, 0.8, 0.25, -90, 90)]]],
  ['B', [stem, [...arc(0.45, 0.7, 0.45, 0.3, -180, 180)]]],
  ['C', [[...arc(0.5, 0.5, 0.5, 0.5, -45, -315)]]],
  ['D', [stem, [...arc(0, 0.5, 0.9, 0.5, -90, 90)]]],
  ['D', [[...arc(0.5, 0.7, 0.45, 0.3, 0, -360)], [[0.95, 0], [0.95, 1]]]],
  ['E', [[[1, 0], [0, 0], [0, 1], [1, 1]], [[0, 0.5], [0.8, 0.5]]]],
  ['E', [[[0.1, 0.5], [0.9, 0.5], ...arc(0.5, 0.5, 0.45, 0.5, 0, -300)]]],
  ['F', [[[1, 0], [0, 0], [0, 1]], [[0, 0.5], [0.7, 0.5]]]],
  ['F', [[...arc(0.7, 0.2, 0.3, 0.2, 0, -180), [0.4, 1]], [[0.1, 0.45], [0.8, 0.45]]]],
  ['G', [[...arc(0.5, 0.5, 0.5, 0.5, -45, -330), [1, 0.55], [0.55, 0.55]]]],
  ['G', [[...arc(0.5, 0.3, 0.4, 0.3, 0, -360)], [[0.9, 0], [0.9, 0.8], ...arc(0.5, 0.8, 0.4, 0.2, 0, 150)]]],
  ['H', [stem, [[1, 0], [1, 1]], [[0, 0.5], [1, 0.5]]]],
  ['H', [stem, [[0, 0.6], ...arc(0.5, 0.6, 0.5, 0.2, -180, 0), [1, 1]]]],
  ['I', [[[0.5, 0], [0.5, 1]]]],
  ['I', [[[0.5, 0], [0.5, 1]], [[0.15, 0], [0.85, 0]], [[0.15, 1], [0.85, 1]]]],
  ['I', [[[0.5, 0.35], [0.5, 1]], [[0.5, 0], [0.5, 0.08]]]],
  ['J', [[[0.7, 0], [0.7, 0.7], ...arc(0.4, 0.7, 0.3, 0.3, 0, 180)]]],
  ['K', [stem, [[0.9, 0], [0, 0.55], [0.9, 1]]]],
  ['L', [[[0, 0], [0, 1], [0.8, 1]]]],
  ['M', [[[0, 1], [0, 0], [0.5, 0.6], [1, 0], [1, 1]]]],
  ['M', [[[0, 0], [0, 1]], [[0, 0.3], ...arc(0.25, 0.3, 0.25, 0.3, -180, 0), [0.5, 1]], [[0.5, 0.3], ...arc(0.75, 0.3, 0.25, 0.3, -180, 0), [1, 1]]]],
  ['N', [[[0, 1], [0, 0], [1, 1], [1, 0]]]],
  ['N', [stem, [[0, 0.3], ...arc(0.5, 0.3, 0.5, 0.3, -180, 0), [1, 1]]]],
  ['O', [[...arc(0.5, 0.5, 0.45, 0.5, -90, -450)]]],
  ['P', [stem, [[0, 0], ...arc(0, 0.27, 0.8, 0.27, -90, 90)]]],
  ['Q', [[...arc(0.5, 0.5, 0.45, 0.5, -90, -450)], [[0.6, 0.7], [1, 1]]]],
  ['Q', [[...arc(0.45, 0.3, 0.45, 0.3, 0, -360)], [[0.9, 0], [0.9, 1]]]],
  ['R', [stem, [[0, 0], ...arc(0, 0.27, 0.8, 0.27, -90, 90), [0.9, 1]]]],
  ['R', [stem, [[0, 0.4], ...arc(0.5, 0.4, 0.5, 0.4, -180, -30)]]],
  ['S', [[...arc(0.5, 0.27, 0.45, 0.27, -30, -270), ...arc(0.5, 0.75, 0.45, 0.25, -90, 150)]]],
  ['T', [[[0, 0], [1, 0]], [[0.5, 0], [0.5, 1]]]],
  ['T', [[[0.5, 0], [0.5, 1]], [[0.1, 0.3], [0.9, 0.3]]]],
  ['U', [[[0, 0], [0, 0.6], ...arc(0.5, 0.6, 0.5, 0.4, 180, 0), [1, 0]]]],
  ['V', [[[0, 0], [0.5, 1], [1, 0]]]],
  ['W', [[[0, 0], [0.25, 1], [0.5, 0.3], [0.75, 1], [1, 0]]]],
  ['X', [[[0, 0], [1, 1]], [[1, 0], [0, 1]]]],
  ['Y', [[[0, 0], [0.5, 0.5]], [[1, 0], [0.5, 0.5], [0.5, 1]]]],
  ['Y', [[[0, 0], [0.5, 0.6]], [[1, 0], [0.2, 1]]]],
  ['Z', [[[0, 0], [1, 0], [0, 1], [1, 1]]]],
]

const dist = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1])

/** Resample all strokes to N evenly spaced points, scale to a unit box and centre. */
export function normalize(strokes: Stroke[]): Point[] {
  const clean = strokes.filter((s) => s.length > 0)
  const total = clean.reduce((sum, s) => sum + s.slice(1).reduce((d, p, i) => d + dist(s[i], p), 0), 0)
  let points: Point[] = []
  if (total === 0) {
    points = Array.from({ length: N }, () => clean[0]?.[0] ?? [0, 0])
  } else {
    const step = total / (N - 1)
    let carried = 0
    for (const s of clean) {
      if (points.length === 0) points.push(s[0])
      let prev = s[0]
      for (let i = 1; i < s.length; ) {
        const d = dist(prev, s[i])
        if (d > 0 && carried + d >= step) {
          const t = (step - carried) / d
          const q: Point = [prev[0] + t * (s[i][0] - prev[0]), prev[1] + t * (s[i][1] - prev[1])]
          points.push(q)
          prev = q
          carried = 0
        } else {
          carried += d
          prev = s[i]
          i++
        }
      }
    }
    const last = clean[clean.length - 1]
    while (points.length < N) points.push(last[last.length - 1])
    points = points.slice(0, N)
  }
  const xs = points.map((p) => p[0])
  const ys = points.map((p) => p[1])
  const minX = Math.min(...xs)
  const minY = Math.min(...ys)
  const w = Math.max(...xs) - minX
  const h = Math.max(...ys) - minY
  const size = Math.max(w, h) || 1
  // Stretch to a square so tall-and-thin or short-and-wide handwriting still matches,
  // except for genuinely thin letters (I, L's cousin l), which would be blown up into noise.
  const thin = Math.min(w, h) / size < 0.35
  const sx = thin ? size : w
  const sy = thin ? size : h
  const scaled = points.map((p) => [(p[0] - minX) / sx, (p[1] - minY) / sy] as Point)
  const cx = scaled.reduce((s, p) => s + p[0], 0) / N
  const cy = scaled.reduce((s, p) => s + p[1], 0) / N
  return scaled.map((p) => [p[0] - cx, p[1] - cy] as Point)
}

function cloudDistance(a: Point[], b: Point[], start: number): number {
  const matched = new Array<boolean>(N).fill(false)
  let sum = 0
  let i = start
  do {
    let best = -1
    let min = Infinity
    for (let j = 0; j < N; j++) {
      if (matched[j]) continue
      const d = dist(a[i], b[j])
      if (d < min) {
        min = d
        best = j
      }
    }
    matched[best] = true
    sum += (1 - ((i - start + N) % N) / N) * min
    i = (i + 1) % N
  } while (i !== start)
  return sum
}

function greedyMatch(a: Point[], b: Point[]): number {
  let min = Infinity
  for (let i = 0; i < N; i += 4) {
    min = Math.min(min, cloudDistance(a, b, i), cloudDistance(b, a, i))
  }
  return min
}

const CLOUDS = TEMPLATES.map(([letter, strokes]) => ({ letter, cloud: normalize(strokes) }))

export interface LetterGuess {
  letter: string
  /** Lower is closer. */
  distance: number
}

/**
 * Ranks letters by closeness to the drawn strokes.
 * @param allowed restrict the answer to these letters (e.g. a puzzle gap's candidates).
 */
export function recognize(strokes: Stroke[], allowed?: readonly string[]): LetterGuess[] {
  if (strokes.every((s) => s.length === 0)) return []
  const cloud = normalize(strokes)
  const best = new Map<string, number>()
  for (const t of CLOUDS) {
    if (allowed && !allowed.includes(t.letter)) continue
    const d = greedyMatch(cloud, t.cloud)
    if (d < (best.get(t.letter) ?? Infinity)) best.set(t.letter, d)
  }
  return [...best.entries()].map(([letter, distance]) => ({ letter, distance })).sort((a, b) => a.distance - b.distance)
}

/** Template strokes, exposed for tests and for drawing example letters. */
export function templatesFor(letter: string): Stroke[][] {
  return TEMPLATES.filter(([l]) => l === letter).map(([, s]) => s)
}
