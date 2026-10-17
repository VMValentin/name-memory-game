/* Name Memory – flashcard game for remembering names and faces. Vanilla JS, no build step. */
(function () {
  'use strict';
  const L = window.NMGLogic;
  const $ = (sel, el) => (el || document).querySelector(sel);
  const view = $('#view');

  // ---------- storage ----------
  const K = { tips: 'nmg.tips', stats: 'nmg.stats', custom: 'nmg.custom', selected: 'nmg.selected', session: 'nmg.session', imgs: 'nmg.imgfix' };
  function load(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { toast('Could not save (storage full?)'); } }

  let tips = load(K.tips, {});
  let stats = load(K.stats, {});
  let custom = load(K.custom, []);
  let selected = new Set(load(K.selected, []));
  let session = load(K.session, null);
  let imgFix = load(K.imgs, {});

  const ui = { tab: 'browse', cat: 'All', q: '', flipped: false, libSort: 'forgot', libSel: new Set() };

  function allPeople() { return window.NMG_PEOPLE.concat(custom); }
  function byId(id) { return allPeople().find(p => p.id === id); }
  function categories() {
    const seen = [];
    allPeople().forEach(p => { if (!seen.includes(p.category)) seen.push(p.category); });
    return seen;
  }
  function tipFor(p) { return tips[p.id] != null ? tips[p.id] : (p.tip || ''); }
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
      <li><b>Picture it:</b> link the sound of the name to an exaggerated feature (use the tip below or make your own).</li>
      <li><b>Say it out loud</b> while picturing that image.</li></ol>`;

  // ---------- modal ----------
  const modal = $('#modal'), modalCard = $('#modalCard');
  function openModal(html) { modalCard.innerHTML = html; modal.classList.remove('hidden'); modalCard.scrollTop = 0; }
  function closeModal() { modal.classList.add('hidden'); modalCard.innerHTML = ''; }
  modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });

  function openDetails(id, after) {
    const p = byId(id); if (!p) return;
    const st = stats[id];
    openModal(`
      ${photo(p, 'big')}
      <h2>${esc(p.name)}</h2>
      <div class="muted">${esc(p.desc || p.category)}</div>
      <div class="row" style="margin-top:10px">
        <button class="btn small" data-act="hear">🔊 Hear the name</button>
        ${p.wiki ? `<a class="btn small ghost" style="text-decoration:none" target="_blank" rel="noopener" href="https://en.wikipedia.org/wiki/${encodeURIComponent(p.wiki)}">Wikipedia ↗</a>` : ''}
      </div>
      ${STEPS_HTML(p.name)}
      <label for="tipEdit">Your memory image (edit or write your own)</label>
      <textarea id="tipEdit">${esc(tipFor(p))}</textarea>
      <div class="row" style="margin-top:10px">
        <button class="btn primary" data-act="save">Save tip</button>
        ${p.tip ? '<button class="btn ghost" data-act="reset">Use suggested tip</button>' : ''}
        <button class="btn ghost" data-act="close">Close</button>
      </div>
      ${st ? `<p class="muted">Seen ${st.seen}× · remembered ${st.remembered}× · forgot ${st.forgot}× · last practiced ${fmtDate(st.last)}</p>` : ''}`);
    modalCard.onclick = (e) => {
      const act = e.target.closest('[data-act]'); if (!act) return;
      const a = act.dataset.act;
      if (a === 'hear') speak(p.name);
      if (a === 'close') closeModal();
      if (a === 'reset') { $('#tipEdit').value = p.tip; delete tips[p.id]; save(K.tips, tips); toast('Restored suggested tip'); render(); }
      if (a === 'save') {
        const v = $('#tipEdit').value.trim();
        if (v && v !== p.tip) tips[p.id] = v; else delete tips[p.id];
        save(K.tips, tips); toast('Tip saved'); closeModal(); render(); if (after) after();
      }
    };
  }

  function openHelp() {
    openModal(`<h2>How to remember names</h2>
      ${STEPS_HTML('the name')}
      <h3>Using the game</h3>
      <p><b>Pick:</b> filter by category, tap photos to select them (or “Select all”). Tap <i>Tip &amp; details</i> to read or edit the memory image.</p>
      <p><b>Practice:</b> look at the face and try to recall the name. Tap the card to flip it, say the name out loud, then tap <b>Remembered</b> or <b>Forgot</b>. Remembered cards leave the session; forgotten ones come back until the deck is empty.</p>
      <p><b>Library:</b> every name you've practiced, with stats. Review all of them, the ones you forget most, or ones you haven't seen in a while.</p>
      <p><b>Add:</b> add your own people (coworkers, neighbors…) with a photo URL and your own tip.</p>
      <p class="muted">Progress is saved on this device. Use Library → Export to move it to another device. On iPhone/iPad: Share → “Add to Home Screen” to use it like an app.</p>
      <button class="btn primary" style="width:100%" onclick="document.getElementById('modal').classList.add('hidden')">Got it</button>`);
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
    ({ browse: renderBrowse, practice: renderPractice, library: renderLibrary, add: renderAdd })[ui.tab]();
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
            <div class="body"><div class="nm">${esc(p.name)}</div><div class="tip">${esc(tipFor(p))}</div></div>
          </button>
          <span class="check">✓</span>
          <button class="more" data-act="details">Tip &amp; details</button>
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

  // ---------- practice ----------
  function startSession(ids, label) {
    ids = ids.filter(id => byId(id));
    if (!ids.length) { toast('Nothing to practice yet'); return; }
    session = L.createSession(ids); session.label = label || 'Practice'; session.started = Date.now();
    ui.flipped = false; saveSession(); go('practice');
  }
  function renderPractice() {
    if (!session) return renderPracticeStart();
    if (L.isDone(session)) return renderSummary();
    const p = byId(L.current(session));
    if (!p) { L.answer(session, true); saveSession(); return renderPractice(); }
    const pr = L.progress(session);
    view.innerHTML = `
      <div class="row" style="justify-content:space-between;margin:0">
        <b>${esc(session.label)}</b><span class="muted">✅ ${pr.done} of ${pr.total} · ${pr.left} left</span>
      </div>
      <div class="progress"><div style="width:${pr.pct}%"></div></div>
      <div class="stage"><div class="flash ${ui.flipped ? 'flipped' : ''}" id="flash" role="button" aria-label="Flip card">
        <div class="face front">${photo(p, '')}<div class="hint">Who is this? Recall the name, then <b>tap to flip</b>.</div></div>
        <div class="face back">
          <div class="bname">${esc(p.name)}</div>
          <div class="bdesc">${esc(p.desc || p.category)}</div>
          <div class="btip">💡 ${esc(tipFor(p)) || '<i>No tip yet — tap Edit tip to write one.</i>'}</div>
          <div class="say">🗣️ Say it out loud: “${esc(p.name)}” — while picturing the image.</div>
          <div class="row" style="justify-content:center;margin-top:12px">
            <button class="btn small" data-act="hear">🔊 Hear it</button>
            <button class="btn small ghost" data-act="edit">✏️ Edit tip</button>
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
        if (a === 'hear') speak(p.name);
        if (a === 'edit') openDetails(p.id);
        if (a === 'remembered' || a === 'forgot') answerCard(p.id, a === 'remembered');
        if (a === 'end') { if (confirm('End this session?')) { session = null; saveSession(); render(); } }
        return;
      }
      if (e.target.closest('#flash')) {
        ui.flipped = !ui.flipped;
        $('#flash').classList.toggle('flipped', ui.flipped);
        $('#answer').style.visibility = ui.flipped ? 'visible' : 'hidden';
      }
    };
  }
  function answerCard(id, remembered) {
    L.recordStat(stats, id, remembered); save(K.stats, stats);
    L.answer(session, remembered); saveSession();
    ui.flipped = false; render();
  }
  function renderSummary() {
    const tricky = Object.keys(session.forgotCounts);
    const firstTry = session.total - tricky.length;
    view.innerHTML = `<div class="empty">
        <div style="font-size:56px">🎉</div><h2>Deck complete!</h2>
        <p>${session.total} names · ${firstTry} on the first try · ${session.attempts} total flips</p>
        ${tricky.length ? `<p class="muted">Tricky ones: ${tricky.map(id => esc((byId(id) || {}).name)).join(', ')}</p>` : '<p>Perfect round!</p>'}
        <div class="row" style="justify-content:center">
          ${tricky.length ? '<button class="btn primary" data-act="tricky">Practice the tricky ones</button>' : ''}
          <button class="btn" data-act="again">Run all again</button>
          <button class="btn ghost" data-act="lib">Go to Library</button>
        </div></div>`;
    const all = session.remembered.slice();
    view.onclick = (e) => {
      const a = e.target.closest('[data-act]'); if (!a) return;
      if (a.dataset.act === 'tricky') startSession(tricky, 'Tricky ones');
      if (a.dataset.act === 'again') startSession(all, session.label);
      if (a.dataset.act === 'lib') { session = null; saveSession(); go('library'); }
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
      </div>
      <div class="empty" style="margin-top:16px;text-align:left"><b>Remember the 4 steps</b>${STEPS_HTML('the name')}</div>`;
    view.onclick = (e) => {
      const a = e.target.closest('[data-act]'); if (!a || a.disabled) return;
      if (a.dataset.act === 'sel') startSession(Array.from(selected), 'Selected');
      if (a.dataset.act === 'pick') go('browse');
      if (a.dataset.act === 'worst') startSession(worst, 'Most forgotten');
      if (a.dataset.act === 'old') startSession(practiced, 'All old names');
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
      <p class="muted">Progress lives on this device. Export it to copy your tips, custom people, and stats to another device.</p>
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
    const data = JSON.stringify({ app: 'name-memory-game', v: 1, tips, stats, custom }, null, 1);
    const blob = new Blob([data], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'name-memory-backup.json';
    document.body.appendChild(a); a.click(); a.remove();
  }
  function importData(e) {
    const f = e.target.files[0]; if (!f) return;
    f.text().then(t => {
      const d = JSON.parse(t);
      if (d.app !== 'name-memory-game') throw new Error('bad file');
      tips = Object.assign(tips, d.tips || {});
      stats = Object.assign(stats, d.stats || {});
      const ids = new Set(custom.map(p => p.id));
      (d.custom || []).forEach(p => { if (!ids.has(p.id)) custom.push(p); });
      save(K.tips, tips); save(K.stats, stats); save(K.custom, custom);
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
      <label for="cTip">Memory tip</label><textarea id="cTip" placeholder="Exaggerated feature + something that sounds like the name"></textarea>
      <div class="row" style="margin-top:8px"><button class="btn small ghost" data-act="suggest">💡 Suggest a tip</button></div>
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
        case 'suggest': if (!name) return toast('Enter a name first'); $('#cTip').value = L.suggestTip(name); break;
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
          const t = $('#cTip').value.trim(); if (t) tips[id] = t;
          custom.push(p); save(K.custom, custom); save(K.tips, tips);
          selected.add(id); saveSelected();
          toast(name + ' added and selected'); renderAdd(); break;
        }
        case 'details': openDetails(row.dataset.id); break;
        case 'del': {
          const id = row.dataset.id;
          if (!confirm('Delete this person?')) return;
          custom = custom.filter(p => p.id !== id); delete tips[id]; delete stats[id]; selected.delete(id);
          save(K.custom, custom); save(K.tips, tips); save(K.stats, stats); saveSelected(); renderAdd(); break;
        }
      }
    };
  }

  // ---------- boot ----------
  if (session && !L.isDone(session)) ui.tab = 'practice';
  go(ui.tab);
  if (!localStorage.getItem('nmg.seenHelp')) { localStorage.setItem('nmg.seenHelp', '1'); openHelp(); }
  window.__nmg = { go, startSession, get session() { return session; }, get stats() { return stats; } }; // for testing
})();
