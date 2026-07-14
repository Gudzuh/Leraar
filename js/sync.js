/* Gist sync: phone <-> laptop progress sync through one private GitHub Gist.
 * Setup once per device in Meer: paste a fine-grained token with ONLY gist scope.
 * The token lives in localStorage and is sent only to api.github.com. */
const Sync = (() => {
  const API = 'https://api.github.com';
  const FILENAME = 'leraar-progress.json';

  const cfg = () => Store.state.settings;

  // Trim defensively: pasted tokens often carry stray spaces or newlines.
  const token = () => (cfg().gistToken || '').trim();

  function headers() {
    return {
      // classic tokens accept "token", fine-grained accept "Bearer"; "token"
      // works for both, so use it for the widest compatibility.
      'Authorization': 'token ' + token(),
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json'
    };
  }

  // Build a rich error that includes GitHub's own message (e.g. "Bad credentials").
  async function ghError(resp, label) {
    let msg = '';
    try { const b = await resp.json(); if (b && b.message) msg = ': ' + b.message; } catch (e) { /* no body */ }
    return new Error(label + ' (' + resp.status + ')' + msg);
  }

  // Non-secret description of the stored token, for diagnosing auth failures.
  function diag() {
    const t = token();
    if (!t) return 'geen token opgeslagen';
    const kind = t.startsWith('ghp_') ? 'classic (ghp_)'
      : t.startsWith('github_pat_') ? 'fine-grained (github_pat_)'
      : 'onbekend voorvoegsel';
    const raw = cfg().gistToken || '';
    const ws = raw !== raw.trim() ? ', had spaties' : '';
    return kind + ', lengte ' + t.length + ws;
  }

  /* Merge two full states. Conservative: never lose review history. */
  function merge(local, remote) {
    const out = JSON.parse(JSON.stringify(local));
    if (!remote) return out;

    for (const [id, r] of Object.entries(remote.cards || {})) {
      const l = out.cards[id];
      if (!l || (r.last || 0) > (l.last || 0)) out.cards[id] = r;
    }
    for (const [day, r] of Object.entries(remote.days || {})) {
      const l = out.days[day];
      out.days[day] = !l ? r : {
        reviews: Math.max(l.reviews || 0, r.reviews || 0),
        newCards: Math.max(l.newCards || 0, r.newCards || 0),
        minutes: Math.max(l.minutes || 0, r.minutes || 0),
        sessions: Math.max(l.sessions || 0, r.sessions || 0)
      };
    }
    for (const [id, date] of Object.entries(remote.lessonsDone || {})) {
      if (!out.lessonsDone[id] || date < out.lessonsDone[id]) out.lessonsDone[id] = date;
    }
    for (const [id, r] of Object.entries(remote.drill || {})) {
      const l = out.drill[id];
      out.drill[id] = !l ? r : { right: Math.max(l.right, r.right), wrong: Math.max(l.wrong, r.wrong) };
    }
    if (remote.startDate && (!out.startDate || remote.startDate < out.startDate)) {
      out.startDate = remote.startDate;
    }
    // settings stay local on purpose (voice names differ per device)
    return out;
  }

  async function createGist(content) {
    const resp = await fetch(API + '/gists', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        description: 'Leraar voortgang (automatisch gesynchroniseerd)',
        public: false,
        files: { [FILENAME]: { content } }
      })
    });
    if (!resp.ok) throw await ghError(resp, 'gist aanmaken mislukt');
    return (await resp.json()).id;
  }

  /* Find this account's existing Leraar gist by filename, so a second device
   * using the same token joins the first device's gist instead of making a
   * new one. Returns the gist id, or null if none exists yet. */
  async function findExistingGist() {
    const resp = await fetch(API + '/gists?per_page=100', { headers: headers() });
    if (!resp.ok) throw await ghError(resp, 'gists ophalen mislukt [' + diag() + ']');
    const gists = await resp.json();
    const match = gists.find(g => g.files && g.files[FILENAME]);
    return match ? match.id : null;
  }

  /* Full sync: pull remote, merge, save locally, push merged back. */
  async function sync() {
    const s = cfg();
    if (!s.gistToken) throw new Error('geen token ingesteld');

    // First sync on a device: adopt an existing Leraar gist if one exists.
    if (!s.gistId) {
      s.gistId = await findExistingGist() || '';
      if (s.gistId) Store.save();
    }

    let remoteState = null;
    if (s.gistId) {
      const resp = await fetch(`${API}/gists/${s.gistId}`, { headers: headers() });
      if (resp.status === 404) { s.gistId = ''; }
      else if (!resp.ok) throw await ghError(resp, 'gist ophalen mislukt [' + diag() + ']');
      else {
        const gist = await resp.json();
        const file = gist.files && gist.files[FILENAME];
        if (file) {
          const text = file.truncated ? await (await fetch(file.raw_url)).text() : file.content;
          try { remoteState = JSON.parse(text); } catch (e) { remoteState = null; }
        }
      }
    }

    const merged = merge(Store.state, remoteState);
    // keep this device's settings & gist config
    merged.settings = Store.state.settings;
    Object.assign(Store.state, merged);
    Store.save();

    const content = JSON.stringify(merged);
    if (!s.gistId) {
      s.gistId = await createGist(content);
      Store.save();
    } else {
      const resp = await fetch(`${API}/gists/${s.gistId}`, {
        method: 'PATCH',
        headers: headers(),
        body: JSON.stringify({ files: { [FILENAME]: { content } } })
      });
      if (!resp.ok) throw await ghError(resp, 'gist bijwerken mislukt');
    }
    s.lastSync = new Date().toISOString();
    Store.save();
    return true;
  }

  /* Quiet auto-sync: never throws, returns true/false. */
  async function auto() {
    if (!cfg().gistToken || !navigator.onLine) return false;
    try { await sync(); return true; }
    catch (e) { console.warn('Auto-sync overgeslagen:', e.message); return false; }
  }

  const enabled = () => !!cfg().gistToken;

  return { sync, auto, enabled, diag };
})();
