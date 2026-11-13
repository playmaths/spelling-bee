import { describe, expect, it } from 'vitest'
import { isFamilyCode, newFamilyCode, normalizeCode, pushFamily, resolve, syncOnce } from './familySync.ts'
import type { Progress } from './unlocks.ts'

/** An in-memory stand-in for the Firestore REST endpoint. */
function fakeFirestore() {
  const docs = new Map<string, unknown>()
  let online = true
  const f = (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (!online) throw new TypeError('network down')
    const code = decodeURIComponent(String(input).match(/families\/([^?]+)/)![1])
    if (init?.method === 'PATCH') {
      docs.set(code, JSON.parse(String(init.body)))
      return new Response('{}', { status: 200 })
    }
    return docs.has(code) ? new Response(JSON.stringify(docs.get(code)), { status: 200 }) : new Response('{}', { status: 404 })
  }) as typeof fetch
  return { f, docs, setOnline: (v: boolean) => (online = v) }
}

const CODE = 'K7PM-3QX2'
const some = (savedAt: number, ...ids: string[]): Progress => ({
  solved: Object.fromEntries(ids.map((id) => [id, 'CLEAN' as const])),
  savedAt,
})

describe('family codes', () => {
  it('makes codes in the same shape as the other two apps', () => {
    for (let i = 0; i < 50; i++) expect(isFamilyCode(newFamilyCode())).toBe(true)
    expect(newFamilyCode()).toHaveLength(9)
  })

  it('tidies a typed code', () => {
    expect(normalizeCode(' k7pm 3qx2 ')).toBe(CODE)
    expect(normalizeCode('k7pm-3qx2')).toBe(CODE)
  })
})

describe('resolve', () => {
  it('lets the newer copy win', () => {
    expect(resolve(some(5, 'a'), some(9, 'b'))).toBe('ADOPT_REMOTE')
    expect(resolve(some(9, 'a'), some(5, 'b'))).toBe('PUSH_LOCAL')
    expect(resolve(some(5, 'a'), some(5, 'a'))).toBe('IN_SYNC')
  })

  it('gives an empty device the family progress, whatever the clocks say', () => {
    expect(resolve({ solved: {}, savedAt: 99 }, some(1, 'a'))).toBe('ADOPT_REMOTE')
  })
})

describe('two devices and one family', () => {
  it('moves progress both ways and never overwrites on joining', async () => {
    const cloud = fakeFirestore()
    // The iPad makes the family and plays.
    let ipad = some(100, 'word_practice')
    expect((await syncOnce(CODE, ipad, cloud.f)).status).toBe('Saved to the family.')

    // The phone joins with nothing: it adopts, and the family copy is untouched.
    let phone: Progress = { solved: {} }
    const joined = await syncOnce(CODE, phone, cloud.f)
    expect(joined.adopt).toMatchObject({ solved: { word_practice: 'CLEAN' }, savedAt: 100 })
    phone = joined.adopt!
    expect(JSON.stringify(cloud.docs.get(CODE))).toContain('word_practice')

    // The phone plays; the iPad picks it up when it comes back to the front.
    phone = some(200, 'word_practice', 'word_sentence')
    await syncOnce(CODE, phone, cloud.f)
    const back = await syncOnce(CODE, ipad, cloud.f)
    expect(Object.keys(back.adopt!.solved)).toEqual(['word_practice', 'word_sentence'])
    ipad = back.adopt!
    expect((await syncOnce(CODE, ipad, cloud.f)).status).toBe('Up to date.')
  })

  it('keeps working offline and says so', async () => {
    const cloud = fakeFirestore()
    cloud.setOnline(false)
    const out = await syncOnce(CODE, some(1, 'a'), cloud.f)
    expect(out).toEqual({ status: 'Offline. Saved on this device.' })
  })

  it('refuses a code that belongs to Number Garden or Sudoku, and writes nothing', async () => {
    const cloud = fakeFirestore()
    const garden = { fields: { data: { stringValue: JSON.stringify({ name: 'Sam', stars: 12, flowers: [1, 2] }) }, savedAt: { integerValue: '5' } } }
    cloud.docs.set(CODE, garden)
    const out = await syncOnce(CODE, some(999, 'word_practice'), cloud.f)
    expect(out.blocked).toBe(true)
    expect(cloud.docs.get(CODE)).toBe(garden)
  })

  it('writes only the two fields the Firestore rules allow', async () => {
    const cloud = fakeFirestore()
    await pushFamily(CODE, some(7, 'a'), cloud.f)
    const doc = cloud.docs.get(CODE) as { fields: Record<string, unknown> }
    expect(Object.keys(doc.fields).sort()).toEqual(['data', 'savedAt'])
    expect(doc.fields.savedAt).toEqual({ integerValue: '7' })
  })
})
