// Adds feature, parts and story to people.js from tools/stories_src.txt. Run: node tools/build_people.js
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
global.window = {};
require(path.join(root, 'pegs.js')); eval(fs.readFileSync(path.join(root, 'people.js'), 'utf8'));
const L = require(path.join(root, 'logic.js'));
const idx = L.buildPegIndex(window.NMG_PEGS), byId = Object.fromEntries(window.NMG_PEGS.map(p => [p.id, p]));
const rows = fs.readFileSync(path.join(__dirname, 'stories_src.txt'), 'utf8').split('\n').filter(l => l.trim() && !l.startsWith('#')).map(l => l.split('|'));
const by = Object.fromEntries(rows.map(r => [r[0], r]));
let problems = 0;
const people = window.NMG_PEOPLE.map(p => {
  const r = by[p.id]; if (!r) { console.error('missing', p.id); problems++; return p; }
  const [, feature, spec, story] = r;
  let parts;
  if (spec === 'auto') parts = L.splitName(p.name, idx);
  else parts = spec.trim().split(/\s+(?=[^\s:]+:)/).map(tok => {
    const i = tok.indexOf(':'), text = tok.slice(0, i), v = tok.slice(i + 1);
    if (v.startsWith('=')) return { text, pegId: null, img: v.slice(1) };
    if (!byId[v]) { console.error('bad peg', p.id, v); problems++; }
    return { text, pegId: v };
  });
  parts.forEach(pt => { if (!pt.pegId && !pt.img) { console.error('unmatched part', p.id, pt.text); problems++; } });
  return Object.assign({}, p, { feature, parts, story });
});
fs.writeFileSync(path.join(root, 'people.js'), "// Built-in library. Photos: Wikipedia / Wikimedia Commons thumbnails (see each page for license).\n// Generated and verified on 2026-10-16. feature/parts/story added by tools/build_people.js.\nwindow.NMG_PEOPLE = " + JSON.stringify(people, null, 1) + ";\n");
for (const p of people) console.log(p.name.padEnd(26), p.parts.map(pt => pt.text + '→' + L.imgNoun(L.partImage(pt, byId))).join(' · '));
console.log(people.length, 'people,', problems, 'problems');
