import { FIREBASE, isFamilyCode } from './familySync.ts'

/**
 * Anonymous usage counts, the same scheme as Number Garden and Sudoku: one
 * Firestore document per day under beeUsage/{YYYY-MM-DD} holding only numbers
 * (devices, opens, starts, wins) and hashed family codes. Nothing identifying is
 * sent. Counts queue in their own storage key and flush in one batched write.
 */
export type UsageField = 'devices' | 'opens' | 'starts' | 'wins'
type Day = Partial<Record<UsageField, number>> & { familiesSet?: Record<string, 1> }
interface UsageState {
  day: string | null
  queue: Record<string, Day>
}

const KEY = 'spelling-bee-usage'
const FAMILY_KEY = 'spelling-bee-family'
const COLLECTION = 'beeUsage'

export const localDay = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export function hashCode(str: string): string {
  let x = 2166136261
  for (let i = 0; i < str.length; i++) {
    x ^= str.charCodeAt(i)
    x = Math.imul(x, 16777619) >>> 0
  }
  return x.toString(36)
}

function load(): UsageState {
  try {
    return { day: null, queue: {}, ...(JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<UsageState>) }
  } catch {
    return { day: null, queue: {} }
  }
}
function save(u: UsageState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(u))
  } catch {
    // ignore
  }
}

let timer: ReturnType<typeof setTimeout> | undefined
let busy = false

export function usageCount(field: UsageField, n = 1) {
  const u = load()
  const day = localDay()
  const d = (u.queue[day] ??= {})
  d[field] = (d[field] ?? 0) + n
  let family = ''
  try {
    family = localStorage.getItem(FAMILY_KEY) ?? ''
  } catch {
    // ignore
  }
  if (isFamilyCode(family)) (d.familiesSet ??= {})[hashCode(family)] = 1
  save(u)
  clearTimeout(timer)
  timer = setTimeout(() => void usageFlush(), 2500)
}

/** Once per open; counts the device once a day. */
export function usageOpen() {
  const u = load()
  const day = localDay()
  if (u.day !== day) {
    u.day = day
    save(u)
    usageCount('devices')
  }
  usageCount('opens')
}

/** The Firestore commit body for the queued counts (exported for tests). */
export function buildWrites(queue: Record<string, Day>): unknown[] {
  const doc = (day: string) => `projects/${FIREBASE.projectId}/databases/(default)/documents/${COLLECTION}/${day}`
  const writes: unknown[] = []
  for (const [day, d] of Object.entries(queue)) {
    const transforms: unknown[] = []
    for (const [k, v] of Object.entries(d)) {
      if (k === 'familiesSet') {
        const codes = Object.keys(d.familiesSet ?? {})
        if (codes.length) {
          transforms.push({ fieldPath: 'families', appendMissingElements: { values: codes.map((c) => ({ stringValue: c })) } })
        }
      } else if ((v as number) > 0) {
        transforms.push({ fieldPath: k, increment: { integerValue: String(v) } })
      }
    }
    if (!transforms.length) continue
    writes.push({ update: { name: doc(day), fields: { day: { stringValue: day } } }, updateMask: { fieldPaths: ['day'] } })
    writes.push({ transform: { document: doc(day), fieldTransforms: transforms } })
  }
  return writes
}

export async function usageFlush(f: typeof fetch = fetch): Promise<void> {
  if (busy || typeof location === 'undefined' || !/^https?:$/.test(location.protocol)) return
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return
  const u = load()
  const sent = JSON.parse(JSON.stringify(u.queue)) as Record<string, Day>
  const writes = buildWrites(sent)
  if (!writes.length) return
  busy = true
  try {
    const r = await f(
      `https://firestore.googleapis.com/v1/projects/${FIREBASE.projectId}/databases/(default)/documents:commit?key=${FIREBASE.apiKey}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ writes }), keepalive: true },
    )
    const now = load()
    if (r.ok) {
      // Subtract what was sent; anything counted meanwhile stays queued.
      for (const [day, d] of Object.entries(sent)) {
        const cur = now.queue[day]
        if (!cur) continue
        for (const [k, v] of Object.entries(d)) {
          if (k === 'familiesSet') for (const c of Object.keys(d.familiesSet ?? {})) delete cur.familiesSet?.[c]
          else cur[k as UsageField] = Math.max(0, (cur[k as UsageField] ?? 0) - (v as number))
        }
        const empty = Object.entries(cur).every(([k, v]) => (k === 'familiesSet' ? !Object.keys(cur.familiesSet ?? {}).length : !v))
        if (empty) delete now.queue[day]
      }
      save(now)
    } else if (r.status === 403 || r.status === 400) {
      // The rule is not published yet (or refuses): keep only the last week so the queue cannot grow forever.
      for (const day of Object.keys(now.queue).sort().slice(0, -7)) delete now.queue[day]
      save(now)
    }
  } catch {
    // offline: try again next time
  }
  busy = false
}
