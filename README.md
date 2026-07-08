# Leraar

Persoonlijke Nederlands-leraar: van A2 naar B2 in ongeveer zes maanden.

A personal Dutch-learning tool: a no-build PWA with FSRS spaced repetition,
a session composer that fits whatever time you have (10-45 min), grammar
micro-lessons, speaking drills, and Claude-run tutor sessions.

- **App:** https://gudzuh.github.io/Leraar/
- **Plan:** see [PROPOSAL.md](PROPOSAL.md)
- **How it works / working on it:** see [CLAUDE.md](CLAUDE.md)

## Structure

```
index.html, css/, js/     the app (vanilla JS, no dependencies)
data/decks/*.json         flashcard decks (append-only card arrays)
data/lessons/week*.json   grammar micro-lessons per curriculum week
.claude/skills/           Claude tutor sessions (/toets, more to come)
sw.js                     offline cache; bump VERSION on every deploy
```

## Local preview

`powershell -NoProfile -ExecutionPolicy Bypass -File .claude/serve.ps1` then
open http://localhost:4991/ (or use the "leraar" preview config in Claude Code).
