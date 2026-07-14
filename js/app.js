/* Leraar app: session composer + review UI + lessons + progress.
 * No build step, no dependencies. Everything renders into #view. */
(() => {
  const $ = s => document.querySelector(s);
  const view = () => $('#view');
  const esc = s => String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const App = {
    decks: [],            // deck objects as loaded
    cards: {},            // cardId -> {deckId, mode, nl, en, ex}
    newOrder: [],         // cardIds in introduction order
    weeks: [],            // lesson week objects
    session: null,
    tab: 'home'
  };

  /* ---------- text-to-speech ---------- */
  let nlVoices = [];
  function refreshVoices() {
    nlVoices = (speechSynthesis.getVoices() || []).filter(v => (v.lang || '').toLowerCase().startsWith('nl'));
  }
  if ('speechSynthesis' in window) {
    refreshVoices();
    speechSynthesis.onvoiceschanged = refreshVoices;
  }
  // Known male Dutch voice names across Windows/Android/iOS engines
  const MALE_NL = ['frank', 'xander', 'maarten', 'ruben', 'daan', 'willem'];
  function pickAutoVoice() {
    return nlVoices.find(v => MALE_NL.some(n => v.name.toLowerCase().includes(n)))
      || nlVoices.find(v => (v.lang || '').toLowerCase() === 'nl-nl')
      || nlVoices[0] || null;
  }
  function speak(text) {
    if (!('speechSynthesis' in window) || !text) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/___/g, '...'));
    u.lang = 'nl-NL';
    u.rate = 0.92;
    const wanted = Store.state.settings.voice;
    u.voice = nlVoices.find(v => v.name === wanted) || pickAutoVoice();
    speechSynthesis.speak(u);
  }

  /* ---------- data loading ---------- */
  async function loadData() {
    const deckFiles = await fetch('data/decks/index.json').then(r => r.json());
    App.decks = await Promise.all(deckFiles.map(f => fetch('data/decks/' + f).then(r => r.json())));
    App.decks.sort((a, b) => (a.priority ?? 9) - (b.priority ?? 9));
    for (const deck of App.decks) {
      deck.cards.forEach((c, i) => {
        const id = `${deck.id}:${i}`;
        App.cards[id] = { deckId: deck.id, mode: deck.mode || 'vocab', nl: c[0], en: c[1], ex: c[2] || '' };
        App.newOrder.push(id);
      });
    }
    const weekFiles = await fetch('data/lessons/index.json').then(r => r.json());
    App.weeks = await Promise.all(weekFiles.map(f => fetch('data/lessons/' + f).then(r => r.json())));
    App.weeks.sort((a, b) => a.week - b.week);
  }

  /* ---------- queries ---------- */
  const now = () => Date.now();
  function dueIds(t) {
    return Object.entries(Store.state.cards)
      .filter(([, r]) => r.state !== 'new' && r.due <= t)
      .sort((a, b) => a[1].due - b[1].due)
      .map(([id]) => id);
  }
  function dueTodayCount() {
    const end = new Date(); end.setHours(23, 59, 59, 999);
    return dueIds(end.getTime()).length;
  }
  function newIntroducedToday() {
    const d = Store.state.days[Store.todayKey()];
    return d ? d.newCards : 0;
  }
  // Introduce new cards tier by tier (priority), round-robin between decks
  // that share a tier, so e.g. b1-core and ziqo-pro interleave.
  function newCandidates(limit) {
    const out = [];
    const tiers = {};
    for (const d of App.decks) {
      const p = d.priority ?? 9;
      (tiers[p] = tiers[p] || []).push(d);
    }
    for (const p of Object.keys(tiers).map(Number).sort((a, b) => a - b)) {
      const pointers = tiers[p].map(d => ({ d, i: 0 }));
      let moved = true;
      while (out.length < limit && moved) {
        moved = false;
        for (const ptr of pointers) {
          while (ptr.i < ptr.d.cards.length && Store.state.cards[`${ptr.d.id}:${ptr.i}`]) ptr.i++;
          if (ptr.i < ptr.d.cards.length && out.length < limit) {
            out.push(`${ptr.d.id}:${ptr.i}`);
            ptr.i++;
            moved = true;
          }
        }
      }
      if (out.length >= limit) break;
    }
    return out;
  }
  function knownCount() {
    return Object.values(Store.state.cards).filter(r => r.state === 'review').length;
  }
  function allLessons() {
    return App.weeks.flatMap(w => w.lessons.map(l => Object.assign({ week: w.week }, l)));
  }
  function nextLesson() {
    return allLessons().find(l => !Store.state.lessonsDone[l.id]) || null;
  }
  function currentWeek() {
    const l = nextLesson();
    return l ? App.weeks.find(w => w.week === l.week) : App.weeks[App.weeks.length - 1];
  }

  /* ---------- session composer ---------- */
  const SEC = 1000;
  function composeSession(minutes) {
    const t = now();
    const reviews = dueIds(t);
    const lesson = minutes >= 20 ? nextLesson() : null;
    const lessonSec = lesson ? (lesson.minutes || 7) * 60 : 0;
    const shadowSec = minutes >= 30 ? 240 : 0;
    const newBudget = Math.max(0, minutes * 60 - reviews.length * 8 - lessonSec - shadowSec - 30);
    const maxNew = Math.max(0, Store.state.settings.newPerDay - newIntroducedToday());
    let newCount = Math.min(Math.floor(newBudget / 25), maxNew);
    if (minutes < 20) newCount = Math.min(newCount, 6);
    const news = newCandidates(newCount);

    const plan = [];
    if (reviews.length) plan.push({ type: 'cards', label: 'Herhaling', queue: reviews });
    if (lesson) plan.push({ type: 'lesson', label: `Les: ${lesson.title}`, lesson });
    if (news.length) plan.push({ type: 'cards', label: 'Nieuwe woorden', queue: news });
    if (minutes >= 30) plan.push({ type: 'shadow', label: 'Spreken: zeg het hardop' });
    if (!plan.length) plan.push({ type: 'cards', label: 'Nieuwe woorden', queue: newCandidates(5) });

    return {
      startedAt: t,
      endAt: t + minutes * 60 * SEC,
      minutes,
      plan,
      segIdx: 0,
      pending: [],           // learning cards coming back later this session
      seenExamples: [],
      stats: { reviews: 0, newCards: 0, again: 0 }
    };
  }

  const LEARN_AHEAD = 20 * 60 * SEC;

  function nextCardId(s) {
    const t = now();
    s.pending.sort((a, b) => a.due - b.due);
    if (s.pending.length && s.pending[0].due <= t) return s.pending.shift().id;
    const seg = s.plan[s.segIdx];
    if (seg.queue && seg.queue.length) return seg.queue.shift();
    const lastCardSeg = !s.plan.slice(s.segIdx + 1).some(x => x.type === 'cards');
    if (lastCardSeg && s.pending.length && s.pending[0].due <= t + LEARN_AHEAD) {
      return s.pending.shift().id;
    }
    return null;
  }

  /* ---------- rendering: shell ---------- */
  function setTab(tab) {
    App.tab = tab;
    document.querySelectorAll('.tabbar button').forEach(b =>
      b.classList.toggle('active', b.dataset.tab === tab));
    if (tab === 'home') renderHome();
    if (tab === 'lessons') renderLessons();
    if (tab === 'progress') renderProgress();
    if (tab === 'more') renderMore();
  }

  function updateStreak() { $('#streakDays').textContent = Store.streak(); }

  /* ---------- home ---------- */
  function renderHome() {
    const h = new Date().getHours();
    const groet = h < 6 ? 'Goedenacht' : h < 12 ? 'Goedemorgen' : h < 18 ? 'Goedemiddag' : 'Goedenavond';
    const due = dueIds(now()).length;
    const week = currentWeek();
    const placementDone = Object.keys(Store.state.days).length > 0;
    view().innerHTML = `
      <h1>${groet}! 👋</h1>
      <p class="muted">${due ? `<strong>${due}</strong> kaart${due === 1 ? '' : 'en'} wachten op je.` : 'Geen kaarten die wachten. Lekker bezig!'}</p>
      ${placementDone ? '' : `
      <div class="panel" style="border-left:4px solid var(--blauw)">
        <h2>Eerste keer hier?</h2>
        <p class="muted">Sessie één is een plaatsingstoets met Claude: open de Leraar-map op je laptop en typ <strong>/toets</strong>. Daarna weet de app precies waar je begint. Je kunt ook gewoon hieronder starten.</p>
      </div>`}
      <div class="panel">
        <h2>Hoeveel tijd heb je? <span class="muted" style="font-weight:400">(how much time do you have?)</span></h2>
        <div class="time-grid">
          ${[[10, 'alleen herhalen'], [20, 'herhalen + les'], [30, '+ nieuwe woorden'], [45, '+ spreken']]
            .map(([m, d]) => `<button class="time-btn" data-min="${m}"><span class="t">${m}</span><span class="d">min · ${d}</span></button>`).join('')}
        </div>
        <div style="margin-top:14px"><button class="btn" id="startBtn" disabled>Start sessie</button></div>
        <p class="muted center" style="margin-bottom:0">Zelfs 10 minuten houdt je reeks in leven. 🔥</p>
      </div>
      <div class="panel mission">
        <h2>Missie van week ${week ? week.week : 1}</h2>
        <p style="margin-bottom:0">${week ? esc(week.mission) : ''}</p>
      </div>`;
    let chosen = 0;
    view().querySelectorAll('.time-btn').forEach(b => b.addEventListener('click', () => {
      view().querySelectorAll('.time-btn').forEach(x => x.classList.remove('sel'));
      b.classList.add('sel');
      chosen = +b.dataset.min;
      $('#startBtn').disabled = false;
    }));
    $('#startBtn').addEventListener('click', () => { if (chosen) startSession(chosen); });
    updateStreak();
  }

  /* ---------- session runner ---------- */
  function startSession(minutes) {
    App.session = composeSession(minutes);
    runSegment();
  }
  function segmentHeader(s) {
    const seg = s.plan[s.segIdx];
    const total = s.plan.length;
    return `<div class="rev-progress">
      <span>${s.segIdx + 1}/${total} · ${esc(seg.label)}</span>
      <div class="rev-bar"><div style="width:${Math.round(100 * s.segIdx / total)}%"></div></div>
      <button class="btn small secondary" id="stopBtn">Stop</button>
    </div>`;
  }
  function runSegment() {
    const s = App.session;
    if (!s || s.segIdx >= s.plan.length) return renderDone();
    const seg = s.plan[s.segIdx];
    if (seg.type === 'cards') return renderCard();
    if (seg.type === 'lesson') return renderLessonSegment(seg.lesson);
    if (seg.type === 'shadow') return renderShadow();
  }
  function endSegment() {
    App.session.segIdx += 1;
    runSegment();
  }
  function bindStop() {
    $('#stopBtn') && $('#stopBtn').addEventListener('click', renderDone);
  }

  function renderCard() {
    const s = App.session;
    const id = nextCardId(s);
    if (!id) return endSegment();
    const card = App.cards[id];
    const rec = Store.state.cards[id] || FSRS.newCard(now());
    const isNew = rec.state === 'new';
    const cloze = card.mode === 'cloze';
    const tag = isNew ? '✨ nieuw' : cloze ? 'grammatica' : 'herhaling';

    view().innerHTML = `${segmentHeader(s)}
      <div class="flashcard" id="fc">
        <div class="tag">${tag}</div>
        <div class="front">${esc(card.nl)}</div>
        <button class="speak-btn" id="speakBtn" aria-label="Luister">🔊</button>
        <div id="answer" hidden>
          <div class="back">${esc(card.en)}</div>
          ${card.ex ? `<div class="example">${esc(card.ex)}</div>` : ''}
        </div>
      </div>
      <div style="margin-top:14px" id="revealWrap"><button class="btn" id="revealBtn">Toon antwoord</button></div>
      <div class="rate-grid" id="rateGrid" hidden></div>`;
    bindStop();

    if (Store.state.settings.autoSpeak && !cloze) speak(card.nl);
    // before reveal, never speak a cloze answer: read the gapped sentence instead
    $('#speakBtn').addEventListener('click', () => speak(cloze ? (card.ex || card.nl) : card.nl));

    const reveal = () => {
      $('#answer').hidden = false;
      $('#revealWrap').hidden = true;
      const p = FSRS.preview(rec, now());
      $('#rateGrid').hidden = false;
      $('#rateGrid').innerHTML = [[1, 'Opnieuw'], [2, 'Moeilijk'], [3, 'Goed'], [4, 'Makkelijk']]
        .map(([r, l]) => `<button class="rate-btn rate-${r}" data-r="${r}">${l}<small>${p[r]}</small></button>`).join('');
      if (cloze && card.ex) speak(card.ex.replace('___', card.en));
      else if (Store.state.settings.autoSpeak && card.ex) speak(card.ex);
      $('#rateGrid').querySelectorAll('button').forEach(b => b.addEventListener('click', () => rateCard(id, +b.dataset.r)));
    };
    $('#revealBtn').addEventListener('click', reveal);
    $('#fc').addEventListener('click', e => { if (!e.target.closest('#speakBtn') && $('#revealWrap') && !$('#revealWrap').hidden) reveal(); });
  }

  function rateCard(id, rating) {
    const s = App.session;
    const t = now();
    const prev = Store.state.cards[id] || FSRS.newCard(t);
    const wasNew = prev.state === 'new';
    const next = FSRS.rate(prev, rating, t);
    Store.state.cards[id] = next;
    Store.bumpToday('reviews');
    if (wasNew) Store.bumpToday('newCards');
    s.stats.reviews += 1;
    if (wasNew) s.stats.newCards += 1;
    if (rating === 1) s.stats.again += 1;
    const ex = App.cards[id].ex;
    if (ex && !ex.includes('___') && !s.seenExamples.includes(ex)) s.seenExamples.push(ex);
    if ((next.state === 'learn' || next.state === 'relearn') && next.due <= s.endAt + LEARN_AHEAD) {
      s.pending.push({ id, due: next.due });
    }
    Store.save();
    updateStreak();
    renderCard();
  }

  /* ---------- lesson segment & reader ---------- */
  function mdLite(src) {
    const lines = src.split('\n');
    let html = '', para = [], table = [], list = [];
    const inline = t => esc(t)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<span class="nl">$1</span>');
    const flushPara = () => { if (para.length) { html += `<p>${inline(para.join(' '))}</p>`; para = []; } };
    const flushList = () => { if (list.length) { html += `<ul>${list.map(i => `<li>${inline(i)}</li>`).join('')}</ul>`; list = []; } };
    const flushTable = () => {
      if (!table.length) return;
      const rows = table.map(r => r.split('|').map(c => c.trim()).filter((c, i, a) => !(c === '' && (i === 0 || i === a.length - 1))));
      html += '<table>' + rows.map((cells, ri) =>
        `<tr>${cells.map(c => ri === 0 ? `<th>${inline(c)}</th>` : `<td>${inline(c)}</td>`).join('')}</tr>`).join('') + '</table>';
      table = [];
    };
    for (const raw of lines) {
      const line = raw.trimEnd();
      if (line.startsWith('|')) { flushPara(); flushList(); table.push(line); continue; }
      flushTable();
      if (line.startsWith('### ')) { flushPara(); flushList(); html += `<h3>${inline(line.slice(4))}</h3>`; }
      else if (line.startsWith('- ')) { flushPara(); list.push(line.slice(2)); }
      else if (line === '') { flushPara(); flushList(); }
      else para.push(line);
    }
    flushPara(); flushList(); flushTable();
    return html;
  }

  function lessonHTML(lesson) {
    return `<div class="panel lesson-body">
      <h2>${esc(lesson.title)}</h2>
      ${mdLite(lesson.body)}
    </div>`;
  }

  function renderLessonSegment(lesson) {
    const s = App.session;
    view().innerHTML = `${segmentHeader(s)}
      ${lessonHTML(lesson)}
      <button class="btn" id="toDrill">Naar de oefening →</button>`;
    bindStop();
    $('#toDrill').addEventListener('click', () => renderDrill(lesson, 0));
    window.scrollTo(0, 0);
  }

  function renderDrill(lesson, i) {
    const s = App.session;
    const items = lesson.drill || [];
    if (i >= items.length) {
      Store.state.lessonsDone[lesson.id] = new Date().toISOString();
      Store.save();
      return endSegment();
    }
    const it = items[i];
    view().innerHTML = `${segmentHeader(s)}
      <div class="flashcard">
        <div class="tag">oefening ${i + 1}/${items.length}</div>
        <div class="front" style="font-size:1.3rem">${esc(it.q)}</div>
        <div id="answer" hidden><div class="back">${esc(it.a)}</div></div>
      </div>
      <div style="margin-top:14px" id="revealWrap"><button class="btn" id="revealBtn">Toon antwoord</button></div>
      <div class="row" id="selfGrade" hidden style="margin-top:14px">
        <button class="btn" style="background:var(--rood)" data-ok="0">Fout ✗</button>
        <button class="btn" style="background:var(--groen)" data-ok="1">Goed ✓</button>
      </div>`;
    bindStop();
    $('#revealBtn').addEventListener('click', () => {
      $('#answer').hidden = false;
      $('#revealWrap').hidden = true;
      $('#selfGrade').hidden = false;
      speak(it.a);
    });
    view().querySelectorAll('#selfGrade .btn').forEach(b => b.addEventListener('click', () => {
      const d = Store.state.drill[lesson.id] || { right: 0, wrong: 0 };
      b.dataset.ok === '1' ? d.right++ : d.wrong++;
      Store.state.drill[lesson.id] = d;
      Store.save();
      renderDrill(lesson, i + 1);
    }));
  }

  /* ---------- shadowing (with optional self-recording) ---------- */
  const canRecord = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
  let rec = { recorder: null, url: null };

  function stopRecStream() {
    if (rec.recorder && rec.recorder.state !== 'inactive') rec.recorder.stop();
    if (rec.recorder) rec.recorder.stream.getTracks().forEach(t => t.stop());
    if (rec.url) { URL.revokeObjectURL(rec.url); rec.url = null; }
    rec.recorder = null;
  }

  function renderShadow(i = 0) {
    const s = App.session;
    if (!s.shadowSet) {
      const pool = s.seenExamples.length >= 5 ? s.seenExamples
        : App.decks.filter(d => d.mode !== 'cloze').flatMap(d => d.cards.map(c => c[2]).filter(Boolean));
      s.shadowSet = pool.slice(0, 8);
    }
    stopRecStream();
    if (i >= s.shadowSet.length) return endSegment();
    const sentence = s.shadowSet[i];
    view().innerHTML = `${segmentHeader(s)}
      <div class="flashcard">
        <div class="tag">spreken · zin ${i + 1}/${s.shadowSet.length}</div>
        <div class="front" style="font-size:1.25rem">${esc(sentence)}</div>
        <p class="muted">Luister, zeg de zin hardop na. ${canRecord ? 'Neem jezelf op en vergelijk met het voorbeeld.' : 'Twee keer. Let op de klanken.'}</p>
      </div>
      <div class="row" style="margin-top:14px">
        <button class="btn secondary" id="againBtn">🔊 Voorbeeld</button>
        ${canRecord ? '<button class="btn secondary" id="recBtn">⏺ Opnemen</button>' : ''}
        <button class="btn" id="nextBtn">Gezegd →</button>
      </div>
      <div class="row" style="margin-top:10px" id="playRow" hidden>
        <button class="btn secondary" id="playBtn">▶ Luister jezelf terug</button>
      </div>`;
    bindStop();
    speak(sentence);
    $('#againBtn').addEventListener('click', () => speak(sentence));
    $('#nextBtn').addEventListener('click', () => renderShadow(i + 1));
    if (canRecord) {
      $('#recBtn').addEventListener('click', async () => {
        const btn = $('#recBtn');
        if (rec.recorder && rec.recorder.state === 'recording') {
          rec.recorder.stop();
          btn.textContent = '⏺ Opnieuw opnemen';
          return;
        }
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const chunks = [];
          rec.recorder = new MediaRecorder(stream);
          rec.recorder.ondataavailable = e => chunks.push(e.data);
          rec.recorder.onstop = () => {
            if (rec.url) URL.revokeObjectURL(rec.url);
            rec.url = URL.createObjectURL(new Blob(chunks));
            stream.getTracks().forEach(t => t.stop());
            const row = $('#playRow');
            if (row) row.hidden = false;
          };
          rec.recorder.start();
          btn.textContent = '⏹ Stop';
        } catch (e) {
          btn.textContent = '🎙 Geen microfoon';
          btn.disabled = true;
        }
      });
      $('#playBtn').addEventListener('click', () => {
        if (rec.url) new Audio(rec.url).play();
      });
    }
  }

  /* ---------- done ---------- */
  function renderDone() {
    stopRecStream();
    const s = App.session;
    if (!s) return setTab('home');
    const mins = Math.max(1, Math.round((now() - s.startedAt) / 60000));
    Store.bumpToday('minutes', mins);
    Store.bumpToday('sessions');
    Store.save();
    Sync.auto();
    App.session = null;
    const week = currentWeek();
    view().innerHTML = `
      <div class="done-emoji">🎉</div>
      <h1 class="center">Goed gedaan!</h1>
      <div class="panel">
        <div class="stat-row">
          <div class="stat"><div class="n">${s.stats.reviews}</div><div class="l">kaarten geoefend</div></div>
          <div class="stat"><div class="n">${s.stats.newCards}</div><div class="l">nieuwe woorden</div></div>
          <div class="stat"><div class="n">${mins}</div><div class="l">minuten</div></div>
          <div class="stat"><div class="n">${Store.streak()} 🔥</div><div class="l">dagen op rij</div></div>
        </div>
      </div>
      <div class="panel mission">
        <h2>Vergeet je missie niet</h2>
        <p style="margin-bottom:0">${week ? esc(week.mission) : ''}</p>
      </div>
      <button class="btn" id="homeBtn">Klaar voor vandaag</button>`;
    updateStreak();
    $('#homeBtn').addEventListener('click', () => setTab('home'));
  }

  /* ---------- lessons tab ---------- */
  function renderLessons() {
    view().innerHTML = `<h1>Lessen</h1>
      <p class="muted">Lees vooruit wanneer je wilt; in een sessie komt de eerstvolgende ongelezen les vanzelf.</p>
      ${App.weeks.map(w => `
        <div class="week-head">Week ${w.week} · ${esc(w.theme)}</div>
        ${w.lessons.map(l => `
          <button class="lesson-list-item" data-id="${l.id}">
            <span class="check">${Store.state.lessonsDone[l.id] ? '✓' : '○'}</span>
            <span>${esc(l.title)}<br><span class="muted">${l.minutes || 7} min</span></span>
          </button>`).join('')}
        ${(w.listening && w.listening.length) ? `
          <div class="listening">🎧 Luisterdieet deze week:
            ${w.listening.map(x => `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.title)}</a>`).join(' · ')}
          </div>` : ''}`).join('')}`;
    view().querySelectorAll('.lesson-list-item').forEach(b =>
      b.addEventListener('click', () => renderLessonReader(b.dataset.id)));
  }

  function renderLessonReader(id) {
    const lesson = allLessons().find(l => l.id === id);
    if (!lesson) return renderLessons();
    const done = !!Store.state.lessonsDone[id];
    view().innerHTML = `
      <button class="btn small secondary" id="backBtn">← Lessen</button>
      ${lessonHTML(lesson)}
      ${done ? '<p class="muted center">✓ Gelezen</p>'
             : '<button class="btn" id="markBtn">Markeer als gelezen</button>'}`;
    $('#backBtn').addEventListener('click', renderLessons);
    $('#markBtn') && $('#markBtn').addEventListener('click', () => {
      Store.state.lessonsDone[id] = new Date().toISOString();
      Store.save();
      renderLessons();
    });
    window.scrollTo(0, 0);
  }

  /* ---------- progress tab ---------- */
  // Honest forecast: measured lesson pace against the 26-week plan (5/week).
  function forecastText() {
    const done = Object.keys(Store.state.lessonsDone).length;
    const total = allLessons().length;
    if (!Store.state.startDate || done < 3) {
      return 'Prognose: stevig B1 rond maand 3-4, B2-drempel rond maand 6 als de reeks standhoudt. Na een paar weken meet ik je echte tempo en wordt dit een eerlijke voorspelling.';
    }
    const daysIn = Math.max(1, (Date.now() - new Date(Store.state.startDate).getTime()) / 86400000);
    const pace = done / (daysIn / 7); // lessen per week
    const remaining = total - done;
    if (remaining <= 0) return 'Alle lessen gedaan. Nu is het onderhouden en spreken, spreken, spreken.';
    const weeksLeft = pace > 0.2 ? Math.round(remaining / pace) : null;
    if (!weeksLeft) return 'Je tempo ligt nu te laag om te voorspellen. Zelfs één les per week houdt de lijn vast.';
    const months = Math.round(weeksLeft / 4.3 * 10) / 10;
    const plan = Math.round((total - done) / 5);
    return `Jouw echte tempo: ${pace.toFixed(1)} les${pace >= 1.05 ? 'sen' : ''} per week. ` +
      `Bij dit tempo is de B2-stof over ~${months} maand${months >= 1.5 ? 'en' : ''} af ` +
      `(het plan rekent met ${plan} we${plan === 1 ? 'ek' : 'ken'}). De tweewekelijkse /toets stelt dit bij.`;
  }

  function renderProgress() {
    const days = Store.state.days;
    const labels = [], values = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const k = Store.todayKey(d);
      labels.push(['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'][d.getDay()]);
      values.push(days[k] ? days[k].reviews : 0);
    }
    const max = Math.max(1, ...values);
    const totalReviews = Object.values(days).reduce((a, d) => a + d.reviews, 0);
    const week = currentWeek();
    const phase = !week ? '' : week.week <= 6 ? 'Fase 1 · Fundament' : week.week <= 14 ? 'Fase 2 · Opbouw'
      : week.week <= 20 ? 'Fase 3 · Verdieping' : 'Fase 4 · Meesterschap';
    view().innerHTML = `<h1>Voortgang</h1>
      <div class="stat-row">
        <div class="stat"><div class="n">${Store.streak()} 🔥</div><div class="l">dagen op rij</div></div>
        <div class="stat"><div class="n">${knownCount()}</div><div class="l">woorden in je geheugen</div></div>
        <div class="stat"><div class="n">${dueTodayCount()}</div><div class="l">nog te doen vandaag</div></div>
        <div class="stat"><div class="n">${totalReviews}</div><div class="l">herhalingen totaal</div></div>
      </div>
      <div class="panel">
        <h2>Laatste 14 dagen</h2>
        <div class="chart">${values.map(v =>
          `<div class="bar ${v ? '' : 'empty'}" style="height:${Math.max(3, Math.round(100 * v / max))}%" title="${v}"></div>`).join('')}</div>
        <div class="chart-labels">${labels.map(l => `<span>${l}</span>`).join('')}</div>
      </div>
      <div class="panel">
        <h2>Waar je bent</h2>
        <p>Week ${week ? week.week : 1} van 26 · ${phase}</p>
        <p class="muted" style="margin-bottom:0">${forecastText()}</p>
      </div>`;
    updateStreak();
  }

  /* ---------- more tab ---------- */
  function renderMore() {
    const s = Store.state.settings;
    view().innerHTML = `<h1>Meer</h1>
      <div class="panel">
        <h2>Instellingen</h2>
        <div class="setting"><span>Nieuwe woorden per dag</span>
          <select id="setNew">${[6, 9, 12, 15, 20, 25].map(n =>
            `<option ${n === s.newPerDay ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
        <div class="setting"><span>Woorden automatisch uitspreken</span>
          <input type="checkbox" id="setSpeak" ${s.autoSpeak ? 'checked' : ''} style="width:22px;height:22px"></div>
        <div class="setting"><span>Nederlandse stem</span>
          <select id="setVoice"><option value="">automatisch (mannenstem indien beschikbaar)</option>${nlVoices.map(v =>
            `<option ${v.name === s.voice ? 'selected' : ''}>${esc(v.name)}</option>`).join('')}</select></div>
      </div>
      <div class="panel">
        <h2>Synchroniseren (telefoon ↔ laptop)</h2>
        <p class="muted">Automatisch via een privé GitHub-gist. Maak op github.com een <strong>fine-grained token</strong> met alleen <strong>gist</strong>-rechten en plak hem op beide apparaten. Sync gebeurt daarna vanzelf bij openen en na elke sessie.</p>
        <div class="setting"><span>GitHub-token</span>
          <input type="password" id="setToken" value="${esc(s.gistToken || '')}" placeholder="github_pat_..." style="max-width:180px"></div>
        <div class="row" style="margin-top:10px">
          <button class="btn secondary" id="syncBtn" ${s.gistToken ? '' : 'disabled'}>Sync nu</button>
        </div>
        <p class="muted" id="syncStatus">${s.lastSync ? 'Laatste sync: ' + new Date(s.lastSync).toLocaleString('nl-NL') : 'Nog nooit gesynchroniseerd.'}</p>
        <details>
          <summary class="muted">Handmatig (export/import)</summary>
          <div class="row" style="margin-top:10px">
            <button class="btn secondary" id="exportBtn">Exporteer</button>
            <button class="btn secondary" id="importBtn">Importeer</button>
          </div>
          <textarea class="io" id="ioBox" hidden placeholder="Plak hier je export en klik nog een keer op Importeer"></textarea>
        </details>
      </div>
      <div class="panel">
        <h2>Luisteren &amp; lezen (gratis)</h2>
        <ul style="padding-left:18px;margin:0">
          <li><a href="https://jeugdjournaal.nl" target="_blank" rel="noopener">NOS Jeugdjournaal</a> — nieuws in eenvoudig Nederlands</li>
          <li><a href="https://www.eenbeetjenederlands.nl" target="_blank" rel="noopener">Een Beetje Nederlands</a> — podcast voor leerders</li>
          <li><a href="https://www.learndutch.org" target="_blank" rel="noopener">learndutch.org (Bart de Pau)</a> — videolessen</li>
          <li><a href="https://www.oefenen.nl" target="_blank" rel="noopener">oefenen.nl</a> — oefenprogramma's</li>
          <li><a href="https://www.dutchgrammar.com" target="_blank" rel="noopener">dutchgrammar.com</a> — grammatica-naslagwerk</li>
          <li><a href="https://nt2taalmenu.nl" target="_blank" rel="noopener">nt2taalmenu.nl</a> — gratis NT2-oefeningen</li>
        </ul>
      </div>
      <div class="panel">
        <h2>Claude-sessies (op de laptop)</h2>
        <p class="muted" style="margin-bottom:0">Open de Leraar-map in Claude Code en typ <strong>/toets</strong> (plaatsingstoets en tweewekelijkse toets). <strong>/les</strong>, <strong>/gesprek</strong> en <strong>/schrijf</strong> komen in de volgende bouwfase.</p>
      </div>
      <div class="panel">
        <h2>Gevaarlijk</h2>
        <button class="btn small" style="background:var(--rood)" id="resetBtn">Wis alle voortgang</button>
      </div>
      <p class="muted center">Leraar · gemaakt voor jou · <a href="https://github.com/Gudzuh/Leraar" target="_blank" rel="noopener">broncode</a></p>`;

    $('#setToken').addEventListener('change', e => {
      s.gistToken = e.target.value.trim();
      Store.save();
      $('#syncBtn').disabled = !s.gistToken;
    });
    $('#syncBtn').addEventListener('click', async () => {
      const st = $('#syncStatus');
      st.textContent = 'Synchroniseren...';
      try {
        await Sync.sync();
        st.textContent = 'Gelukt ✓ · ' + new Date().toLocaleString('nl-NL');
        updateStreak();
      } catch (e) {
        st.textContent = 'Mislukt: ' + e.message;
      }
    });
    $('#setNew').addEventListener('change', e => { s.newPerDay = +e.target.value; Store.save(); });
    $('#setSpeak').addEventListener('change', e => { s.autoSpeak = e.target.checked; Store.save(); });
    $('#setVoice').addEventListener('change', e => { s.voice = e.target.value; Store.save(); });
    $('#exportBtn').addEventListener('click', () => {
      const box = $('#ioBox');
      box.hidden = false;
      box.value = Store.exportJSON();
      box.select();
      try { navigator.clipboard.writeText(box.value); } catch (e) { /* select-and-copy fallback stays */ }
    });
    $('#importBtn').addEventListener('click', () => {
      const box = $('#ioBox');
      if (box.hidden || !box.value.trim()) { box.hidden = false; box.focus(); return; }
      try {
        Store.importJSON(box.value.trim());
        alert('Voortgang geïmporteerd ✓');
        setTab('home');
      } catch (e) { alert('Import mislukt: ' + e.message); }
    });
    $('#resetBtn').addEventListener('click', () => {
      if (confirm('Weet je het zeker? Al je voortgang wordt gewist.') &&
          confirm('Echt zeker? Dit kan niet ongedaan worden gemaakt.')) {
        localStorage.removeItem('leraar.v1');
        location.reload();
      }
    });
  }

  /* ---------- boot ---------- */
  document.querySelectorAll('.tabbar button').forEach(b =>
    b.addEventListener('click', () => {
      if (App.session && !confirm('Sessie stoppen?')) return;
      if (App.session) { App.session = null; }
      setTab(b.dataset.tab);
    }));

  Store.load();
  loadData().then(() => {
    setTab('home');
    // pull the other device's progress in the background, then refresh
    Sync.auto().then(changed => { if (changed && App.tab === 'home' && !App.session) renderHome(); });
  }).catch(err => {
    view().innerHTML = `<div class="panel"><h2>Kon de lesdata niet laden</h2>
      <p class="muted">${esc(err.message)}. Controleer je verbinding en vernieuw de pagina.</p></div>`;
  });
})();
