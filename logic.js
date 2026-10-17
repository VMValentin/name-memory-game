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


  // ---------- Name pegs ----------
  function normKey(s) {
    return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z]/g, '');
  }
  function pegPrimary(peg) {
    if (!peg || !peg.imgs || !peg.imgs.length) return '';
    const i = Math.min(Math.max(peg.primary || 0, 0), peg.imgs.length - 1);
    return peg.imgs[i] || peg.imgs.find(Boolean) || '';
  }
  // Built-in pegs + user edits + user-added pegs. user = {edits:{id:{...}}, custom:[...]}
  function mergePegs(builtin, user) {
    user = user || {};
    const edits = user.edits || {};
    const out = builtin.map(p => {
      const e = edits[p.id];
      if (!e) return Object.assign({}, p, { primary: p.primary || 0 });
      return Object.assign({}, p, e, { id: p.id, builtin: true, edited: true });
    });
    (user.custom || []).forEach(p => out.push(Object.assign({ primary: 0 }, p, { custom: true })));
    return out;
  }
  // key -> peg id. Earlier pegs win; the label is also a key.
  function buildPegIndex(pegs) {
    const idx = {};
    pegs.forEach(p => {
      [p.label].concat(p.keys || []).forEach(k => {
        const n = normKey(k);
        if (n.length >= 2 && !(n in idx)) idx[n] = p.id;
      });
    });
    return idx;
  }
  const SKIP_WORDS = new Set(['jr', 'sr', 'ii', 'iii', 'iv', 'of', 'the', 'da', 'de', 'di', 'du', 'la', 'von', 'der', 'del']);

  // Split one word into peg-matched chunks (dynamic programming: fewest pieces, unmatched letters cost a bit more).
  function splitWord(word, idx) {
    const w = normKey(word);
    if (!w) return [];
    if (idx[w]) return [{ text: word, pegId: idx[w] }];
    const n = w.length, INF = 1e9;
    const cost = new Array(n + 1).fill(INF), back = new Array(n + 1).fill(null);
    cost[0] = 0;
    for (let i = 0; i < n; i++) {
      if (cost[i] === INF) continue;
      if (cost[i] + 1.1 < cost[i + 1]) { cost[i + 1] = cost[i] + 1.1; back[i + 1] = { from: i, peg: null }; }
      for (let j = i + 2; j <= n; j++) {
        const id = idx[w.slice(i, j)];
        if (id && cost[i] + 1 < cost[j]) { cost[j] = cost[i] + 1; back[j] = { from: i, peg: id }; }
      }
    }
    const segs = [];
    for (let j = n; j > 0; j = back[j].from) segs.unshift({ a: back[j].from, b: j, pegId: back[j].peg });
    // merge consecutive unmatched letters
    const merged = [];
    segs.forEach(s => {
      const last = merged[merged.length - 1];
      if (!s.pegId && last && !last.pegId) last.b = s.b; else merged.push(Object.assign({}, s));
    });
    // fold tiny leftovers (1-2 unmatched letters) into a neighbouring matched part: "Cur|ie" -> "Curie"
    for (let i = 0; i < merged.length; i++) {
      const s = merged[i];
      if (s.pegId || merged.length < 2 || s.b - s.a > 2) continue;
      const nb = i > 0 ? i - 1 : i + 1;
      const t = merged[nb];
      if (!t.pegId) continue;
      t.a = Math.min(t.a, s.a); t.b = Math.max(t.b, s.b);
      merged.splice(i, 1); i--;
    }
    // map back to the original spelling (letters only, same count after accent stripping)
    const letters = Array.from(String(word).normalize('NFC')).filter(ch => normKey(ch));
    return merged.map(s => ({ text: letters.slice(s.a, s.b).join(''), pegId: s.pegId }));
  }
  function nameWords(name) {
    return String(name || '').split(/[\s\-]+/).filter(wd => { const k = normKey(wd); return k.length > 1 && !SKIP_WORDS.has(k); });
  }
  function splitName(name, idx) {
    return nameWords(name).reduce((acc, wd) => acc.concat(splitWord(wd, idx)), []);
  }
  // "Al | bert Ein | stein" -> parts, each matched exactly (whole text) against the pegs.
  function parseParts(str, idx) {
    return String(str || '').split(/[|\s]+/).filter(t => normKey(t)).map(t => ({ text: t, pegId: idx[normKey(t)] || null }));
  }
  function partsToString(parts) { return (parts || []).map(p => p.text).join(' | '); }
  // Image for a part: a custom image beats the peg's primary image.
  function partImage(part, pegsById) {
    if (part.img) return part.img;
    const peg = part.pegId && pegsById[part.pegId];
    return peg ? pegPrimary(peg) : '';
  }
  // "🎤 microphone (Mike)" -> "microphone (Mike)"
  function imgNoun(img) {
    return String(img || '').replace(/^[^A-Za-z0-9"'(]+/u, '').trim();
  }
  function article(noun) {
    if (/^(a|an|the|some|two|three)\s/i.test(noun) || /^["'(]/.test(noun)) return noun;
    if (/^[A-Z]/.test(noun)) return 'the ' + noun;
    return (/^[aeiou]/i.test(noun) ? 'an ' : 'a ') + noun;
  }
  const LINKS = ['crashes into', 'gets tangled up with', 'is balanced on top of', 'is chased by', 'explodes into'];
  function generateStory(name, images, feature) {
    const imgs = (images || []).map(imgNoun).filter(Boolean);
    const f = String(feature || '').trim().replace(/[.!\s]+$/, '');
    const start = f ? `Zoom in on the feature: ${f.charAt(0).toLowerCase() + f.slice(1)}.` : 'Zoom in on their most striking feature and blow it up to cartoon size.';
    const say = ` Say “${name}” out loud while you picture it.`;
    if (!imgs.length) return start + ' Make it huge, loud and ridiculous.' + say;
    if (imgs.length === 1) return `${start} A giant ${imgNoun(imgs[0])} is stuck right on it, wobbling and impossible to ignore.${say}`;
    let s = `${start} Out of it bursts ${article(imgs[0])}`;
    for (let i = 1; i < imgs.length; i++) s += `, which ${LINKS[(i - 1) % LINKS.length]} ${article(imgs[i])}`;
    return s + '. Everything is huge, noisy and ridiculous.' + say;
  }

  // ---------- storage migration ----------
  // data: plain object of localStorage values (already JSON-parsed). Returns the migrated object.
  const DATA_VERSION = 2;
  function migrate(data) {
    data = Object.assign({}, data);
    const v = data.version || 1;
    if (v < 2) {
      if (data.session && !data.session.kind) data.session = Object.assign({}, data.session, { kind: 'person' });
      if (!data.pegs) data.pegs = { edits: {}, custom: [] };
      if (!data.pegStats) data.pegStats = {};
      if (!data.stories) data.stories = {};
    }
    data.version = DATA_VERSION;
    return data;
  }

  // ---------- backup ----------
  function makeBackup(d) {
    return { app: 'name-memory-game', v: DATA_VERSION, tips: d.tips || {}, stats: d.stats || {}, custom: d.custom || [],
             pegs: d.pegs || { edits: {}, custom: [] }, pegStats: d.pegStats || {}, stories: d.stories || {} };
  }
  // Merge a backup (v1 or v2) into current data. Backup values win; custom people/pegs are added by id.
  function mergeBackup(cur, b) {
    if (!b || b.app !== 'name-memory-game') throw new Error('Not a Name Memory backup');
    const out = makeBackup(cur);
    out.tips = Object.assign({}, out.tips, b.tips || {});
    out.stats = Object.assign({}, out.stats, b.stats || {});
    out.stories = Object.assign({}, out.stories, b.stories || {});
    out.pegStats = Object.assign({}, out.pegStats, b.pegStats || {});
    const byIdMerge = (a, bb) => { const m = new Map(a.map(x => [x.id, x])); (bb || []).forEach(x => m.set(x.id, x)); return Array.from(m.values()); };
    out.custom = byIdMerge(out.custom, b.custom);
    const bp = b.pegs || {};
    out.pegs = { edits: Object.assign({}, (out.pegs.edits || {}), bp.edits || {}), custom: byIdMerge(out.pegs.custom || [], bp.custom) };
    return out;
  }

  const api = { shuffle, createSession, current, isDone, answer, progress, recordStat,
                forgetRate, mostForgotten, staleIds, suggestTip,
                normKey, pegPrimary, mergePegs, buildPegIndex, splitWord, splitName, nameWords, parseParts, partsToString,
                partImage, imgNoun, generateStory, migrate, DATA_VERSION, makeBackup, mergeBackup };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.NMGLogic = api;
})(typeof window !== 'undefined' ? window : globalThis);
