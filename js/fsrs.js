/* FSRS-4.5 scheduler (default parameters) + learning steps.
 * Ratings: 1 = Opnieuw (again), 2 = Moeilijk (hard), 3 = Goed (good), 4 = Makkelijk (easy).
 * Card record: { state:'new'|'learn'|'review'|'relearn', step, due, s, d, reps, lapses, last }
 * All times are epoch ms. Intervals returned by the scheduler are in days.
 */
const FSRS = (() => {
  const W = [0.4872, 1.4003, 3.7145, 13.8206, 5.1618, 1.2298, 0.8975, 0.031,
             1.6474, 0.1367, 1.0461, 2.1072, 0.0793, 0.3246, 1.587, 0.2272, 2.8755];
  const DAY = 86400000;
  const REQUEST_R = 0.9;          // target retention
  const MAX_IVL = 365;            // days
  const LEARN_STEPS = [1, 10];    // minutes; then graduate
  const RELEARN_STEPS = [10];     // minutes after a lapse

  const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

  const initStability = r => Math.max(W[r - 1], 0.1);
  const initDifficulty = r => clamp(W[4] - (r - 3) * W[5], 1, 10);
  const retrievability = (days, s) => Math.pow(1 + days / (9 * s), -1);
  const nextInterval = s => clamp(Math.round(9 * s * (1 / REQUEST_R - 1)), 1, MAX_IVL);

  function nextDifficulty(d, r) {
    const nd = d - W[6] * (r - 3);
    return clamp(W[7] * initDifficulty(3) + (1 - W[7]) * nd, 1, 10);
  }
  function recallStability(d, s, retr, r) {
    const hard = r === 2 ? W[15] : 1;
    const easy = r === 4 ? W[16] : 1;
    return s * (Math.exp(W[8]) * (11 - d) * Math.pow(s, -W[9]) *
                (Math.exp(W[10] * (1 - retr)) - 1) * hard * easy + 1);
  }
  function forgetStability(d, s, retr) {
    return Math.min(
      W[11] * Math.pow(d, -W[12]) * (Math.pow(s + 1, W[13]) - 1) * Math.exp(W[14] * (1 - retr)),
      s);
  }

  function newCard(now) {
    return { state: 'new', step: 0, due: now, s: 0, d: 0, reps: 0, lapses: 0, last: 0 };
  }

  // Apply a rating; returns a NEW record. Pure: caller persists it.
  function rate(rec, rating, now) {
    const c = Object.assign({}, rec);
    c.reps += 1;
    c.last = now;

    const graduate = r => {
      c.state = 'review';
      c.step = 0;
      c.s = initStability(r);
      c.d = initDifficulty(r);
      c.due = now + nextInterval(c.s) * DAY;
    };

    if (c.state === 'new' || c.state === 'learn' || c.state === 'relearn') {
      const steps = c.state === 'relearn' ? RELEARN_STEPS : LEARN_STEPS;
      if (c.state === 'new') c.state = 'learn';
      if (rating === 1) {
        c.step = 0;
        c.due = now + steps[0] * 60000;
      } else if (rating === 2) {
        c.due = now + steps[Math.min(c.step, steps.length - 1)] * 60000 * 1.5;
      } else if (rating === 3) {
        if (c.step + 1 < steps.length) {
          c.step += 1;
          c.due = now + steps[c.step] * 60000;
        } else if (c.state === 'relearn') {
          // back to review after successful relearn step; stability was already reduced at lapse
          c.state = 'review';
          c.step = 0;
          c.due = now + Math.max(1, nextInterval(c.s)) * DAY;
        } else {
          graduate(3);
        }
      } else {
        if (c.state === 'relearn') {
          c.state = 'review'; c.step = 0;
          c.due = now + Math.max(1, nextInterval(c.s)) * DAY;
        } else {
          graduate(4);
        }
      }
      return c;
    }

    // review state
    const elapsed = Math.max(0, (now - rec.last) / DAY);
    const retr = retrievability(elapsed, rec.s || 0.5);
    if (rating === 1) {
      c.lapses += 1;
      c.d = nextDifficulty(rec.d, 1);
      c.s = Math.max(0.1, forgetStability(rec.d, rec.s, retr));
      c.state = 'relearn';
      c.step = 0;
      c.due = now + RELEARN_STEPS[0] * 60000;
    } else {
      c.d = nextDifficulty(rec.d, rating);
      c.s = recallStability(rec.d, rec.s, retr, rating);
      let ivl = nextInterval(c.s);
      if (rating === 2) ivl = Math.max(1, Math.round(ivl * 0.8));
      // small fuzz so cards don't clump on the same day
      ivl = clamp(Math.round(ivl * (0.95 + Math.random() * 0.1)), 1, MAX_IVL);
      c.due = now + ivl * DAY;
    }
    return c;
  }

  // Preview button labels: what would each rating schedule?
  function preview(rec, now) {
    const fmt = ms => {
      const m = ms / 60000;
      if (m < 60) return `${Math.max(1, Math.round(m))}m`;
      const d = ms / DAY;
      if (d < 1.5) return '1d';
      if (d < 30) return `${Math.round(d)}d`;
      return `${(d / 30.4).toFixed(1).replace('.0', '')}mnd`;
    };
    const out = {};
    for (const r of [1, 2, 3, 4]) out[r] = fmt(rate(rec, r, now).due - now);
    return out;
  }

  return { newCard, rate, preview, retrievability, DAY };
})();
