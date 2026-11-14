import { useEffect, useRef, useState } from 'react'
import { BeeStage } from './components/BeeStage.tsx'
import { Compete } from './components/Compete.tsx'
import { MeaningQuiz } from './components/MeaningQuiz.tsx'
import { Play } from './components/Play.tsx'
import { IconButton } from './components/IconButton.tsx'
import { WordCardFace, WordCards } from './components/WordCards.tsx'
import { getCard } from './data/index.ts'
import { dailyWord } from './lib/daily.ts'
import { WordMap } from './components/WordMap.tsx'
import { isFamilyCode, newFamilyCode, normalizeCode, syncOnce } from './lib/familySync.ts'
import { withAttempt, type NewAttempt } from './lib/attempts.ts'
import { afterRound, calibrationFor } from './lib/awards.ts'
import { ParentInsights } from './components/ParentInsights.tsx'
import { fileReport, loadReports, sendReports, setReportContext, type Report } from './lib/report.ts'
import { clipKeys, loadClipList, voiceStatus } from './lib/clips.ts'
import { fetchUsage, usageCount, usageOpen, type UsageRow } from './lib/usage.ts'
import { getVoiceName, listVoices, setMuted, setVoiceName, speak } from './lib/speak.ts'
import { pickSession, type Progress } from './lib/unlocks.ts'
import type { BeeWord } from './types/game.ts'

/** Prototype shell. One thing per screen; grown-up controls live behind the gear. */

const STORAGE_KEY = 'spelling-bee-prototype'
const FAMILY_KEY = 'spelling-bee-family'
type View = 'HOME' | 'PLAY' | 'MAP' | 'CARDS' | 'DAILY' | 'MEANINGS' | 'STAGE' | 'GROWNUPS' | 'BENCH' | 'INSIGHTS'

function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as Progress
  } catch {
    // Storage can be unavailable (private mode); the prototype still works without it.
  }
  return { solved: {} }
}

function VoicePicker() {
  const [voices, setVoices] = useState(listVoices)
  const [name, setName] = useState(getVoiceName)

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    const refresh = () => setVoices(listVoices())
    window.speechSynthesis.addEventListener?.('voiceschanged', refresh)
    refresh()
    return () => window.speechSynthesis.removeEventListener?.('voiceschanged', refresh)
  }, [])

  if (voices.length === 0) return <span>No voices on this device</span>
  return (
    <label className="flex items-center gap-2">
      Voice
      <select
        value={name ?? voices[0].name}
        onChange={(e) => {
          setVoiceName(e.target.value)
          setName(e.target.value)
          speak('Your word is mysterious.')
        }}
        className="max-w-56 rounded-lg border border-slate-300 bg-white px-2 py-1"
      >
        {voices.map((v) => (
          <option key={v.name} value={v.name}>
            {v.name} ({v.lang})
          </option>
        ))}
      </select>
    </label>
  )
}

function VoiceCheck() {
  const [, refresh] = useState(0)
  const [result, setResult] = useState('')
  const test = () => {
    setResult('Listening for the result…')
    const run = () => {
      speak('practice', false, clipKeys.word('practice'))
      window.setTimeout(() => {
        setResult(
          voiceStatus.lastUsed === 'RECORDED'
            ? 'Played the recorded voice.'
            : `Used the device voice${voiceStatus.lastError ? `, because ${voiceStatus.lastError}` : voiceStatus.recordings === null ? ', because the list of recordings is not loaded' : ', because that recording is not in the list'}.`,
        )
        refresh((n) => n + 1)
      }, 2500)
    }
    if (voiceStatus.recordings === null) void loadClipList().then(run)
    else run()
  }
  return (
    <section className="flex flex-col gap-2 rounded-2xl bg-white p-4 shadow-sm">
      <h3 className="font-bold">Voice check</h3>
      <p data-testid="voice-status" className="text-base text-slate-600">
        {voiceStatus.recordings !== null
          ? `${voiceStatus.recordings} recordings available.`
          : voiceStatus.listError
            ? `Recordings not loaded (${voiceStatus.listError}).`
            : 'Recordings not loaded yet.'}{' '}
        {voiceStatus.unlocked ? 'Sound is switched on for this page.' : 'Sound has not been started on this page yet.'}
      </p>
      <button type="button" onClick={test} className="self-start rounded-full bg-slate-800 px-5 py-2 font-bold text-white">
        Test the voice
      </button>
      {result && (
        <p data-testid="voice-result" className="text-base text-slate-700">
          {result}
        </p>
      )}
      <p className="text-sm text-slate-500">
        If a phone uses the device voice, check it is not on silent, then tell us what this line says.
      </p>
    </section>
  )
}

function UsageTable() {
  const [rows, setRows] = useState<UsageRow[] | null>(null)
  const [note, setNote] = useState('Loading…')
  useEffect(() => {
    if (!/^https?:$/.test(location.protocol)) return setNote('Counts show when the app is opened from its web address.')
    fetchUsage()
      .then((r) => {
        setRows(r)
        setNote(r.length ? '' : 'No counts yet.')
      })
      .catch(() => setNote('Could not load the counts just now.'))
  }, [])
  const cell = 'px-2 py-1 text-right tabular-nums'
  return (
    <section className="flex flex-col gap-2 rounded-2xl bg-white p-4 shadow-sm">
      <h3 className="font-bold">Who is playing</h3>
      <p className="text-sm text-slate-500">
        The last 30 days, all devices and families together. Numbers only; nothing that identifies anyone.
      </p>
      {note && <p className="text-base text-slate-600">{note}</p>}
      {rows && rows.length > 0 && (
        <div className="overflow-x-auto">
          <table data-testid="usage-table" className="w-full text-base">
            <thead>
              <tr className="text-sm text-slate-500">
                <th className="px-2 py-1 text-left font-semibold">Day</th>
                <th className={`${cell} font-semibold`}>Devices</th>
                <th className={`${cell} font-semibold`}>Opens</th>
                <th className={`${cell} font-semibold`}>Sessions</th>
                <th className={`${cell} font-semibold`}>Words solved</th>
                <th className={`${cell} font-semibold`}>Families</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.day} className="border-t border-slate-100">
                  <td className="px-2 py-1 whitespace-nowrap">{r.day}</td>
                  <td className={cell}>{r.devices}</td>
                  <td className={cell}>{r.opens}</td>
                  <td className={cell}>{r.starts}</td>
                  <td className={cell}>{r.wins}</td>
                  <td className={cell}>{r.families}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function App() {
  const [view, setView] = useState<View>('HOME')
  const [session, setSession] = useState<BeeWord[]>([])
  const [sessionFrom, setSessionFrom] = useState<View>('HOME')
  const [mute, setMute] = useState(false)
  const [bypassCooldownForDemo, setBypass] = useState(false)
  const [progress, setProgress] = useState<Progress>(loadProgress)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progress))
    } catch {
      // ignore
    }
  }, [progress])

  const [reports, setReports] = useState<Report[]>(loadReports)
  const [reportText, setReportText] = useState('')
  useEffect(() => {
    usageOpen()
    void sendReports().then(setReports)
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      usageOpen()
      void sendReports().then(setReports)
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])
  useEffect(() => {
    if (view !== 'GROWNUPS') setReportContext(view === 'PLAY' ? `play: ${session.map((w) => w.word).join(', ')}` : view.toLowerCase())
  }, [view, session])

  /** Every finished word, from puzzles, spell-outs and the bee stage, feeds the parent report. */
  const logAttempt = (attempt: NewAttempt) => {
    if (attempt.how !== 'STAGE') usageCount('wins')
    setProgress((p) => withAttempt(p, attempt, Date.now()))
  }
  // Family sync (same scheme as Number Garden and Sudoku): pull on open and on
  // returning to the app, push 1.5 seconds after any progress.
  const [family, setFamily] = useState(() => {
    try {
      return localStorage.getItem(FAMILY_KEY) ?? ''
    } catch {
      return ''
    }
  })
  const [familyStatus, setFamilyStatus] = useState('')
  const [typedCode, setTypedCode] = useState('')
  const latest = useRef(progress)
  latest.current = progress
  const busy = useRef(false)

  const sync = async (code: string) => {
    if (!isFamilyCode(code) || busy.current) return
    busy.current = true
    const out = await syncOnce(code, latest.current)
    busy.current = false
    if (out.adopt) setProgress(out.adopt)
    setFamilyStatus(out.status)
    return out
  }

  useEffect(() => {
    if (!family) return
    void sync(family)
    const onVisible = () => document.visibilityState === 'visible' && void sync(family)
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [family]) // eslint-disable-line

  useEffect(() => {
    if (!family || !progress.savedAt) return
    const t = window.setTimeout(() => void sync(family), 1500)
    return () => window.clearTimeout(t)
  }, [progress.savedAt, family]) // eslint-disable-line

  const chooseFamily = (code: string) => {
    try {
      if (code) localStorage.setItem(FAMILY_KEY, code)
      else localStorage.removeItem(FAMILY_KEY)
    } catch {
      // ignore
    }
    setFamily(code)
    setFamilyStatus(code ? 'Connecting…' : '')
  }

  const today = dailyWord(calibrationFor(progress).floor)
  const todayCard = getCard(today.id)
  const blooms = Object.values(progress.solved).filter((r) => r === 'CLEAN').length
  const round = 'flex h-14 w-14 items-center justify-center rounded-full bg-white text-2xl shadow active:scale-95'

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col items-center gap-5 bg-amber-50 p-4 sm:gap-8 text-slate-900 sm:p-8">
      <div className="flex w-full items-center justify-between">
        {view === 'HOME' ? (
          blooms > 0 ? (
            <button
              type="button"
              data-testid="blooms"
              onClick={() => setView('MAP')}
              aria-label={`${blooms} flowers in my garden`}
              className="rounded-full bg-white px-4 py-2 text-lg font-semibold text-slate-600 shadow-sm"
            >
              🌸 {blooms} {blooms === 1 ? 'flower' : 'flowers'}
            </button>
          ) : (
            <span />
          )
        ) : (
          <button type="button" aria-label="Home" onClick={() => setView('HOME')} className={round}>
            🏠
          </button>
        )}
        {view === 'HOME' && (
          <button
            type="button"
            aria-label="Grown-ups"
            onClick={() => setView('GROWNUPS')}
            className="h-10 w-10 rounded-full text-xl opacity-40"
          >
            ⚙️
          </button>
        )}
      </div>

      {view === 'HOME' && (
        <div className="flex flex-1 flex-col items-center justify-center gap-6 pb-4 sm:gap-8 sm:pb-16">
          <div className="text-7xl sm:text-8xl">🐝</div>
          <h1 className="sr-only">Spelling Bee</h1>
          <button
            type="button"
            onClick={() => {
              setSession(pickSession(progress, bypassCooldownForDemo, undefined, calibrationFor(progress).target))
              setProgress((p) => ({ ...p, sessions: (p.sessions ?? 0) + 1 }))
              usageCount('starts')
              setSessionFrom('HOME')
              setView('PLAY')
            }}
            className="rounded-full bg-amber-400 px-16 py-6 text-4xl font-bold shadow-xl active:scale-95"
          >
            ▶ Play
          </button>
          {todayCard && (
            <button
              type="button"
              data-testid="daily-word"
              onClick={() => setView('DAILY')}
              className="flex items-center gap-3 rounded-full bg-white px-6 py-3 shadow active:scale-95"
            >
              <span aria-hidden className="text-2xl">
                ☀️
              </span>
              <span className="flex flex-col items-start leading-tight">
                <span className="text-sm font-semibold text-slate-500">Today's word</span>
                <span className="text-2xl font-bold text-slate-800">{today.word}</span>
              </span>
            </button>
          )}
          <div className="grid grid-cols-2 justify-items-center gap-x-10 gap-y-6 sm:flex sm:gap-8">
            <IconButton icon="🌷" label="My garden" size="lg" onClick={() => setView('MAP')} />
            <IconButton icon="🃏" label="Cards" size="lg" onClick={() => setView('CARDS')} />
            <IconButton
              icon="💡"
              label="Which word?"
              size="lg"
              onClick={() => {
                usageCount('starts')
                setView('MEANINGS')
              }}
            />
            <IconButton icon="🎤" label="Bee stage" size="lg" onClick={() => setView('STAGE')} />
          </div>
        </div>
      )}

      {view === 'PLAY' && (
        <Play
          key={session.map((w) => w.id).join()}
          words={session}
          onAttempt={logAttempt}
          solved={progress.solved}
          onHome={() => setView(sessionFrom === 'DAILY' ? 'HOME' : sessionFrom)}
          doneLabel={sessionFrom === 'HOME' ? 'All done for today!' : 'Well done!'}
          spellOut={sessionFrom === 'DAILY'}
        />
      )}
      {view === 'MAP' && (
        <WordMap
          progress={progress}
          onPlay={(words) => {
            setSession(words)
            setSessionFrom('MAP')
            setView('PLAY')
          }}
        />
      )}
      {view === 'CARDS' && <WordCards unlockAll={bypassCooldownForDemo} collected={Object.keys(progress.solved)} />}
      {view === 'DAILY' && todayCard && (
        <div className="flex w-full flex-col items-center gap-5">
          <p className="text-lg font-semibold text-slate-600">☀️ Today's word</p>
          <WordCardFace word={today} card={todayCard} />
          <IconButton
            icon="✏️"
            label="Try spelling it"
            size="lg"
            onClick={() => {
              setSession([today])
              usageCount('starts')
              setSessionFrom('DAILY')
              setView('PLAY')
            }}
          />
        </div>
      )}
      {view === 'MEANINGS' && (
        <MeaningQuiz
          solved={progress.solved}
          unlockAll={bypassCooldownForDemo}
          target={calibrationFor(progress).target}
          onHome={() => setView('HOME')}
        />
      )}
      {view === 'STAGE' && (
        <Compete
          progress={progress}
          unlockAll={bypassCooldownForDemo}
          target={calibrationFor(progress).target}
          onAttempt={logAttempt}
          onAsked={(ids, startedOver) => {
            usageCount('starts')
            setProgress((p) => ({
              ...p,
              savedAt: Date.now(),
              stageSeen: startedOver ? ids : [...(p.stageSeen ?? []), ...ids],
            }))
          }}
          onRoundEnd={(right, total) => {
            const after = afterRound(latest.current, right, total)
            setProgress((p) => ({ ...afterRound(p, right, total).progress, savedAt: Date.now() }))
            return { ribbon: after.ribbon, wonLevel: after.wonLevel }
          }}
        />
      )}
      {view === 'BENCH' && <BeeStage />}
      {view === 'INSIGHTS' && <ParentInsights progress={progress} onBack={() => setView('GROWNUPS')} />}

      {view === 'GROWNUPS' && (
        <div className="flex flex-col gap-5 text-lg text-slate-700">
          <h2 className="text-2xl font-bold">Grown-ups</h2>
          <button
            type="button"
            onClick={() => setView('INSIGHTS')}
            className="self-start rounded-full bg-amber-400 px-6 py-3 text-xl font-bold shadow"
          >
            📊 How she is doing
          </button>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={mute}
              onChange={(e) => {
                setMute(e.target.checked)
                setMuted(e.target.checked)
              }}
            />
            Mute the Judge
          </label>
          <VoicePicker />
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={bypassCooldownForDemo} onChange={(e) => setBypass(e.target.checked)} />
            Unlock mystery words (demo)
          </label>
          <section className="flex flex-col gap-2 rounded-2xl bg-white p-4 shadow-sm">
            <h3 className="font-bold">Family code</h3>
            {family ? (
              <>
                <p>
                  <span data-testid="family-code" className="font-mono text-xl font-bold tracking-widest">
                    {family}
                  </span>
                </p>
                <p data-testid="family-status" className="text-base text-slate-600">
                  {familyStatus || 'Connecting…'}
                </p>
                <p className="text-sm text-slate-500">Type this code on her other devices to keep one garden everywhere.</p>
                <button type="button" onClick={() => chooseFamily('')} className="self-start text-base underline">
                  Stop syncing on this device
                </button>
              </>
            ) : (
              <>
                <p className="text-base text-slate-600">
                  Keeps her progress the same on every device. Make a code on the first device, then type it on the
                  others. Do not reuse a Number Garden or Sudoku code.
                </p>
                <button
                  type="button"
                  onClick={() => chooseFamily(newFamilyCode())}
                  className="self-start rounded-full bg-amber-400 px-5 py-2 font-bold"
                >
                  New family
                </button>
                <form
                  className="flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault()
                    const code = normalizeCode(typedCode)
                    if (!isFamilyCode(code)) return setFamilyStatus('A family code looks like K7PM-3QX2.')
                    setTypedCode('')
                    chooseFamily(code)
                  }}
                >
                  <input
                    id="family-code-input"
                    value={typedCode}
                    onChange={(e) => setTypedCode(e.target.value)}
                    placeholder="K7PM-3QX2"
                    aria-label="Family code"
                    autoCapitalize="characters"
                    autoComplete="off"
                    className="w-40 rounded-lg border border-slate-300 px-3 py-2 font-mono uppercase"
                  />
                  <button type="submit" className="rounded-full bg-slate-800 px-5 py-2 font-bold text-white">
                    Join
                  </button>
                </form>
                {familyStatus && <p className="text-base text-rose-700">{familyStatus}</p>}
              </>
            )}
          </section>
          <VoiceCheck />
          <UsageTable />
          <section className="flex flex-col gap-2 rounded-2xl bg-white p-4 shadow-sm">
            <h3 className="font-bold">Report a problem</h3>
            <form
              className="flex flex-col gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                if (!reportText.trim()) return
                setReports(fileReport(reportText))
                setReportText('')
                void sendReports().then(setReports)
              }}
            >
              <textarea
                id="report-text"
                value={reportText}
                onChange={(e) => setReportText(e.target.value)}
                placeholder="What went wrong? A few words are enough."
                aria-label="What went wrong"
                rows={3}
                maxLength={380}
                className="rounded-lg border border-slate-300 p-2 text-base"
              />
              <button type="submit" className="self-start rounded-full bg-slate-800 px-5 py-2 font-bold text-white">
                Send report
              </button>
            </form>
            <p className="text-sm text-slate-500">
              Sends your words, the screen you were on and the device type. No name and no family code.
            </p>
            {reports.length > 0 && (
              <ul data-testid="reports" className="text-sm text-slate-600">
                {reports
                  .slice(-3)
                  .reverse()
                  .map((r) => (
                    <li key={r.when}>
                      {r.sent ? 'Sent' : 'Waiting to send'}: {r.text}
                    </li>
                  ))}
              </ul>
            )}
          </section>
          <button type="button" onClick={() => setView('BENCH')} className="self-start underline">
            Test bench
          </button>
          <button
            type="button"
            onClick={() => {
              // Resetting here must never wipe the family's saved garden, so leave the family first.
              chooseFamily('')
              setProgress({ solved: {} })
            }}
            className="self-start underline"
          >
            Reset progress
          </button>
        </div>
      )}
    </main>
  )
}

export default App
