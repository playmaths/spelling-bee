# CLAUDE.md — Spelling Bee & Pattern Studio

## 1. Product Overview & Target Learner
A static, offline-capable Progressive Web App (PWA) hosted on GitHub Pages for a strong 5–8 year-old reader (reading at about a third-grade level). The app blends the stage experience of an official **Scripps-style Spelling Bee Contest** with the tactile, slot-based deduction mechanics of a **Sudoku puzzle app**, built for **iPad (Apple Pencil/Stylus + Touch + Voice)** and **Desktop (Keyboard + Voice)**.

## 2. Tech Stack & Commands
- **Stack:** React 19, TypeScript, Vite, Tailwind CSS v4 (`@tailwindcss/vite`), Vitest.
- **Hosting:** Static GitHub Pages (`base: '/spelling-bee/'` in `vite.config.ts`). Zero backend servers, zero runtime API keys.
- **Storage:** `localStorage` / `IndexedDB` for persistent player profile, word mastery, pattern transfer logs, and telemetry.
- **Commands:**
  - `npm run dev` — Start Vite dev server
  - `npm run build` — Type-check (`tsc -b`) and build production bundle
  - `npx vitest run` — Run unit test suite once (non-watch mode)

## 3. Core Product Capabilities

### Capability 1: Deterministic Conversational Judge (`src/engine/judgeStateMachine.ts`)
the learner interacts with a friendly animated Judge rather than hunting through menus. Grading is 100% deterministic while responses feel conversational.
- **Three Distinct Operations:**
  1. `INTENT_STREAM`: Parses spoken or tapped requests (`"Can you use it in a sentence?"`, `"What does it mean?"`, `"Say it slowly"`, `"Word clue"`).
  2. `DICTATION_STREAM`: Captures spoken letter sequences, Apple Pencil per-tile handwriting strokes, or custom on-screen keyboard taps into the Sudoku slot array.
  3. `EVALUATION_ENGINE`: Deterministically compares the slot array against the target word's `graphemeMap` and `traps`.
- **Template-Driven Conversational Coaching:**
  - In `ADVENTURE` mode, if the learner spells `M-I-S-T-E-R-I-O-U-S` for `mysterious`, the Judge inspects the first mismatch (`index: 1`, expected `Y`, got `I`, phoneme `/ɪ/`) and responds:
    *"Nice attempt! Let's check your spelling. The first letter of **mysterious** is **M**, but listen to the next sound. Can you figure out which vowel comes next?"*

### Capability 2: Three-Stage Transfer & Mastery Engine (`src/engine/transferEngine.ts`)
Tracks three independent mastery dimensions for every `PatternNode` (e.g., `silent-kn`, `ice-vs-ise`, `y-as-short-i`, `soft-c-before-eiy`):
1. **Word Recall (`recallScore`):** Can the learner spell a studied `ANCHOR` or `GUIDED` word (`knowledge`) across spaced intervals?
2. **Pattern Recognition (`recognitionPassed`):** Can the learner explain *why* the word is spelled that way via a post-word Detective Check (*"Why is K silent in knowledge?"*)?
3. **Unseen Transfer (`transferScore`):** Can the learner apply that rule to an unseen `TRANSFER_PROBE` word (`knight`, `knuckle`) served >= 24 hours later with zero pre-hints?
   - **Strict Quarantine Rule:** Words with `role === 'TRANSFER_PROBE'` must NEVER appear in hint cards, rule examples, or practice drills before `recognitionPassed === true` and the 24-hour cooling window has elapsed (include a `bypassCooldownForDemo` toggle to test transfer probes immediately in the UI).

### Capability 3: Distinct Learning vs. Competition Modes
Governed by `GameMode = 'ADVENTURE' | 'CONTEST'`:
- **`ADVENTURE` (Learning Adventure):**
  - Sudoku helpers enabled: Syllable dividers (`MYS • TE • RI • OUS`), Pencil candidate notes (`[ c | s ]`), Twin-Choice bubbles, and single-tile reveals.
  - Immediate mid-word coaching on traps (e.g., `practise` vs. `practice` triggers a zero-penalty "British/American Twin Alert!" with the `PRACT-ICE` 🧊 mnemonic).
  - Ends each word with a Pattern Detective recognition check and an optional zero-point Word Story.
- **`CONTEST` (Spelling Bee Contest):**
  - Official Bee protocol: the learner may freely ask the Judge for Definitions, Sentences, Slow Pronunciation, and Word Roots *before* submitting.
  - Unassisted slot board (Pencil mode acts only as her manual scratchpad; no mid-word corrections).
  - Evaluates upon final submission, followed by a post-round "Coach's Corner" review that feeds missed patterns back into Learning Adventure.

## 4. The Five Reliability Contracts (Engine Subsystems)

### Contract 1: Speech Recognition vs. True Spelling Error (`src/input/speechVerifier.ts`)
- **Problem:** Browser ASR confuses rhyming letter names (`E-set`: `B,C,D,E,G,P,T,V,Z`; `A-set`: `A,J,K`; `Nasals`: `M,N`; `Fricatives`: `F,S,X`) and transcribes words (`"bee"` -> `B`, `"see"` -> `C`, `"why"` -> `Y`, `"are"` -> `R`, `"you"` -> `U`, `"double u"` -> `W`).
- **Rule:** Inspect top-5 ASR alternatives. If `spoken[i]` mismatches `target[i]`, belongs to the same acoustic rhyme group as `target[i]`, and is NOT a phonetically plausible misspelling of the word, mark tile `i` as `ASR_SUSPECT` (never a spelling error). The Judge highlights tile `i` and asks the learner to tap or write that single letter to confirm.

### Contract 2: Pattern Weakness vs. Motor Slip (`src/engine/diagnosticClassifier.ts`)
- Align input against `graphemeMap` and classify mismatches into:
  1. `UK_US_VARIANT_TRAP` (`practise` -> `practice`, zero streak penalty).
  2. `PHONETIC_PATTERN_ERROR` (`misterious` -> `mysterious`, `night` -> `knight`, `sentense` -> `sentence`).
  3. `AFFIX_JUNCTION_ERROR` (`begining` -> `beginning`, `happyness` -> `happiness`).
  4. `SYLLABLE_OMISSION` (`diffrent` -> `different`).
  5. `MOTOR_SLIP` (adjacent transposition or isolated typo).
- **Conviction Threshold:** Only mark a `patternId` as `NEEDS_COACHING` when `PHONETIC_PATTERN_ERROR` or `AFFIX_JUNCTION_ERROR` occurs >= 2 times across distinct words within a rolling 10-opportunity window.

### Contract 3: Transfer Quarantine (`src/engine/transferEngine.ts`)
- Partition every pattern family in `src/data/patterns.json` into `anchorWordIds`, `guidedWordIds`, and `transferProbeIds`.
- Track `recallScore`, `recognitionPassed`, and `transferSuccesses` independently per pattern.

### Contract 4: ZPD Difficulty Calibration (`src/engine/zpdCalibrator.ts`)
- Target a **75%–85% First-Try Unassisted Accuracy Corridor**.
- Formula: `targetDifficulty = (0.7 * historicalEMA) + (0.3 * recent10Accuracy) + streakMomentum`.
- Baseline difficulty starts at `2.2` (the starting baseline). Step floor up (`+0.25`) only when rolling 15-word unassisted accuracy is >= 85% AND >= 2 patterns at the current tier have `status === 'TRANSFERRED'`.
- Build 10-word rounds using: 6 Sweet-Spot words, 2 Pattern/Trap siblings, 1 Spaced Review word, and 1 Confidence Booster (or unlocked Transfer Probe).

### Contract 5: Intrinsic Curiosity Telemetry (`src/engine/curiosityTracker.ts`)
- Asking the Judge for meanings, sentences, slow audio, or roots is **100% free** in both modes (never reduces points or medal tiers).
- Track non-point engagement signals: `voluntaryMeaningRate`, `voluntarySentenceRate`, `wordStoryOpenRate` (0-point fun facts), `stretchWordOptInRate`, and `thoughtfulEditsCount` (using Pencil notes or editing a tile before submitting).

## 5. Directory Architecture
- `src/types/game.ts` — Core TypeScript interfaces
- `src/data/patterns.json` — PatternNode definitions & quarantine lists
- `src/data/words.json` — Graded BeeWord bank (difficulty 1.5 - 4.5)
- `src/engine/diagnosticClassifier.ts` — Grapheme alignment, trap detection & error buckets
- `src/engine/transferEngine.ts` — Recall -> Recognition -> Transfer state machine
- `src/engine/zpdCalibrator.ts` — EMA rating, streak momentum & 10-word round builder
- `src/engine/judgeStateMachine.ts` — Deterministic conversational Judge FSM
- `src/engine/curiosityTracker.ts` — Intrinsic word-interest telemetry
- `src/engine/storage.ts` — LocalStorage persistence & reset helpers
- `src/input/speechVerifier.ts` — Homophone mapper + acoustic rhyme disambiguator
- `src/input/StylusTileCanvas.tsx` — iPad Apple Pencil per-tile HTML5 canvas + stroke recognizer
- `src/input/TouchKeyboard.tsx` — Custom QWERTY/ABC pad (prevents iPad OS popup keyboard)
- `src/components/JudgeStage.tsx` — Animated Judge avatar, dialogue bubble & audio controls
- `src/components/SudokuSlotBoard.tsx` — Interactive letter tiles, syllable dividers & Pencil mode
- `src/components/PatternDetectiveModal.tsx` — Post-word rule check & 0-point Word Story card
- `src/components/ParentInsightsDashboard.tsx` — Visual report answering the 5 Reliability Contracts
- `src/App.tsx` — Main app shell & mode switcher

## 6. Current Build Notes (prototype)
- **Word bank:** 60 families, 562 words. Play serves only words at or above difficulty 2.2 (`LEVEL_FLOOR` in `src/lib/unlocks.ts`); benchmark words: practice 2.2, knowledge 2.6, mysterious 2.8, temperature 3.3, rhythm 3.5. The first nine families are hand-written in `src/data/patterns.json`, `words.json` and `cards.json`. Every other family is one compact file in `src/data/families/<patternId>.json`, expanded at load time by `src/data/expand.ts` (ids, tile indices, blanked sentences, grapheme maps and trap wiring are derived, never typed).
- **Adding a family:** copy `src/data/families/silent-mb.json`, then run `node scripts/check-family.mjs src/data/families/<file>.json` and `npx vitest run`. Each family has 10 words: 2 anchors (`A`), 4 guided (`G`), 4 transfer probes (`P`).
- **`kind`** on a family is a hidden label for the engine and the parent report. the learner never navigates by group: Play picks her words (`src/lib/unlocks.ts`), and "My garden" only shows what she has solved.
- **Two ways to play a word** (`src/components/Play.tsx`): a fill-the-gap deduction puzzle (`src/engine/puzzleEngine.ts`, three strikes, pencil marks, Look/Explain/Fill coach), or full spell-out with the Judge for families where the number of letters is the lesson (`joining-rules`, `prefixes`).
- **Quarantine at data level:** a probe word may not appear in its own family's rule, hints, taught-word text or cards (enforced by `src/data/data.test.ts`). The 24-hour cooldown is not built yet; probes unlock once the family's taught words are solved.
- **UI rule:** one thing per screen, every icon labelled, nothing spoken until she taps. Grown-up controls are behind the gear on the home screen.
- **Not built yet:** `transferEngine.ts`, `zpdCalibrator.ts`, `curiosityTracker.ts`, `storage.ts`, and the parent dashboard. Speech input (`src/input/speechVerifier.ts`) and handwriting (`src/input/strokeRecognizer.ts`) exist but are untested on real devices.
- **Family sync (an agreed exception to "zero backend"):** `src/lib/familySync.ts` copies the scheme used by Number Garden and Sudoku: a family code (`K7PM-3QX2`), Firestore's REST API with `fetch` and no SDK, one document in `families/{code}` with fields `data` and `savedAt`, local first, the two copies are combined on sync (a word solved on either device stays solved; this differs from the other two apps, where the newer copy wins), pull on open and on return to the app, push 1.5 s after progress. All three apps share the `families` collection, so every saved state is tagged `app: "spelling-bee"` and the app refuses to write to a code that holds another app's data. Sync only works from the hosted site, not from the claude.ai artifact (its sandbox blocks outbound requests).
- **Installable and offline:** `public/manifest.webmanifest`, icons in `public/icons/`, and a service worker written at build time by the plugin in `vite.config.ts` (it lists the hashed build files). Same strategy as Number Garden and Sudoku: fetch fresh when online so updates arrive, fall back to the cache when offline. Registered in `src/main.tsx` on the hosted site only.
- **Recorded voice:** `.github/workflows/audio.yml` records every word, slow word, example sentence, meaning, secret question and card sentence with the open-source Kokoro voice model (`scripts/audio-manifest.mjs` lists the clips, `scripts/generate_audio.py` records only what changed) and keeps them in the Actions cache; the deploy workflow copies them into `audio/`. The app plays a recording when one exists (`src/lib/clips.ts`) and falls back to the device voice otherwise. Coaching lines, verdicts, clues and word stories are not recorded yet and still use the device voice. Recordings are not in the repository.
- **Usage counts and reports (`src/lib/usage.ts`, `src/lib/report.ts`):** anonymous daily counts (devices, opens, starts, wins, hashed family codes) go to `beeUsage/{YYYY-MM-DD}`, which needs its own Firestore rule (in the README). "Report a problem" on the grown-ups screen posts to the shared `reports` collection, trying Number Garden's field shape and then Sudoku's; no name and no family code is sent. Both queue on the device until they can be sent.
- **Bee stage rounds** never repeat a word until the pool near her level is used up (`pickRound` in `src/components/Compete.tsx`; asked words are kept in `progress.stageSeen`). **Spelling aloud** adds letters to the tiles burst by burst; on devices that stop listening after each burst, the session is restarted until she taps the button (or after six silent restarts). Browsers often tidy spelled letters into a word, so a burst counts as letters if the recogniser offers a letter-by-letter reading, or if it lasted long enough to have been spelled (about 300 ms a letter); a quick multi-letter burst is refused as a spoken word (`readChunk` in `src/input/speechVerifier.ts`). The grown-ups screen shows the last 30 days of usage counts (`fetchUsage`, by document name so no Firestore index is needed); counts are not sent from localhost.
