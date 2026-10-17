/* Name Memory – flashcard game for remembering names and faces. Vanilla JS, no build step. */
(function () {
  'use strict';
  const L = window.NMGLogic;
  const $ = (sel, el) => (el || document).querySelector(sel);
  const view = $('#view');

  // ---------- storage ----------
  const K = { tips: 'nmg.tips', stats: 'nmg.stats', custom: 'nmg.custom', selected: 'nmg.selected', session: 'nmg.session', imgs: 'nmg.imgfix',
               pegs: 'nmg.pegs', pegStats: 'nmg.pegStats', stories: 'nmg.stories', version: 'nmg.version' };
  function load(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { toast('Could not save (storage full?)'); } }

  // One-time migration of older saved data (v1 had no pegs/stories and sessions had no kind).
  (function migrateStorage() {
    const before = load(K.version, 1);
    if (before >= L.DATA_VERSION) return;
    const m = L.migrate({ version: before, session: load(K.session, null), pegs: load(K.pegs, null), pegStats: load(K.pegStats, null), stories: load(K.stories, null) });
    ['session', 'pegs', 'pegStats', 'stories', 'version'].forEach(k => save(K[k], m[k]));
  })();

  let tips = load(K.tips, {});
  let stats = load(K.stats, {});
  let custom = load(K.custom, []);
  let selected = new Set(load(K.selected, []));
  let session = load(K.session, null);
  let imgFix = load(K.imgs, {});
  let pegUser = load(K.pegs, { edits: {}, custom: [] });
  let pegStats = load(K.pegStats, {});
  let stories = load(K.stories, {});

  // ---------- pegs ----------
  let PEGS = [], PEG_BY = {}, PEG_IDX = {};
  function refreshPegs() {
    PEGS = L.mergePegs(window.NMG_PEGS, pegUser);
    PEG_BY = {}; PEGS.forEach(p => { PEG_BY[p.id] = p; });
    PEG_IDX = L.buildPegIndex(PEGS);
  }
  refreshPegs();
  function savePegs() { save(K.pegs, pegUser); refreshPegs(); }
  function pegsSorted() { return PEGS.slice().sort((a, b) => a.label.replace(/^[-\s]+/, '').localeCompare(b.label.replace(/^[-\s]+/, ''))); }

  const ui = { tab: 'browse', cat: 'All', q: '', flipped: false, libSort: 'forgot', libSel: new Set(), pegFilter: 'all', pegQ: '', pegSel: new Set() };

  function allPeople() { return window.NMG_PEOPLE.concat(custom); }
  function byId(id) { return allPeople().find(p => p.id === id); }
  function categories() {
    const seen = [];
    allPeople().forEach(p => { if (!seen.includes(p.category)) seen.push(p.category); });
    return seen;
  }
  function tipFor(p) { return tips[p.id] != null ? tips[p.id] : (p.tip || ''); }
  // The person's name story: user overrides > built-in data > auto-split.
  function storyFor(p) {
    const o = stories[p.id] || {};
    return {
      parts: o.parts || p.parts || L.splitName(p.name, PEG_IDX),
      feature: o.feature != null ? o.feature : (p.feature || ''),
      story: o.story != null ? o.story : (p.story || ''),
      edited: !!stories[p.id],
    };
  }
  function partImg(part) { return L.partImage(part, PEG_BY); }
  function emojiOf(img) { const m = String(img || '').match(/^[^A-Za-z0-9"'(]+/u); return m ? m[0].trim() : ''; }
  function partsHTML(parts) {
    return `<div class="parts">${parts.map(pt => { const im = partImg(pt); return `
      <div class="part"><div class="pe">${esc(emojiOf(im) || '❔')}</div><div class="pt">${esc(pt.text)}</div><div class="pn">${esc(L.imgNoun(im) || 'no image yet')}</div></div>`; }).join('<div class="plus">+</div>')}</div>`;
  }
  function saveSelected() { save(K.selected, Array.from(selected)); }
  function saveSession() { save(K.session, session); }

  // ---------- helpers ----------
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function initials(name) { return esc(String(name).split(/\s+/).map(w => w[0] || '').join('').slice(0, 2).toUpperCase()); }
  function imgSrc(p) { return imgFix[p.id] || p.img || ''; }
  function photo(p, cls) {
    const src = imgSrc(p);
    if (!src) return `<div class="${cls || ''} placeholder">${initials(p.name)}</div>`;
    return `<img class="${cls || ''}" src="${esc(src)}" alt="Photo" loading="lazy" referrerpolicy="no-referrer" data-pid="${esc(p.id)}">`;
  }
  // If a hardcoded image fails, ask the Wikipedia REST API for the current thumbnail once.
  document.addEventListener('error', async (ev) => {
    const img = ev.target;
    if (!(img instanceof HTMLImageElement) || !img.dataset.pid || img.dataset.retried) return;
    img.dataset.retried = '1';
    const p = byId(img.dataset.pid);
    let fixed = null;
    if (p && p.wiki) {
      try {
        const r = await fetch('https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(p.wiki));
        const j = await r.json();
        fixed = (j.thumbnail && j.thumbnail.source) || null;
      } catch (e) { /* offline */ }
    }
    if (fixed && fixed !== img.src) { imgFix[p.id] = fixed; save(K.imgs, imgFix); img.src = fixed; }
    else { const d = document.createElement('div'); d.className = img.className + ' placeholder'; d.textContent = p ? p.name.split(/\s+/).map(w => w[0]).join('').slice(0, 2) : '?'; img.replaceWith(d); }
  }, true);

  function toast(msg) {
    const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
    document.body.appendChild(t); setTimeout(() => t.remove(), 2000);
  }
  function speak(text) {
    if (!('speechSynthesis' in window)) { toast('Speech not supported on this device'); return; }
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text); u.rate = 0.85; speechSynthesis.speak(u);
  }
  function fmtDate(ts) { if (!ts) return 'never'; const d = new Date(ts); return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); }
  function slug(s) { return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }

  const STEPS_HTML = (name) => `<ol class="steps">
      <li><b>Hear it:</b> listen to the name — tap 🔊 to hear “${esc(name)}”.</li>
      <li><b>Repeat it</b> in your head two or three times.</li>
      <li><b>Picture it:</b> turn each part of the name into its peg image and tie them to an exaggerated feature in one silly story.</li>
      <li><b>Say it out loud</b> while picturing that scene.</li></ol>`;
  const METHOD_HTML = `<div class="method">
      <b>The name-peg method</b>
      <p>Like number pegs (9 = flag, 0 = donut → a flag stuck in a donut), you learn a fixed image for common names and name sounds <i>once</i>: Mike = 🎤 microphone, Bill = 🦆 duck bill, -son = ☀️ sun, -stein = 🍺 beer stein.</p>
      <p>Then every new person is quick: <b>pegs</b> for the parts of their name + their <b>exaggerated feature</b> → one vivid <b>story</b>. Picture it, then <b>say the name out loud</b>.</p>
      <p class="muted" style="margin:0">Example: <b>Al·bert Ein·stein</b> = 🦉 owl + 🐦 Big Bird + ☝️ “#1” finger + 🍺 beer stein, all crammed into that wild white hair.</p></div>`;

  // ---------- modal ----------
  const modal = $('#modal'), modalCard = $('#modalCard');
  function openModal(html) { modalCard.innerHTML = html; modal.classList.remove('hidden'); modalCard.scrollTop = 0; modalCard.onclick = null; modalCard.oninput = null; modalCard.onchange = null; }
  function closeModal() { modal.classList.add('hidden'); modalCard.innerHTML = ''; }
  modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });

  function pegOptions(selectedId) {
    return `<option value="">(no peg: type an image →)</option>` + pegsSorted().map(pg =>
      `<option value="${esc(pg.id)}" ${pg.id === selectedId ? 'selected' : ''}>${esc(pg.label)}: ${esc(L.pegPrimary(pg))}</option>`).join('');
  }

  function openDetails(id) {
    const p = byId(id); if (!p) return;
    const st = stats[id];
    const sf = storyFor(p);
    let draft = sf.parts.map(pt => Object.assign({}, pt));
    openModal(`
      ${photo(p, 'big')}
      <h2>${esc(p.name)}</h2>
      <div class="muted">${esc(p.desc || p.category)}</div>
      <div class="row" style="margin-top:10px">
        <button class="btn small" data-act="hear">🔊 Hear the name</button>
        ${p.wiki ? `<a class="btn small ghost" style="text-decoration:none" target="_blank" rel="noopener" href="https://en.wikipedia.org/wiki/${encodeURIComponent(p.wiki)}">Wikipedia ↗</a>` : ''}
      </div>
      ${STEPS_HTML(p.name)}
      <h3>Name story</h3>
      <div id="dParts"></div>
      <label for="dSplit">Name parts <span class="muted" style="font-weight:400">(separate with | then tap Match)</span></label>
      <input type="text" id="dSplit" value="${esc(L.partsToString(draft))}" autocomplete="off" autocapitalize="off">
      <div class="row" style="margin-top:8px">
        <button class="btn small" data-act="match">Match pegs</button>
        <button class="btn small ghost" data-act="auto">Auto-split name</button>
      </div>
      <div id="dPartRows"></div>
      <label for="dFeature">Exaggerated feature</label>
      <input type="text" id="dFeature" value="${esc(sf.feature)}" placeholder="e.g. huge curly mustache" autocomplete="off">
      <label for="dStory">Story (one vivid scene)</label>
      <textarea id="dStory" placeholder="Combine the peg images and the feature in one scene">${esc(sf.story)}</textarea>
      <div class="row" style="margin-top:8px"><button class="btn small" data-act="suggest">✨ Suggest a story</button></div>
      <details style="margin-top:12px"${sf.story ? '' : ' open'}><summary><b>Quick tip</b> <span class="muted">(fallback when there's no story)</span></summary>
        <textarea id="tipEdit">${esc(tipFor(p))}</textarea>
        ${p.tip ? '<button class="btn small ghost" style="margin-top:6px" data-act="resettip">Use suggested tip</button>' : ''}
      </details>
      <div class="row" style="margin-top:14px">
        <button class="btn primary" data-act="save">Save</button>
        ${sf.edited && !p.custom ? '<button class="btn ghost" data-act="resetstory">Reset story to built-in</button>' : ''}
        <button class="btn ghost" data-act="close">Close</button>
      </div>
      ${st ? `<p class="muted">Seen ${st.seen}× · remembered ${st.remembered}× · forgot ${st.forgot}× · last practiced ${fmtDate(st.last)}</p>` : ''}`);
    function drawParts() {
      $('#dParts').innerHTML = draft.length ? partsHTML(draft) : '<p class="muted">No parts yet.</p>';
      $('#dPartRows').innerHTML = draft.map((pt, i) => `
        <div class="partrow" data-i="${i}">
          <b>${esc(pt.text)}</b>
          <select data-role="peg" aria-label="Peg for ${esc(pt.text)}">${pegOptions(pt.pegId)}</select>
          <input type="text" data-role="img" placeholder="…or your own image, e.g. 🍋 lemon" value="${esc(pt.img || '')}" autocomplete="off">
        </div>`).join('');
    }
    drawParts();
    modalCard.onchange = (e) => {
      const row = e.target.closest('.partrow'); if (!row) return;
      const pt = draft[+row.dataset.i];
      if (e.target.dataset.role === 'peg') { pt.pegId = e.target.value || null; if (pt.pegId) delete pt.img; drawParts(); }
    };
    modalCard.oninput = (e) => {
      const row = e.target.closest('.partrow'); if (!row || e.target.dataset.role !== 'img') return;
      const pt = draft[+row.dataset.i]; const v = e.target.value.trim();
      if (v) pt.img = v; else delete pt.img;
      $('#dParts').innerHTML = partsHTML(draft);
    };
    modalCard.onclick = (e) => {
      const act = e.target.closest('[data-act]'); if (!act) return;
      const a = act.dataset.act;
      if (a === 'hear') speak(p.name);
      if (a === 'close') closeModal();
      if (a === 'match') { draft = L.parseParts($('#dSplit').value, PEG_IDX); drawParts(); }
      if (a === 'auto') { draft = L.splitName(p.name, PEG_IDX); $('#dSplit').value = L.partsToString(draft); drawParts(); }
      if (a === 'suggest') { $('#dStory').value = L.generateStory(p.name, draft.map(partImg), $('#dFeature').value); }
      if (a === 'resettip') { $('#tipEdit').value = p.tip; }
      if (a === 'resetstory') { delete stories[p.id]; save(K.stories, stories); toast('Story reset'); closeModal(); render(); }
      if (a === 'save') {
        const v = $('#tipEdit').value.trim();
        if (v && v !== p.tip) tips[p.id] = v; else delete tips[p.id];
        save(K.tips, tips);
        stories[p.id] = { parts: draft, feature: $('#dFeature').value.trim(), story: $('#dStory').value.trim() };
        save(K.stories, stories);
        toast('Saved'); closeModal(); render();
      }
    };
  }

  function openHelp() {
    openModal(`<h2>How to remember names</h2>
      ${STEPS_HTML('the name')}
      ${METHOD_HTML}
      <h3>Using the game</h3>
      <p><b>Pick:</b> filter by category, tap photos to select them (or “Select all”). Tap <i>Story &amp; details</i> to see the name's pegs, the feature and the story, and to edit them.</p>
      <p><b>Practice:</b> look at the face and try to recall the name. Tap to flip, say the name out loud, then tap <b>Remembered</b> or <b>Forgot</b>. Remembered cards leave the session; forgotten ones come back until the deck is empty.</p>
      <p><b>Pegs:</b> the image library for names and sounds. Drill the pegs until they're automatic, pick your favorite image for each, and add your own.</p>
      <p><b>Library:</b> every name you've practiced, with stats. Review all of them, the ones you forget most, or ones you haven't seen in a while.</p>
      <p><b>Add:</b> add your own people (coworkers, neighbors…) with a photo, a feature and a story.</p>
      <p class="muted">Progress is saved on this device. Use Library → Export to move it to another device. On iPhone/iPad: Share → “Add to Home Screen” to use it like an app.</p>
      <button class="btn primary" style="width:100%" data-act="x">Got it</button>`);
    modalCard.onclick = (e) => { if (e.target.closest('[data-act=x]')) closeModal(); };
  }
  $('#helpBtn').onclick = openHelp;

  // ---------- tabs ----------
  document.querySelectorAll('.tabbar button').forEach(b => b.onclick = () => go(b.dataset.tab));
  function go(tab) {
    ui.tab = tab;
    document.querySelectorAll('.tabbar button').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    window.scrollTo(0, 0); render();
  }
  function render() {
    document.querySelectorAll('.selbar').forEach(e => e.remove());
    ({ browse: renderBrowse, practice: renderPractice, pegs: renderPegs, library: renderLibrary, add: renderAdd })[ui.tab]();
  }

  // ---------- browse / pick ----------
  function visiblePeople() {
    const q = ui.q.trim().toLowerCase();
    return allPeople().filter(p => (ui.cat === 'All' || p.category === ui.cat) && (!q || p.name.toLowerCase().includes(q)));
  }
  function renderBrowse() {
    const list = visiblePeople();
    const allSel = list.length && list.every(p => selected.has(p.id));
    view.innerHTML = `
      <div class="chips">${['All'].concat(categories()).map(c => `<button class="chip ${c === ui.cat ? 'active' : ''}" data-cat="${esc(c)}">${esc(c)}</button>`).join('')}</div>
      <input type="text" id="search" placeholder="Search names…" value="${esc(ui.q)}" autocomplete="off">
      <div class="row" style="margin-top:10px">
        <button class="btn small" data-act="selall">${allSel ? 'Unselect' : 'Select'} all ${ui.cat === 'All' ? '' : esc(ui.cat)} (${list.length})</button>
        <button class="btn small ghost" data-act="random">🎲 Random 10</button>
        ${selected.size ? `<button class="btn small ghost" data-act="clear">Clear selection</button>` : ''}
      </div>
      <div class="grid">${list.map(p => `
        <div class="pcard ${selected.has(p.id) ? 'sel' : ''}" data-id="${esc(p.id)}">
          <button class="tapzone" data-act="toggle" aria-label="Select ${esc(p.name)}">
            ${photo(p, 'photo')}
            <div class="body"><div class="nm">${esc(p.name)}</div><div class="tip">${esc(storyFor(p).story || tipFor(p))}</div></div>
          </button>
          <span class="check">✓</span>
          <button class="more" data-act="details">Story &amp; details</button>
        </div>`).join('')}</div>
      ${list.length ? '' : '<div class="empty">No people match.</div>'}`;
    document.querySelectorAll('.selbar').forEach(e => e.remove());
    const sb = document.createElement('div'); sb.className = 'selbar';
    sb.innerHTML = `<button class="btn primary" ${selected.size ? '' : 'disabled'} id="startSel">▶ Practice ${selected.size} selected</button>`;
    document.body.appendChild(sb);
    $('#startSel').onclick = () => startSession(Array.from(selected));
    const s = $('#search');
    s.oninput = () => { ui.q = s.value; const pos = s.selectionStart; renderBrowse(); const n = $('#search'); n.focus(); n.setSelectionRange(pos, pos); };
    view.onclick = (e) => {
      const chip = e.target.closest('[data-cat]'); if (chip) { ui.cat = chip.dataset.cat; renderBrowse(); return; }
      const act = e.target.closest('[data-act]'); if (!act) return;
      const card = act.closest('.pcard'); const id = card && card.dataset.id;
      switch (act.dataset.act) {
        case 'toggle': selected.has(id) ? selected.delete(id) : selected.add(id); saveSelected(); updateCard(card, id); break;
        case 'details': openDetails(id); break;
        case 'selall': list.forEach(p => allSel ? selected.delete(p.id) : selected.add(p.id)); saveSelected(); renderBrowse(); break;
        case 'clear': selected.clear(); saveSelected(); renderBrowse(); break;
        case 'random': selected = new Set(L.shuffle(list.map(p => p.id)).slice(0, 10)); saveSelected(); renderBrowse(); toast('Picked ' + selected.size + ' at random'); break;
      }
    };
  }
  function updateCard(card, id) {
    card.classList.toggle('sel', selected.has(id));
    const b = $('#startSel'); b.disabled = !selected.size; b.textContent = `▶ Practice ${selected.size} selected`;
  }

  // ---------- practice (people and pegs) ----------
  // session.kind: 'person' (default, older saves) or 'peg'
  function sKind(s) { return (s && s.kind) || 'person'; }
  function itemExists(kind, id) { return kind === 'peg' ? !!PEG_BY[id] : !!byId(id); }
  function itemName(kind, id) { return kind === 'peg' ? (PEG_BY[id] || {}).label : (byId(id) || {}).name; }
  function startSession(ids, label, kind) {
    kind = kind || 'person';
    ids = ids.filter(id => itemExists(kind, id));
    if (!ids.length) { toast('Nothing to practice yet'); return; }
    session = L.createSession(ids); session.kind = kind; session.label = label || 'Practice'; session.started = Date.now();
    ui.flipped = false; saveSession(); go('practice');
  }
  function personBack(p) {
    const sf = storyFor(p);
    const tip = tipFor(p);
    return `
      <div class="bname">${esc(p.name)}</div>
      <div class="bdesc">${esc(p.desc || p.category)}</div>
      ${sf.parts.length ? partsHTML(sf.parts) : ''}
      ${sf.feature ? `<div class="feature">🔍 <b>Feature:</b> ${esc(sf.feature)}</div>` : ''}
      ${sf.story ? `<div class="btip">🎬 ${esc(sf.story)}</div>` : `<div class="btip">💡 ${esc(tip) || '<i>No story yet. Tap Edit to build one.</i>'}</div>`}
      ${sf.story && tip ? `<details class="oldtip"><summary>Quick tip</summary>${esc(tip)}</details>` : ''}
      <div class="say">🗣️ Say it out loud: “${esc(p.name)}”, while picturing the scene.</div>`;
  }
  function pegFront(pg) {
    return `<div class="pegfront"><div class="pegkind">${pg.kind === 'sound' ? 'Name sound' : 'First name'}</div>
      <div class="peglabel">${esc(pg.label)}</div>
      <div class="muted">${esc((pg.keys || []).slice(0, 6).join(' · '))}</div></div>
      <div class="hint">What's the peg image? Picture it, then <b>tap to flip</b>.</div>`;
  }
  function pegBack(pg) {
    const prim = L.pegPrimary(pg);
    return `<div class="bname">${esc(pg.label)}</div>
      <div class="pegbig">${esc(emojiOf(prim))}</div>
      <div class="center" style="font-size:20px;font-weight:700">${esc(L.imgNoun(prim))}</div>
      ${pg.imgs.filter(im => im && im !== prim).length ? `<div class="center muted" style="margin-top:8px">Also: ${pg.imgs.filter(im => im && im !== prim).map(esc).join(' · ')}</div>` : ''}
      <div class="say">🗣️ Say it: “${esc(pg.label.replace(/^-\s*/, ''))} = ${esc(L.imgNoun(prim))}”</div>`;
  }
  function renderPractice() {
    if (!session) return renderPracticeStart();
    if (L.isDone(session)) return renderSummary();
    const kind = sKind(session);
    const id = L.current(session);
    const item = kind === 'peg' ? PEG_BY[id] : byId(id);
    if (!item) { L.answer(session, true); saveSession(); return renderPractice(); }
    const pr = L.progress(session);
    const front = kind === 'peg' ? pegFront(item) : `${photo(item, '')}<div class="hint">Who is this? Recall the name, then <b>tap to flip</b>.</div>`;
    const back = kind === 'peg' ? pegBack(item) : personBack(item);
    const spoken = kind === 'peg' ? `${item.label.replace(/^-\s*/, '')}. ${L.imgNoun(L.pegPrimary(item))}` : item.name;
    view.innerHTML = `
      <div class="row" style="justify-content:space-between;margin:0">
        <b>${esc(session.label)}</b><span class="muted">✅ ${pr.done} of ${pr.total} · ${pr.left} left</span>
      </div>
      <div class="progress"><div style="width:${pr.pct}%"></div></div>
      <div class="stage"><div class="flash ${ui.flipped ? 'flipped' : ''}" id="flash" role="button" aria-label="Flip card">
        <div class="face front ${kind === 'peg' ? 'pegcard' : ''}">${front}</div>
        <div class="face back">
          ${back}
          <div class="row" style="justify-content:center;margin-top:12px">
            <button class="btn small" data-act="hear">🔊 Hear it</button>
            <button class="btn small ghost" data-act="edit">✏️ Edit</button>
          </div>
        </div>
      </div></div>
      <div class="answer" ${ui.flipped ? '' : 'style="visibility:hidden"'} id="answer">
        <button class="btn bad" data-act="forgot">✗ Forgot</button>
        <button class="btn good" data-act="remembered">✓ Remembered</button>
      </div>
      <div class="center"><button class="btn small ghost" data-act="end">End session</button></div>`;
    view.onclick = (e) => {
      const act = e.target.closest('[data-act]');
      if (act) {
        e.stopPropagation();
        const a = act.dataset.act;
        if (a === 'hear') speak(spoken);
        if (a === 'edit') kind === 'peg' ? openPegEditor(id) : openDetails(id);
        if (a === 'remembered' || a === 'forgot') answerCard(id, a === 'remembered');
        if (a === 'end') { if (confirm('End this session?')) { session = null; saveSession(); render(); } }
        return;
      }
      if (e.target.closest('summary')) return;
      if (e.target.closest('#flash')) {
        ui.flipped = !ui.flipped;
        $('#flash').classList.toggle('flipped', ui.flipped);
        $('#answer').style.visibility = ui.flipped ? 'visible' : 'hidden';
      }
    };
  }
  function answerCard(id, remembered) {
    if (sKind(session) === 'peg') { L.recordStat(pegStats, id, remembered); save(K.pegStats, pegStats); }
    else { L.recordStat(stats, id, remembered); save(K.stats, stats); }
    L.answer(session, remembered); saveSession();
    ui.flipped = false; render();
  }
  function renderSummary() {
    const kind = sKind(session);
    const tricky = Object.keys(session.forgotCounts);
    const firstTry = session.total - tricky.length;
    view.innerHTML = `<div class="empty">
        <div style="font-size:56px">🎉</div><h2>Deck complete!</h2>
        <p>${session.total} ${kind === 'peg' ? 'pegs' : 'names'} · ${firstTry} on the first try · ${session.attempts} total flips</p>
        ${tricky.length ? `<p class="muted">Tricky ones: ${tricky.map(id => esc(itemName(kind, id))).join(', ')}</p>` : '<p>Perfect round!</p>'}
        <div class="row" style="justify-content:center">
          ${tricky.length ? '<button class="btn primary" data-act="tricky">Practice the tricky ones</button>' : ''}
          <button class="btn" data-act="again">Run all again</button>
          <button class="btn ghost" data-act="lib">${kind === 'peg' ? 'Back to Pegs' : 'Go to Library'}</button>
        </div></div>`;
    const all = session.remembered.slice();
    view.onclick = (e) => {
      const a = e.target.closest('[data-act]'); if (!a) return;
      if (a.dataset.act === 'tricky') startSession(tricky, 'Tricky ones', kind);
      if (a.dataset.act === 'again') startSession(all, session.label, kind);
      if (a.dataset.act === 'lib') { session = null; saveSession(); go(kind === 'peg' ? 'pegs' : 'library'); }
    };
  }
  function renderPracticeStart() {
    const practiced = Object.keys(stats).filter(byId);
    const worst = L.mostForgotten(stats, 10).filter(byId);
    view.innerHTML = `<h2>Start practicing</h2>
      <div class="list">
        <button class="btn primary" data-act="sel" ${selected.size ? '' : 'disabled'}>▶ Practice my ${selected.size} selected</button>
        <button class="btn" data-act="pick">🗂️ Pick people to practice</button>
        <button class="btn" data-act="worst" ${worst.length ? '' : 'disabled'}>🔁 Most forgotten (${worst.length})</button>
        <button class="btn" data-act="old" ${practiced.length ? '' : 'disabled'}>📚 All old names (${practiced.length})</button>
        <button class="btn" data-act="pegs">🧷 Drill the name pegs</button>
      </div>
      <div class="empty" style="margin-top:16px;text-align:left"><b>Remember the 4 steps</b>${STEPS_HTML('the name')}</div>`;
    view.onclick = (e) => {
      const a = e.target.closest('[data-act]'); if (!a || a.disabled) return;
      if (a.dataset.act === 'sel') startSession(Array.from(selected), 'Selected');
      if (a.dataset.act === 'pick') go('browse');
      if (a.dataset.act === 'worst') startSession(worst, 'Most forgotten');
      if (a.dataset.act === 'old') startSession(practiced, 'All old names');
      if (a.dataset.act === 'pegs') go('pegs');
    };
  }

  // ---------- peg library ----------
  function visiblePegs() {
    const q = L.normKey(ui.pegQ);
    return pegsSorted().filter(pg => {
      if (ui.pegFilter === 'name' && pg.kind !== 'name') return false;
      if (ui.pegFilter === 'sound' && pg.kind !== 'sound') return false;
      if (ui.pegFilter === 'mine' && !(pg.custom || pg.edited)) return false;
      if (!q) return true;
      return [pg.label].concat(pg.keys || [], pg.imgs || []).some(k => L.normKey(k).includes(q));
    });
  }
  function renderPegs() {
    const list = visiblePegs();
    const worst = L.mostForgotten(pegStats, 20).filter(id => PEG_BY[id]);
    const learned = Object.keys(pegStats).filter(id => PEG_BY[id]).length;
    const filters = [['all', 'All'], ['name', 'First names'], ['sound', 'Sounds'], ['mine', 'Mine']];
    view.innerHTML = `
      <details class="method-wrap" ${learned ? '' : 'open'}><summary><b>How name pegs work</b></summary>${METHOD_HTML}</details>
      <div class="row" style="margin-top:10px">
        <button class="btn primary small" data-act="drillsel" ${ui.pegSel.size ? '' : 'disabled'}>▶ Drill ${ui.pegSel.size} selected</button>
        <button class="btn small" data-act="drillrand">🎲 Random 20</button>
        <button class="btn small" data-act="drillworst" ${worst.length ? '' : 'disabled'}>🔁 Most forgotten (${worst.length})</button>
        <button class="btn small" data-act="drillshown">Drill all shown (${list.length})</button>
      </div>
      <div class="chips">${filters.map(([k, t]) => `<button class="chip ${ui.pegFilter === k ? 'active' : ''}" data-filter="${k}">${t}</button>`).join('')}</div>
      <input type="text" id="pegSearch" placeholder="Search pegs or images…" value="${esc(ui.pegQ)}" autocomplete="off" autocapitalize="off">
      <div class="row" style="margin-top:10px">
        <button class="btn small" data-act="newpeg">＋ Add a peg</button>
        <button class="btn small ghost" data-act="selshown">Select shown</button>
        ${ui.pegSel.size ? '<button class="btn small ghost" data-act="clearsel">Clear selection</button>' : ''}
        <span class="muted">${PEGS.length} pegs · ${learned} drilled</span>
      </div>
      <div class="peggrid">${list.map(pg => { const st = pegStats[pg.id]; const prim = L.pegPrimary(pg); return `
        <div class="pegtile ${ui.pegSel.has(pg.id) ? 'sel' : ''}" data-id="${esc(pg.id)}">
          <button class="tapzone" data-act="toggle" aria-label="Select ${esc(pg.label)}">
            <div class="pe">${esc(emojiOf(prim))}</div>
            <div class="pl">${esc(pg.label)}</div>
            <div class="pn">${esc(L.imgNoun(prim))}</div>
            ${pg.imgs.length > 1 ? `<div class="alts">${pg.imgs.filter(im => im !== prim).map(im => esc(emojiOf(im) || L.imgNoun(im))).join(' ')}</div>` : ''}
            ${st ? `<div class="pst">✓${st.remembered} ✗${st.forgot}</div>` : ''}
            ${pg.custom ? '<div class="badge">mine</div>' : pg.edited ? '<div class="badge">edited</div>' : ''}
          </button>
          <span class="check">✓</span>
          <button class="more" data-act="edit">Edit</button>
        </div>`; }).join('')}</div>
      ${list.length ? '' : '<div class="empty">No pegs match.</div>'}`;
    const s = $('#pegSearch');
    s.oninput = () => { ui.pegQ = s.value; const pos = s.selectionStart; renderPegs(); const n = $('#pegSearch'); n.focus(); n.setSelectionRange(pos, pos); };
    view.onclick = (e) => {
      const f = e.target.closest('[data-filter]'); if (f) { ui.pegFilter = f.dataset.filter; renderPegs(); return; }
      const act = e.target.closest('[data-act]'); if (!act || act.disabled) return;
      const tile = act.closest('.pegtile'); const id = tile && tile.dataset.id;
      switch (act.dataset.act) {
        case 'toggle': ui.pegSel.has(id) ? ui.pegSel.delete(id) : ui.pegSel.add(id); tile.classList.toggle('sel', ui.pegSel.has(id)); updatePegSelBtn(); break;
        case 'edit': openPegEditor(id); break;
        case 'newpeg': openPegEditor(null); break;
        case 'selshown': list.forEach(pg => ui.pegSel.add(pg.id)); renderPegs(); break;
        case 'clearsel': ui.pegSel.clear(); renderPegs(); break;
        case 'drillsel': startSession(Array.from(ui.pegSel), 'Peg drill', 'peg'); break;
        case 'drillrand': startSession(L.shuffle(list.map(pg => pg.id)).slice(0, 20), 'Peg drill: random 20', 'peg'); break;
        case 'drillworst': startSession(worst, 'Peg drill: most forgotten', 'peg'); break;
        case 'drillshown': startSession(list.map(pg => pg.id), 'Peg drill', 'peg'); break;
      }
    };
  }
  function updatePegSelBtn() {
    const b = view.querySelector('[data-act=drillsel]'); if (!b) return;
    b.disabled = !ui.pegSel.size; b.textContent = `▶ Drill ${ui.pegSel.size} selected`;
  }
  function openPegEditor(id) {
    const pg = id ? PEG_BY[id] : { id: null, label: '', kind: 'name', keys: [], imgs: [], primary: 0 };
    if (!pg) return;
    const imgs = pg.imgs.concat(['', '', '']).slice(0, 3);
    const prim = Math.min(pg.primary || 0, Math.max(pg.imgs.length - 1, 0));
    const builtin = id && !pg.custom;
    openModal(`<h2>${id ? 'Edit peg' : 'New peg'}</h2>
      <label for="pgLabel">Name or sound</label>
      <input type="text" id="pgLabel" value="${esc(pg.label)}" placeholder="e.g. Victor, or -son" autocomplete="off">
      <label for="pgKind">Type</label>
      <select id="pgKind"><option value="name" ${pg.kind === 'name' ? 'selected' : ''}>First name</option><option value="sound" ${pg.kind === 'sound' ? 'selected' : ''}>Name sound / syllable</option></select>
      <label for="pgKeys">Spellings it matches <span class="muted" style="font-weight:400">(comma separated)</span></label>
      <input type="text" id="pgKeys" value="${esc((pg.keys || []).join(', '))}" placeholder="e.g. vic, victor, victoria" autocomplete="off" autocapitalize="off">
      <label>Images <span class="muted" style="font-weight:400">(up to 3, pick your primary one)</span></label>
      ${imgs.map((im, i) => `<div class="imgrow">
        <input type="radio" name="pgPrim" value="${i}" ${i === prim ? 'checked' : ''} aria-label="Primary image ${i + 1}">
        <input type="text" id="pgImg${i}" value="${esc(im)}" placeholder="${i === 0 ? 'e.g. 🏆 trophy' : 'alternative image (optional)'}" autocomplete="off"></div>`).join('')}
      <p class="muted" style="font-size:14px">Start with an emoji if you like, it shows up big on the cards.</p>
      ${pegStats[pg.id] ? `<p class="muted">Drilled ${pegStats[pg.id].seen}× · ✓ ${pegStats[pg.id].remembered} · ✗ ${pegStats[pg.id].forgot} · ${fmtDate(pegStats[pg.id].last)}</p>` : ''}
      <div class="row" style="margin-top:12px">
        <button class="btn primary" data-act="save">Save peg</button>
        ${builtin && pg.edited ? '<button class="btn ghost" data-act="reset">Reset to built-in</button>' : ''}
        ${id && pg.custom ? '<button class="btn bad" data-act="delete">Delete</button>' : ''}
        <button class="btn ghost" data-act="close">Cancel</button>
      </div>`);
    modalCard.onclick = (e) => {
      const act = e.target.closest('[data-act]'); if (!act) return;
      const a = act.dataset.act;
      if (a === 'close') closeModal();
      if (a === 'reset') { delete pegUser.edits[id]; savePegs(); toast('Peg reset'); closeModal(); render(); }
      if (a === 'delete') {
        if (!confirm('Delete this peg?')) return;
        pegUser.custom = pegUser.custom.filter(x => x.id !== id); delete pegStats[id]; ui.pegSel.delete(id);
        save(K.pegStats, pegStats); savePegs(); closeModal(); render();
      }
      if (a === 'save') {
        const label = $('#pgLabel').value.trim();
        const raw = [0, 1, 2].map(i => $('#pgImg' + i).value.trim());
        const pi = +((modalCard.querySelector('input[name=pgPrim]:checked') || {}).value || 0);
        const imgs = raw.filter(Boolean);
        if (!label) return toast('Enter a name or sound');
        if (!imgs.length) return toast('Add at least one image');
        const primary = raw[pi] ? imgs.indexOf(raw[pi]) : 0;
        const keys = $('#pgKeys').value.split(',').map(k => k.trim()).filter(Boolean);
        const data = { label, kind: $('#pgKind').value, keys: keys.length ? keys : [label.replace(/^-\s*/, '')], imgs, primary };
        if (builtin) pegUser.edits[id] = data;
        else if (id) pegUser.custom = pegUser.custom.map(x => x.id === id ? Object.assign({ id }, data) : x);
        else {
          let nid = 'u-' + (slug(label) || Date.now()); while (PEG_BY[nid]) nid += '-2';
          pegUser.custom.push(Object.assign({ id: nid }, data));
        }
        savePegs(); toast('Peg saved'); closeModal(); render();
      }
    };
  }

  // ---------- library ----------
  function renderLibrary() {
    const ids = Object.keys(stats).filter(byId);
    const tot = ids.reduce((a, id) => (a.seen += stats[id].seen, a.rem += stats[id].remembered, a), { seen: 0, rem: 0 });
    const sorters = {
      forgot: (a, b) => L.forgetRate(stats[b]) - L.forgetRate(stats[a]) || stats[b].forgot - stats[a].forgot,
      recent: (a, b) => stats[b].last - stats[a].last,
      oldest: (a, b) => stats[a].last - stats[b].last,
      name: (a, b) => byId(a).name.localeCompare(byId(b).name),
    };
    ids.sort(sorters[ui.libSort]);
    ui.libSel = new Set(Array.from(ui.libSel).filter(id => stats[id]));
    const worst = L.mostForgotten(stats, 10).filter(byId);
    const stale = L.staleIds(stats, 7).filter(byId);
    view.innerHTML = `<h2>Your name library</h2>
      ${ids.length ? `<div><span class="stat"><b>${ids.length}</b> names</span><span class="stat"><b>${tot.seen}</b> flips</span><span class="stat"><b>${tot.seen ? Math.round(100 * tot.rem / tot.seen) : 0}%</b> remembered</span></div>
      <div class="row">
        <button class="btn primary small" data-act="all">Review all (${ids.length})</button>
        <button class="btn small" data-act="worst" ${worst.length ? '' : 'disabled'}>Most forgotten (${worst.length})</button>
        <button class="btn small" data-act="stale" ${stale.length ? '' : 'disabled'}>Not seen in 7+ days (${stale.length})</button>
        <button class="btn small" data-act="sel" ${ui.libSel.size ? '' : 'disabled'}>Review checked (${ui.libSel.size})</button>
      </div>
      <div class="row"><label for="sort" style="margin:0">Sort</label>
        <select id="sort" style="width:auto">
          <option value="forgot">Most forgotten</option><option value="recent">Recently practiced</option>
          <option value="oldest">Longest ago</option><option value="name">Name</option></select></div>
      <div class="list">${ids.map(id => { const p = byId(id), s = stats[id]; return `
        <div class="lrow" data-id="${esc(id)}">
          <input type="checkbox" data-act="check" ${ui.libSel.has(id) ? 'checked' : ''} aria-label="Select ${esc(p.name)}">
          ${photo(p, '')}
          <div class="info" data-act="details"><b>${esc(p.name)}</b>
            <small>Seen ${s.seen} · ✓ ${s.remembered} · ✗ ${s.forgot} · ${fmtDate(s.last)}</small>
            <div class="bar"><div style="width:${Math.round(100 * s.remembered / s.seen)}%"></div></div></div>
        </div>`; }).join('')}</div>`
      : `<div class="empty">No names practiced yet.<br><br><button class="btn primary" data-act="pick">Pick people to practice</button></div>`}
      <h3 style="margin-top:28px">Backup</h3>
      <p class="muted">Progress lives on this device. Export it to copy your tips, stories, pegs, custom people and stats to another device.</p>
      <div class="row">
        <button class="btn small ghost" data-act="export">⬇️ Export</button>
        <label class="btn small ghost" style="margin:0;display:inline-flex;align-items:center">⬆️ Import<input type="file" id="importFile" accept="application/json,.json" hidden></label>
        <button class="btn small ghost" data-act="reset">Reset stats</button>
      </div>`;
    const sort = $('#sort'); if (sort) { sort.value = ui.libSort; sort.onchange = () => { ui.libSort = sort.value; renderLibrary(); }; }
    $('#importFile').onchange = importData;
    view.onclick = (e) => {
      const a = e.target.closest('[data-act]'); if (!a || a.disabled) return;
      const row = a.closest('.lrow'); const id = row && row.dataset.id;
      switch (a.dataset.act) {
        case 'check': a.checked ? ui.libSel.add(id) : ui.libSel.delete(id); renderLibrary(); break;
        case 'details': openDetails(id); break;
        case 'all': startSession(ids, 'All old names'); break;
        case 'worst': startSession(worst, 'Most forgotten'); break;
        case 'stale': startSession(stale, 'Not seen lately'); break;
        case 'sel': startSession(Array.from(ui.libSel), 'Review'); break;
        case 'pick': go('browse'); break;
        case 'export': exportData(); break;
        case 'reset': if (confirm('Clear all practice stats? Tips and custom people are kept.')) { stats = {}; save(K.stats, stats); renderLibrary(); } break;
      }
    };
  }
  function exportData() {
    const data = JSON.stringify(L.makeBackup({ tips, stats, custom, pegs: pegUser, pegStats, stories }), null, 1);
    const blob = new Blob([data], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'name-memory-backup.json';
    document.body.appendChild(a); a.click(); a.remove();
  }
  function importData(e) {
    const f = e.target.files[0]; if (!f) return;
    f.text().then(t => {
      const m = L.mergeBackup({ tips, stats, custom, pegs: pegUser, pegStats, stories }, JSON.parse(t));
      tips = m.tips; stats = m.stats; custom = m.custom; pegUser = m.pegs; pegStats = m.pegStats; stories = m.stories;
      save(K.tips, tips); save(K.stats, stats); save(K.custom, custom); save(K.pegStats, pegStats); save(K.stories, stories); savePegs();
      toast('Backup imported'); renderLibrary();
    }).catch(() => toast('That file is not a Name Memory backup'));
  }

  // ---------- add custom ----------
  function renderAdd() {
    const cats = categories();
    view.innerHTML = `<h2>Add a person</h2>
      <p class="muted">Add anyone you want to remember — a coworker, a neighbor, a famous face. Tip: type a famous name and tap “Find photo on Wikipedia”.</p>
      <label for="cName">Name</label><input type="text" id="cName" placeholder="e.g. Jane Smith" autocomplete="off">
      <div class="row" style="margin-top:8px"><button class="btn small" data-act="wiki">🔎 Find photo on Wikipedia</button></div>
      <label for="cImg">Photo URL</label><input type="url" id="cImg" placeholder="https://…" autocomplete="off">
      <div id="cPrev" style="margin-top:8px"></div>
      <label for="cCat">Category</label>
      <input type="text" id="cCat" list="catList" value="Custom" autocomplete="off">
      <datalist id="catList">${cats.map(c => `<option value="${esc(c)}">`).join('')}<option value="Custom"></datalist>
      <label for="cFeature">Exaggerated feature</label><input type="text" id="cFeature" placeholder="e.g. bushy red eyebrows" autocomplete="off">
      <div id="cParts" style="margin-top:10px"></div>
      <label for="cStory">Story</label><textarea id="cStory" placeholder="Name pegs + feature in one vivid scene"></textarea>
      <div class="row" style="margin-top:8px"><button class="btn small ghost" data-act="suggest">✨ Suggest a story from my pegs</button></div>
      <p class="muted" style="font-size:14px">After adding, tap the person to fine-tune which peg image each part of the name uses.</p>
      <button class="btn primary" style="width:100%;margin-top:12px" data-act="save">Add person</button>
      ${custom.length ? `<h3 style="margin-top:28px">Your people (${custom.length})</h3><div class="list">${custom.map(p => `
        <div class="lrow" data-id="${esc(p.id)}">${photo(p, '')}<div class="info" data-act="details"><b>${esc(p.name)}</b><small>${esc(p.category)}</small></div>
        <button class="btn small ghost" data-act="del">Delete</button></div>`).join('')}</div>` : ''}`;
    const img = $('#cImg');
    let wikiTitle = null, wikiDesc = '';
    const preview = () => { $('#cPrev').innerHTML = img.value ? `<img src="${esc(img.value)}" alt="" referrerpolicy="no-referrer" style="max-width:160px;max-height:200px;border-radius:12px" onerror="this.replaceWith(document.createTextNode('⚠️ Could not load that image'))">` : ''; };
    img.oninput = () => { wikiTitle = null; preview(); };
    view.onclick = async (e) => {
      const a = e.target.closest('[data-act]'); if (!a) return;
      const name = $('#cName') ? $('#cName').value.trim() : '';
      const row = a.closest('.lrow');
      switch (a.dataset.act) {
        case 'suggest': {
          if (!name) return toast('Enter a name first');
          const parts = L.splitName(name, PEG_IDX);
          $('#cParts').innerHTML = parts.length ? partsHTML(parts) : '';
          $('#cStory').value = L.generateStory(name, parts.map(partImg), $('#cFeature').value);
          break;
        }
        case 'wiki': {
          if (!name) return toast('Enter a name first');
          try {
            const r = await fetch('https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(name.replace(/ /g, '_')));
            if (!r.ok) throw 0;
            const j = await r.json();
            if (!j.thumbnail) return toast('No photo found on Wikipedia');
            img.value = j.thumbnail.source; wikiTitle = j.titles ? j.titles.canonical : name; wikiDesc = j.description || ''; preview();
          } catch (err) { toast('No Wikipedia page found'); }
          break;
        }
        case 'save': {
          if (!name) return toast('Enter a name');
          let id = 'c-' + (slug(name) || Date.now()); while (byId(id)) id += '-2';
          const p = { id, name, category: $('#cCat').value.trim() || 'Custom', img: img.value.trim(), tip: '', desc: wikiDesc, custom: true };
          if (wikiTitle) p.wiki = wikiTitle;
          const feature = $('#cFeature').value.trim();
          const parts = L.splitName(name, PEG_IDX);
          stories[id] = { parts, feature, story: $('#cStory').value.trim() || L.generateStory(name, parts.map(partImg), feature) };
          custom.push(p); save(K.custom, custom); save(K.stories, stories);
          selected.add(id); saveSelected();
          toast(name + ' added and selected'); renderAdd(); break;
        }
        case 'details': openDetails(row.dataset.id); break;
        case 'del': {
          const id = row.dataset.id;
          if (!confirm('Delete this person?')) return;
          custom = custom.filter(p => p.id !== id); delete tips[id]; delete stats[id]; delete stories[id]; selected.delete(id);
          save(K.custom, custom); save(K.stories, stories); save(K.tips, tips); save(K.stats, stats); saveSelected(); renderAdd(); break;
        }
      }
    };
  }

  // ---------- boot ----------
  if (session && !L.isDone(session)) ui.tab = 'practice';
  go(ui.tab);
  if (!localStorage.getItem('nmg.seenHelp')) { localStorage.setItem('nmg.seenHelp', '1'); localStorage.setItem('nmg.seenPegs', '1'); openHelp(); }
  else if (!localStorage.getItem('nmg.seenPegs')) {
    localStorage.setItem('nmg.seenPegs', '1');
    openModal(`<h2>New: name pegs 🧷</h2>${METHOD_HTML}
      <p>Open the <b>Pegs</b> tab to learn and drill the pegs. Every person now has a <b>story</b> made from their name pegs and feature; you'll see it on the back of each card. Your tips, stats and people are all still here.</p>
      <button class="btn primary" style="width:100%" data-act="x">Show me the pegs</button>`);
    modalCard.onclick = (e) => { if (e.target.closest('[data-act=x]')) { closeModal(); go('pegs'); } };
  }
  window.__nmg = { go, startSession, get session() { return session; }, get stats() { return stats; }, get pegStats() { return pegStats; },
    get pegs() { return PEGS; }, get stories() { return stories; }, storyFor: id => storyFor(byId(id)), exportJSON: () => L.makeBackup({ tips, stats, custom, pegs: pegUser, pegStats, stories }) }; // for testing
})();
