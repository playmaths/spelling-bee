import { beforeEach, describe, expect, it } from 'vitest'
import { fileReport, loadReports, reportBodies, sendReports, setReportContext } from './report.ts'
import { buildWrites, fetchUsage, hashCode, usageCount, usageFlush } from './usage.ts'

beforeEach(() => localStorage.clear())

describe('usage counts', () => {
  it('sends only numbers and hashed family codes, to beeUsage/{day}', () => {
    const writes = buildWrites({ '2026-11-13': { opens: 2, wins: 5, familiesSet: { abc12: 1 } } })
    const text = JSON.stringify(writes)
    expect(text).toContain('/documents/beeUsage/2026-11-13')
    expect(text).toContain('"increment":{"integerValue":"5"}')
    expect(text).toContain('"appendMissingElements"')
    const fields = [...text.matchAll(/"fieldPath":"(\w+)"/g)].map((m) => m[1]).sort()
    expect(fields).toEqual(['families', 'opens', 'wins'])
  })

  it('never puts the family code itself in the queue', () => {
    localStorage.setItem('spelling-bee-family', 'K7PM-3QX2')
    usageCount('wins')
    const stored = localStorage.getItem('spelling-bee-usage')!
    expect(stored).not.toContain('K7PM')
    expect(stored).toContain(hashCode('K7PM-3QX2'))
  })

  it('clears the queue after a successful send and keeps it after a failure', async () => {
    usageCount('opens')
    await usageFlush((async () => new Response('{}', { status: 500 })) as typeof fetch)
    expect(localStorage.getItem('spelling-bee-usage')).toContain('opens')
    await usageFlush((async () => new Response('{}', { status: 200 })) as typeof fetch)
    expect(JSON.parse(localStorage.getItem('spelling-bee-usage')!).queue).toEqual({})
  })
})

describe('usage table', () => {
  it('reads the daily documents into rows, newest first, skipping days with none', async () => {
    const body = [
      { found: { name: 'projects/p/databases/(default)/documents/beeUsage/2026-11-13', fields: { day: { stringValue: '2026-11-13' }, devices: { integerValue: '2' }, opens: { integerValue: '5' }, wins: { integerValue: '9' }, families: { arrayValue: { values: [{ stringValue: 'a' }] } } } } },
      { found: { name: 'projects/p/databases/(default)/documents/beeUsage/2026-11-12', fields: { day: { stringValue: '2026-11-12' }, opens: { integerValue: '1' } } } },
      { missing: 'projects/p/databases/(default)/documents/beeUsage/2026-11-11' },
    ]
    const rows = await fetchUsage((async () => new Response(JSON.stringify(body), { status: 200 })) as typeof fetch)
    expect(rows).toEqual([
      { day: '2026-11-13', devices: 2, opens: 5, starts: 0, wins: 9, families: 1 },
      { day: '2026-11-12', devices: 0, opens: 1, starts: 0, wins: 0, families: 0 },
    ])
  })

  it('throws when the collection cannot be read', async () => {
    await expect(fetchUsage((async () => new Response('{}', { status: 403 })) as typeof fetch)).rejects.toThrow('HTTP 403')
  })
})

describe('report a problem', () => {
  it('queues a report with what was on screen, and no family code', () => {
    localStorage.setItem('spelling-bee-family', 'K7PM-3QX2')
    setReportContext('puzzle: rhino')
    const [r] = fileReport('The voice said the wrong word')
    expect(r).toMatchObject({ text: 'The voice said the wrong word', context: 'puzzle: rhino', sent: false })
    expect(JSON.stringify(reportBodies(r))).not.toContain('K7PM')
  })

  it('uses only fields the documented rules allow', () => {
    const [garden, sudoku] = reportBodies(fileReport('x')[0]) as { fields: Record<string, unknown> }[]
    const gardenAllowed = ['kind', 'label', 'game', 'level', 'prompt', 'stage', 'controls', 'when', 'ver', 'family', 'device', 'lang', 'html', 'shot']
    for (const k of Object.keys(garden.fields)) expect(gardenAllowed).toContain(k)
    expect(Object.keys(sudoku.fields).sort()).toEqual(['at', 'build', 'context', 'errors', 'text'])
  })

  it('falls back to the second shape when the first is refused, and stays queued offline', async () => {
    fileReport('first')
    let calls = 0
    const refuseFirst = (async () => new Response('{}', { status: ++calls === 1 ? 403 : 200 })) as typeof fetch
    expect((await sendReports(refuseFirst))[0].sent).toBe(true)
    expect(calls).toBe(2)

    fileReport('second')
    const offline = (async () => {
      throw new TypeError('offline')
    }) as typeof fetch
    await sendReports(offline)
    expect(loadReports().map((r) => r.sent)).toEqual([true, false])
  })
})
