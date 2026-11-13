import { FIREBASE } from './familySync.ts'

/**
 * "Report a problem": a grown-up's few words plus where they were in the app,
 * posted to the shared `reports` collection used by Number Garden and Sudoku.
 * No name and no family code is sent (reports are readable by anyone with the key).
 * Reports queue on the device and send when online.
 */
export interface Report {
  text: string
  context: string
  when: string
  device: string
  sent: boolean
}

const KEY = 'spelling-bee-reports'
export const APP_VERSION = 'bee-0.1'
let context = 'home'

/** Screens call this so a report says what was on screen last. */
export function setReportContext(text: string) {
  context = text
}

export function loadReports(): Report[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as Report[]
  } catch {
    return []
  }
}
function saveReports(reports: Report[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(reports.slice(-20)))
  } catch {
    // ignore
  }
}

function deviceLine(): string {
  if (typeof navigator === 'undefined') return ''
  const kind = /iPad|iPhone/.test(navigator.userAgent) ? 'iOS' : /Android/.test(navigator.userAgent) ? 'Android' : 'other'
  return `${window.innerWidth}x${window.innerHeight} ${kind}`
}

export function fileReport(text: string): Report[] {
  const report: Report = {
    text: text.trim().slice(0, 380),
    context: context.slice(0, 380),
    when: new Date().toISOString(),
    device: deviceLine(),
    sent: false,
  }
  const all = [...loadReports(), report]
  saveReports(all)
  return all
}

const str = (v: string) => ({ stringValue: v })

/**
 * The two apps document two different shapes for the `reports` rule, and only the
 * Firebase console knows which is published, so try Number Garden's and then Sudoku's.
 */
export function reportBodies(r: Report): unknown[] {
  return [
    {
      fields: {
        kind: str('spelling-bee'),
        label: str('Spelling Bee report'),
        game: str('spelling-bee'),
        level: { integerValue: '0' },
        prompt: str(r.text),
        stage: str(r.context),
        controls: str(''),
        when: str(r.when),
        ver: str(APP_VERSION),
        family: str(''),
        device: str(r.device),
        lang: str(typeof navigator === 'undefined' ? '' : (navigator.language ?? '')),
      },
    },
    {
      fields: {
        at: str(r.when),
        build: str(`spelling-bee ${APP_VERSION}`),
        text: str(r.text),
        context: str(`${r.context} | ${r.device}`),
        errors: str(''),
      },
    },
  ]
}

let sending = false
export async function sendReports(f: typeof fetch = fetch): Promise<Report[]> {
  const all = loadReports()
  if (sending || !all.some((r) => !r.sent)) return all
  sending = true
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE.projectId}/databases/(default)/documents/reports?key=${FIREBASE.apiKey}`
  for (const r of all.filter((x) => !x.sent)) {
    try {
      for (const body of reportBodies(r)) {
        const res = await f(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        if (res.ok) {
          r.sent = true
          break
        }
        if (res.status !== 400 && res.status !== 403) break
      }
    } catch {
      break // offline: keep it queued
    }
  }
  saveReports(all)
  sending = false
  return all
}
