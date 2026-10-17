const assert = require('assert');
global.window = {};
require('../pegs.js'); require('../people.js');
const L = require('../logic.js');
const PEGS = window.NMG_PEGS, PEOPLE = window.NMG_PEOPLE;

// peg data sanity
assert.ok(PEGS.length >= 150, 'need 150+ pegs, got ' + PEGS.length);
const ids = new Set(PEGS.map(p => p.id)); assert.strictEqual(ids.size, PEGS.length, 'peg ids unique');
PEGS.forEach(p => { assert.ok(p.label && p.imgs.length >= 1 && p.imgs.length <= 3, 'peg ' + p.id); assert.ok(['name', 'sound'].includes(p.kind)); });
const idx = L.buildPegIndex(PEGS);
const byId = Object.fromEntries(PEGS.map(p => [p.id, p]));
// examples from the brief
const img = k => L.pegPrimary(byId[idx[k]]);
assert.match(img('mike'), /microphone/); assert.match(img('bill'), /duck bill/); assert.match(img('rose'), /rose/);
assert.match(img('al'), /owl/); assert.match(img('son'), /sun/); assert.match(img('mc'), /Big Mac/);
assert.match(img('stein'), /stein/); assert.match(img('berg'), /iceberg/);

// splitting
const names = s => L.splitName(s, idx).map(p => p.text + ':' + (p.pegId || '?')).join(' ');
assert.strictEqual(names('Albert Einstein'), 'Al:al bert:bert Ein:ein stein:stein');
assert.strictEqual(names('Mike Johnson'), 'Mike:mike John:john son:son');
assert.strictEqual(names('Pelé'), 'Pelé:pail');
assert.strictEqual(names('Bill McDonald').split(' ')[1], 'Mc:mc');
assert.deepStrictEqual(L.splitName('Joan of Arc', idx).map(p => p.text), ['Joan', 'Arc']);   // "of" skipped
assert.deepStrictEqual(L.splitName('Marie Curie', idx).map(p => p.text), ['Marie', 'Curie']); // leftover "ie" folded
assert.deepStrictEqual(L.splitName('', idx), []);
const zz = L.splitName('Zzyzx', idx); assert.strictEqual(zz.length, 1); assert.strictEqual(zz[0].pegId, null);
// manual parts
assert.deepStrictEqual(L.parseParts('Al | bert  Ein|stein', idx).map(p => p.pegId), ['al', 'bert', 'ein', 'stein']);
assert.strictEqual(L.parseParts('Qx', idx)[0].pegId, null);
assert.strictEqual(L.partsToString([{ text: 'Al' }, { text: 'bert' }]), 'Al | bert');

// user edits: change primary, edit images, add custom
const user = { edits: { mike: { label: 'Mike', kind: 'name', keys: ['mike'], imgs: ['🎤 microphone', '🚲 bike'], primary: 1 } },
               custom: [{ id: 'u-victor', label: 'Victor', kind: 'name', keys: ['victor'], imgs: ['🏆 trophy'] }] };
const merged = L.mergePegs(PEGS, user);
assert.strictEqual(merged.length, PEGS.length + 1);
const mb = Object.fromEntries(merged.map(p => [p.id, p]));
assert.strictEqual(L.pegPrimary(mb.mike), '🚲 bike'); assert.ok(mb.mike.edited);
const idx2 = L.buildPegIndex(merged);
assert.strictEqual(idx2.victor, 'vic', 'built-in pegs win over custom on key clash');
assert.strictEqual(idx2.michael, undefined, 'edited keys replace built-in keys');
assert.strictEqual(L.pegPrimary({ imgs: ['a', 'b'], primary: 9 }), 'b');
assert.strictEqual(L.pegPrimary({ imgs: [] }), '');
// part images: custom image beats peg
assert.strictEqual(L.partImage({ text: 'Mike', pegId: 'mike' }, mb), '🚲 bike');
assert.strictEqual(L.partImage({ text: 'Mike', pegId: 'mike', img: '🍋 lemon' }, mb), '🍋 lemon');
assert.strictEqual(L.imgNoun('🎤 microphone'), 'microphone');
assert.strictEqual(L.imgNoun('🧑‍🍳 chef'), 'chef');

// story generator
const st = L.generateStory('Albert Einstein', ['🦉 owl', '🍺 beer stein'], 'Wild white hair.');
assert.ok(st.includes('wild white hair') && st.includes('an owl') && st.includes('a beer stein') && st.includes('“Albert Einstein”'), st);
assert.ok(L.generateStory('X', [], '').includes('“X”'));
assert.ok(L.generateStory('X', ['🐟 fish'], 'big ears').includes('giant fish'));

// built-in people: every one has feature, parts with images, and a story
assert.strictEqual(PEOPLE.length, 72);
PEOPLE.forEach(p => {
  assert.ok(p.feature && p.story && p.story.length > 40, 'story for ' + p.id);
  assert.ok(p.parts.length >= 1, 'parts ' + p.id);
  p.parts.forEach(pt => assert.ok(L.partImage(pt, byId), 'image for part ' + pt.text + ' of ' + p.id));
  p.parts.forEach(pt => assert.ok(!pt.pegId || byId[pt.pegId], 'peg exists ' + pt.pegId));
});

// migration from v1 data
const m = L.migrate({ session: { total: 2, deck: ['a'], remembered: ['b'], attempts: 1, forgotCounts: {} } });
assert.strictEqual(m.version, 2); assert.strictEqual(m.session.kind, 'person');
assert.deepStrictEqual(m.pegs, { edits: {}, custom: [] }); assert.deepStrictEqual(m.pegStats, {}); assert.deepStrictEqual(m.stories, {});
const m2 = L.migrate({ version: 2, session: null, pegs: user, pegStats: { a: 1 }, stories: { x: 1 } });
assert.strictEqual(m2.pegs, user); assert.deepStrictEqual(m2.pegStats, { a: 1 });
assert.strictEqual(L.migrate({ version: 1, session: null }).session, null);

// backups: v2 roundtrip and v1 import
const cur = { tips: { a: 't' }, stats: {}, custom: [{ id: 'c-1', name: 'One' }], pegs: { edits: {}, custom: [] }, pegStats: {}, stories: {} };
const b2 = L.makeBackup({ tips: {}, stats: { x: { seen: 1 } }, custom: [{ id: 'c-2', name: 'Two' }], pegs: user, pegStats: { mike: { seen: 3 } }, stories: { 'c-2': { story: 's' } } });
assert.strictEqual(b2.v, 2);
const r = L.mergeBackup(cur, JSON.parse(JSON.stringify(b2)));
assert.deepStrictEqual(r.custom.map(c => c.id), ['c-1', 'c-2']);
assert.strictEqual(r.pegs.custom[0].id, 'u-victor'); assert.strictEqual(r.pegs.edits.mike.primary, 1);
assert.strictEqual(r.pegStats.mike.seen, 3); assert.strictEqual(r.stories['c-2'].story, 's'); assert.strictEqual(r.tips.a, 't');
const r1 = L.mergeBackup(cur, { app: 'name-memory-game', v: 1, tips: { b: 'u' }, stats: {}, custom: [] });
assert.strictEqual(r1.tips.b, 'u'); assert.deepStrictEqual(r1.pegs, { edits: {}, custom: [] });
assert.throws(() => L.mergeBackup(cur, { foo: 1 }));
console.log('peg tests passed (' + PEGS.length + ' pegs)');
