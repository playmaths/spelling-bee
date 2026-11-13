# Spelling Bee

A spelling game for a young reader: fill-the-gap word puzzles, picture word cards, and a Scripps-style bee stage with a Judge who answers questions before she spells.

Play it at **https://playmaths.github.io/spelling-bee/**. On a phone or tablet use *Add to Home Screen*: the web manifest and service worker make it an installed app with its own icon that works offline.

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

## Firestore rule for usage counts

The family code and problem reports use rules the other two apps already have. The anonymous daily counts need one more, added inside `match /databases/{database}/documents { … }` and published:

```
match /beeUsage/{day} {
  allow read: if true;
  allow create, update: if day.matches('^20[0-9]{2}-[0-9]{2}-[0-9]{2}$')
    && request.resource.data.keys().hasOnly(['day', 'devices', 'opens', 'starts', 'wins', 'families'])
    && (!('families' in request.resource.data) || request.resource.data.families.size() <= 2000);
  allow delete: if false;
}
```

Until it is published the counts simply wait on the device (the last week is kept).

