# Leraar: proposal for your Dutch learning tool

Prepared 2026-07-08. Status: awaiting your acceptance.

## What I recommend building

One system with three parts, all living in this repo:

1. **A mobile-friendly web app** (installable on your phone, no app store)
   for daily practice: spaced-repetition flashcards, grammar micro-lessons,
   listening and speaking drills, sized to whatever time you have that day.
2. **Claude tutor sessions** on the laptop: you open the Leraar repo and run
   `/les` (today's lesson, taught live), `/gesprek` (roleplay conversation
   with corrections), `/schrijf` (writing correction), `/toets` (progress
   test every two weeks that re-plans the curriculum).
3. **Weekly real-world missions**: small concrete speaking tasks to do with
   the Dutch speakers around you ("order your Friday borrel round in Dutch
   only", "open Monday's stand-up with two sentences in Dutch").

A single app beats a PDF (static, no repetition engine) and beats relying
on Duolingo-style apps (generic, no ZiQo vocabulary, no B2 depth). The web
app handles the daily grind; I handle the parts that need a teacher.

## How it is built around your brain

- **You forget fast, repetition fixes it.** The core is a spaced-repetition
  scheduler (FSRS, the modern Anki algorithm): every word, phrase and
  grammar pattern comes back exactly when you are about to forget it.
  Everything is retrieval practice (you produce the answer), never
  re-reading, because testing is what moves things to long-term memory.
- **Your time varies wildly.** The app opens with one question: "How long
  do you have?" (10 / 20 / 30 / 45 min) and composes a session to fit.
  Reviews always come first because skipping them is what kills SRS.
- **You are lazy (your word).** The design weapon against laziness is
  friction removal plus streaks: one tap from home screen to first card,
  a 5-minute minimum day that still counts, a visible chain you will not
  want to break. On a bad day you do 5 minutes; the system survives.
- **30-45 min ceiling.** No session block runs longer than 8-10 minutes
  before the activity type switches (cards, then a micro-lesson, then
  listening, then speaking). Interleaving fights fatigue and measurably
  improves retention.
- **English is a superpower here.** Dutch is English's closest major
  language. Weeks 1-4 front-load the ~1,500 cognates you basically already
  know (water, glas, lamp, drinken, beginnen), which builds speed and
  confidence before the hard grammar arrives.
- **Shona helps more than you think.** Dutch de/het gender feels arbitrary
  to English speakers, but you already speak a language where every noun
  belongs to a class that controls agreement (mu-/va-, chi-/zvi-). I will
  teach de/het as a two-class noun system, learned per-noun like mupanda.
  Your rolled Shona r is also a perfectly good Dutch r.
- **Known trouble spots for you specifically:** the g/ch sound (exists in
  neither English nor Shona), the ui/eu/oe vowels, and V2 word order with
  the verb-final subclause. These get dedicated drills from week 1, little
  and often, because they take months of exposure to automate.

## Curriculum: 26 weeks, four phases

| Phase | Weeks | Focus |
|-------|-------|-------|
| 1. Fundament | 1-6 | A2 consolidation, cognate blitz, perfectum/imperfectum, V2 word order, daily-life Dutch (gemeente, huisarts, markt) |
| 2. Opbouw | 7-14 | B1 grammar (subclauses, 'er', passive), work Dutch begins: email templates, meeting phrases, small talk with colleagues |
| 3. Verdieping | 15-20 | B1+ to B2: complex sentences, expressing opinion and nuance, disagreement, ZiQo track: food-science and lab vocabulary, client conversations |
| 4. Meesterschap | 21-26 | B2 consolidation: idiom, register (u/je judgement), presentations, negotiation, telling stories and jokes in Dutch |

- **Vocabulary target:** ~3,500 words from Dutch frequency lists plus a
  dedicated ZiQo professional deck (~400 terms: levensmiddelen, lab,
  kwaliteit, contracten) that I build with you.
- **Input diet:** curated per level from free online material: Zeg het in
  het Nederlands and Een Beetje Nederlands podcasts, NOS Jeugdjournaal,
  oefenen.nl, dutchgrammar.com, the Groningen "Introduction to Dutch"
  course. The app schedules them; original lesson content is written by me.
- Every mistake you make in `/gesprek` and `/schrijf` becomes a new
  flashcard automatically. Your error log becomes your curriculum.

## The honest timeline

A2 to B2 is roughly 300-400 focused hours for an English speaker. In 26
weeks that means ~90 minutes a day of contact with Dutch. You will not do
90 focused minutes daily, and the plan does not pretend you will. Instead:
30-45 active minutes on most days, plus cheap passive exposure that the
missions and input diet make automatic (Dutch radio while cooking,
Jeugdjournaal with coffee). Realistic forecast: **solid B1 by month 3-4,
B2 threshold by month 6 if the streak holds, month 8 if life happens.**
The `/toets` results re-forecast this every two weeks, so the dashboard
always shows the true trajectory, not the flattering one.

## Technical shape

- Static PWA, vanilla HTML/CSS/JS, no build step, no framework, no
  dependencies. Decks and lessons are JSON/markdown in the repo.
- Progress in localStorage, synced between phone and laptop through a
  private GitHub Gist (one fine-grained token, set up once per device).
  Works offline; syncs when online.
- Dutch audio via the browser's built-in Dutch text-to-speech voices;
  self-recording drills via the microphone for compare-with-model.
- Hosting: GitHub Pages. On the free plan this requires the repo to be
  public. Nothing personal lives in the repo (progress stays on your
  devices and in the private gist), so I recommend making Leraar public.

## Build milestones

1. **Week 1 usable** (first build after you accept): app skeleton, FSRS
   engine, session composer, weeks 1-4 of lessons, ~750-card starter deck
   (cognate blitz + A2 core), deployed to your phone and laptop.
2. **Full loop**: tutor skills (`/les`, `/gesprek`, `/schrijf`, `/toets`),
   mistake-to-flashcard pipeline, speaking drills, missions, gist sync.
3. **Full course**: all 26 weeks of content, ZiQo professional deck,
   dashboard with forecast, input-diet scheduler.

## What I need from you

1. Accept this proposal, or tell me what to change.
2. May Leraar become a public repo? (Free hosting; alternative is
   Cloudflare Pages, which keeps it private but adds an account.)
3. Is A2 self-assessed or from a course/test? Either way our first session
   is a placement `/toets` so week 1 starts at your real level.
