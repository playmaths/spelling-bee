# Spelling Bee

A spelling game for a young reader: fill-the-gap word puzzles, picture word cards, and a Scripps-style bee stage with a Judge who answers questions before she spells.

Once GitHub Pages is switched on it is served at **https://playmaths.github.io/spelling-bee/**.

- 60 word families, 562 words, pitched from grade 3 spelling upward.
- Progress is saved in the browser. A **family code** (grown-ups screen, behind the gear) keeps one garden on every device through the same Firestore project as Number Garden and Sudoku. No account, no sign-in.
- This is a prototype. `CLAUDE.md` holds the product spec and, in section 6, what is and is not built.

## Develop

```bash
npm install
npm run dev
```

```bash
npx vitest run
```

```bash
npm run build
```

## Add a word family

Copy `src/data/families/silent-mb.json`, edit it, then check it:

```bash
node scripts/check-family.mjs src/data/families/<your-file>.json
```
