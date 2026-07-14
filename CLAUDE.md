# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Leraar is a personal Dutch-learning tool (A2 → B2 in ~6 months) for one
learner: native English/Shona speaker from Zimbabwe, quick learner, short
attention span (30-45 min), forgets without repetition, learning for
work/life fluency plus business Dutch (ZiQo Applied, food science). The
accepted plan is in `PROPOSAL.md`; read it before adding features or
content. You are not just the developer here — in tutor skills you are the
learner's Dutch teacher.

## Architecture

Static PWA, vanilla HTML/CSS/JS, **no build step, no frameworks, no
dependencies**. Keep it that way.

- `js/fsrs.js` — FSRS-4.5 scheduler + learning steps. Pure functions.
- `js/storage.js` — one localStorage key (`leraar.v1`), export/import sync.
- `js/app.js` — session composer, review/lesson/shadow UI, tabs.
- `data/decks/*.json` — `{id, name, mode: vocab|cloze, priority, cards}`
  with cards as `[nl, en, example?]` tuples. **Card ids are positional
  (`deckId:index`): only ever APPEND to a deck's cards array. Never
  reorder, insert, or delete entries** or learner progress corrupts.
- `data/lessons/week*.json` — micro-lessons; `body` is markdown-lite
  (### headers, - lists, **bold**, `inline-dutch`, |table|rows|) rendered
  by `mdLite()` in app.js. Register new files in the matching `index.json`.
- `sw.js` — offline cache. **Bump `VERSION` in every deploy that changes
  code or data**, and add new files to `SHELL`.

## Deploy and verify

- Hosting: GitHub Pages serves `main` at https://gudzuh.github.io/Leraar/.
  Pushing to main IS deploying. Commit freely; push only when the user
  says so (a push goes live on their phone).
- Preview: launch config "leraar" (`.claude/serve.ps1`, port 4991).
- After changes verify: all pages/data HTTP 200 → JSON parses (the app
  shows a load-error panel if not) → snapshot renders → a card flip and
  rating works → lesson renders (check a table) → console clean.

## Content rules (teaching quality is a feature)

- Dutch must be correct, including de/het. When unsure of an article or
  idiom, verify before committing.
- Nouns on cards always carry their article ("het huis", never "huis").
- Lesson tone: warm, concrete, second person, short paragraphs, no fluff.
  Explanations in English, examples in Dutch. Leverage the learner's
  languages (English cognates, Shona noun-class analogy for de/het).
- New vocab enters via decks (append-only); learner mistakes go to the
  `mistakes` deck (priority 0), created by tutor skills.

## Tutor skills

`.claude/skills/`: `toets` (placement + biweekly test, writes
`progress/toets-*.md`), `les` (live lesson), `gesprek` (conversation
roleplay), `schrijf` (writing correction). All feed real errors into the
`mistakes` deck (append-only) and bump the sw.js VERSION on commit.

## Sync

`js/sync.js` syncs progress phone<->laptop through a private GitHub Gist.
The user pastes a fine-grained token (gist scope only) in Meer on each
device; sync runs on app load and after each session. The token lives in
localStorage and is sent only to api.github.com. Settings do not sync
(voice names differ per device).

## Curriculum status

All 26 weeks (130 lessons) and all 8 decks are complete and live as of
2026-07-14. Decks: cognates, a2-core, phrases, grammar-w1-4 (cloze) and
mistakes from M1; b1-core (292), ziqo-pro (379), b2-bridge (219) added in
M3. Total ~1,766 cards. New vocab is introduced by priority tier: mistakes
(0) first, then cognates/a2-core/phrases/grammar (1-4), then b1-core +
ziqo-pro round-robin (5), then b2-bridge (6). Decks are deduped against
each other on headword (only "licht" intentionally repeats across two
studied M1 decks, which must not be reindexed).

Gotcha fixed 2026-07-14: `d.priority ?? 9`, never `|| 9` — the mistakes
deck is priority 0, and `0 || 9` wrongly sorted it last.

## Machine quirks

- `python` is a Microsoft Store stub; portable Node v24 at `~/.local/node`
  (not on PATH). Neither is needed for this repo.
- No `gh` CLI. GitHub API: get the stored token via `git credential fill`
  (pipe `protocol=https\nhost=github.com\n\n` from Git Bash; PowerShell
  line endings break it), then `curl`. Never print the token.
- PowerShell is 5.1; prefer Git Bash for pipes/quoting. PNG icons were
  generated with System.Drawing (see git history) if you need new ones.
