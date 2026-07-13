/* Persistent state in localStorage under one key. Export/import for phone<->laptop sync (M1);
 * gist sync arrives in Milestone 2. */
const Store = (() => {
  const KEY = 'leraar.v1';

  const DEFAULTS = () => ({
    cards: {},            // cardId -> FSRS record
    days: {},             // 'YYYY-MM-DD' -> {reviews, newCards, minutes, sessions}
    lessonsDone: {},      // lessonId -> ISO date
    drill: {},            // lessonId -> {right, wrong}
    settings: { newPerDay: 12, autoSpeak: true, voice: '', gistToken: '', gistId: '', lastSync: '' },
    startDate: null,      // first day of use, set on first session
    version: 1
  });

  let state = null;

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      const defaults = DEFAULTS();
      state = raw ? Object.assign(defaults, JSON.parse(raw)) : defaults;
      // deep-merge settings so new keys reach existing installs
      state.settings = Object.assign(DEFAULTS().settings, state.settings);
    } catch (e) {
      console.error('Kon voortgang niet laden', e);
      state = DEFAULTS();
    }
    return state;
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      console.error('Kon voortgang niet opslaan', e);
    }
  }

  const todayKey = (d = new Date()) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  function bumpToday(field, n = 1) {
    const k = todayKey();
    if (!state.days[k]) state.days[k] = { reviews: 0, newCards: 0, minutes: 0, sessions: 0 };
    state.days[k][field] += n;
    if (!state.startDate) state.startDate = k;
  }

  function streak() {
    let n = 0;
    const d = new Date();
    // today counts if there was activity; otherwise start from yesterday
    if (!state.days[todayKey(d)]) d.setDate(d.getDate() - 1);
    while (state.days[todayKey(d)] && state.days[todayKey(d)].reviews > 0) {
      n += 1;
      d.setDate(d.getDate() - 1);
    }
    return n;
  }

  function exportJSON() {
    return JSON.stringify({ exported: new Date().toISOString(), data: state });
  }

  function importJSON(text) {
    const parsed = JSON.parse(text);
    const incoming = parsed.data || parsed;
    if (!incoming.cards || !incoming.settings) throw new Error('Geen geldig Leraar-exportbestand');
    state = Object.assign(DEFAULTS(), incoming);
    save();
    return state;
  }

  return { load, save, todayKey, bumpToday, streak, exportJSON, importJSON,
           get state() { return state; } };
})();
