import type { Progress } from './unlocks.ts'

/**
 * Family-code sync, the same scheme as Number Garden and Sudoku:
 * Firestore's plain REST API with fetch (no SDK), one document per code in
 * `families/{code}` with two fields: `data` (the saved state as a JSON string)
 * and `savedAt` (the write clock). Local first; the newer copy wins; a device
 * with no progress adopts the family's; typing a code never overwrites anything.
 *
 * The web apiKey and projectId are public identifiers (they are in the page source
 * of the other two apps); access is controlled by the Firestore rules.
 */
export const FIREBASE = { apiKey: 'AIzaSyCgG83-cqWqDuzOWrIQwqLBMF7sTwOkbWA', projectId: 'playmaths-6a181' }
const APP = 'spelling-bee'
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export const isFamilyCode = (code: string) => /^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code)

export function newFamilyCode(random: () => number = Math.random): string {
  const pick4 = () => Array.from({ length: 4 }, () => ALPHABET[Math.floor(random() * ALPHABET.length)]).join('')
  return `${pick4()}-${pick4()}`
}

/** Tidies what a grown-up types: "k7pm 3qx2" -> "K7PM-3QX2". */
export function normalizeCode(typed: string): string {
  const raw = typed.toUpperCase().replace(/[^A-Z0-9]/g, '')
  return raw.length === 8 ? `${raw.slice(0, 4)}-${raw.slice(4)}` : typed.trim().toUpperCase()
}

const url = (code: string) =>
  `https://firestore.googleapis.com/v1/projects/${FIREBASE.projectId}/databases/(default)/documents/families/${encodeURIComponent(code)}?key=${FIREBASE.apiKey}`

export const hasProgress = (p: Progress) => Object.keys(p.solved).length > 0

export type Resolution = 'ADOPT_REMOTE' | 'PUSH_LOCAL' | 'IN_SYNC'

/** Newer write clock wins; an empty device takes the family's progress if there is any. */
export function resolve(local: Progress, remote: Progress): Resolution {
  const l = local.savedAt ?? 0
  const r = remote.savedAt ?? 0
  if ((!hasProgress(local) && hasProgress(remote)) || r > l) return 'ADOPT_REMOTE'
  return l > r ? 'PUSH_LOCAL' : 'IN_SYNC'
}

export type PullResult =
  | { kind: 'EMPTY' } // no document yet for this code
  | { kind: 'OK'; progress: Progress }
  | { kind: 'OTHER_APP' } // the code belongs to Number Garden or Sudoku: never write to it
  | { kind: 'ERROR'; status: number }
  | { kind: 'OFFLINE' }

type Fetch = typeof fetch

export async function pullFamily(code: string, f: Fetch = fetch): Promise<PullResult> {
  try {
    const r = await f(url(code))
    if (r.status === 404) return { kind: 'EMPTY' }
    if (!r.ok) return { kind: 'ERROR', status: r.status }
    const doc = (await r.json()) as { fields?: { data?: { stringValue?: string } } }
    let d: { app?: string; solved?: Progress['solved']; sessions?: number; savedAt?: number }
    try {
      d = JSON.parse(doc.fields?.data?.stringValue ?? '')
    } catch {
      return { kind: 'OTHER_APP' }
    }
    // All three apps share the `families` collection. A code made by another app
    // holds that app's saved game, and writing here would destroy it.
    if (d?.app !== APP || typeof d.solved !== 'object' || d.solved === null) return { kind: 'OTHER_APP' }
    return { kind: 'OK', progress: { solved: d.solved, sessions: d.sessions, savedAt: d.savedAt } }
  } catch {
    return { kind: 'OFFLINE' }
  }
}

export type PushResult = { kind: 'SAVED' } | { kind: 'ERROR'; status: number } | { kind: 'OFFLINE' }

export async function pushFamily(code: string, progress: Progress, f: Fetch = fetch): Promise<PushResult> {
  const data = { app: APP, v: 1, solved: progress.solved, sessions: progress.sessions ?? 0, savedAt: progress.savedAt ?? 0 }
  const body = {
    fields: { data: { stringValue: JSON.stringify(data) }, savedAt: { integerValue: String(progress.savedAt ?? 0) } },
  }
  try {
    const r = await f(url(code), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return r.ok ? { kind: 'SAVED' } : { kind: 'ERROR', status: r.status }
  } catch {
    return { kind: 'OFFLINE' }
  }
}

export interface SyncOutcome {
  /** Set when the family's copy should replace this device's. */
  adopt?: Progress
  /** One line for the grown-ups screen. */
  status: string
  /** True when this code must not be used (it belongs to another app). */
  blocked?: boolean
}

/** One full sync step: pull, decide, and push if this device is ahead. */
export async function syncOnce(code: string, local: Progress, f: Fetch = fetch): Promise<SyncOutcome> {
  if (!isFamilyCode(code)) return { status: 'That does not look like a family code.', blocked: true }
  const pulled = await pullFamily(code, f)
  if (pulled.kind === 'OFFLINE') return { status: 'Offline. Saved on this device.' }
  if (pulled.kind === 'ERROR') return { status: `Could not read the family (${pulled.status}).` }
  if (pulled.kind === 'OTHER_APP') {
    return { status: 'This code belongs to a different game. Tap New family to make one for the Spelling Bee.', blocked: true }
  }
  const decision = pulled.kind === 'EMPTY' ? 'PUSH_LOCAL' : resolve(local, pulled.progress)
  if (decision === 'ADOPT_REMOTE' && pulled.kind === 'OK') return { adopt: pulled.progress, status: 'Up to date.' }
  if (decision === 'PUSH_LOCAL' && (hasProgress(local) || pulled.kind === 'EMPTY')) {
    const pushed = await pushFamily(code, local, f)
    if (pushed.kind === 'OFFLINE') return { status: 'Offline. Saved on this device.' }
    if (pushed.kind === 'ERROR') return { status: `Could not save to the family (${pushed.status}).` }
    return { status: 'Saved to the family.' }
  }
  return { status: 'Up to date.' }
}
