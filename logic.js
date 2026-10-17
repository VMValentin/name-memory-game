// Pure game logic (no DOM) so it can be unit-tested with node.
(function (root) {
  function shuffle(arr, rand) {
    rand = rand || Math.random;
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // A session is a deck of ids. The current card is deck[0].
  function createSession(ids, opts) {
    opts = opts || {};
    const unique = Array.from(new Set(ids));
    return {
      total: unique.length,
      deck: opts.noShuffle ? unique : shuffle(unique, opts.rand),
      remembered: [],
      attempts: 0,
      forgotCounts: {},
    };
  }

  function current(s) { return s.deck.length ? s.deck[0] : null; }
  function isDone(s) { return s.deck.length === 0; }

  // Remembered: card leaves the session.
  // Forgot: card goes back into the deck (to the end, so you see others first).
  function answer(s, remembered) {
    if (isDone(s)) return s;
    const id = s.deck.shift();
    s.attempts++;
    if (remembered) {
      s.remembered.push(id);
    } else {
      s.forgotCounts[id] = (s.forgotCounts[id] || 0) + 1;
      s.deck.push(id);
    }
    return s;
  }

  function progress(s) {
    return { done: s.remembered.length, total: s.total, left: s.deck.length,
             pct: s.total ? Math.round(100 * s.remembered.length / s.total) : 100 };
  }

  // stats: { id: {seen, remembered, forgot, last} }
  function recordStat(stats, id, remembered, now) {
    const st = stats[id] || { seen: 0, remembered: 0, forgot: 0, last: 0 };
    st.seen++;
    if (remembered) st.remembered++; else st.forgot++;
    st.last = now || Date.now();
    stats[id] = st;
    return stats;
  }

  function forgetRate(st) { return st && st.seen ? st.forgot / st.seen : 0; }

  // Ids of people forgotten at least once, worst first.
  function mostForgotten(stats, limit) {
    return Object.keys(stats)
      .filter(id => stats[id].forgot > 0)
      .sort((a, b) => forgetRate(stats[b]) - forgetRate(stats[a]) || stats[b].forgot - stats[a].forgot)
      .slice(0, limit || 1e9);
  }

  // Ids not practiced in the last `days` days.
  function staleIds(stats, days, now) {
    now = now || Date.now();
    return Object.keys(stats).filter(id => now - stats[id].last > days * 864e5);
  }

  // Simple tip suggestion for custom people.
  function suggestTip(name) {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '';
    const first = parts[0], last = parts.length > 1 ? parts[parts.length - 1] : '';
    let t = `Pick their most striking feature (hair, nose, smile, glasses) and exaggerate it to cartoon size. ` +
      `Think of a word that sounds like "${first}"`;
    if (last) t += ` and a picture that sounds like "${last}"`;
    t += `, and imagine it happening right on that feature.`;
    return t;
  }

  const api = { shuffle, createSession, current, isDone, answer, progress, recordStat,
                forgetRate, mostForgotten, staleIds, suggestTip };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.NMGLogic = api;
})(typeof window !== 'undefined' ? window : globalThis);
