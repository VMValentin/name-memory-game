const assert = require('assert');
const L = require('../logic.js');
let s = L.createSession(['a','b','c','a'], { noShuffle: true });
assert.strictEqual(s.total, 3);
assert.strictEqual(L.current(s), 'a');
L.answer(s, false);               // forgot a -> back of deck
assert.deepStrictEqual(s.deck, ['b','c','a']);
L.answer(s, true);                // remembered b
L.answer(s, true);                // remembered c
assert.strictEqual(L.current(s), 'a');
assert.strictEqual(L.progress(s).done, 2);
L.answer(s, false); L.answer(s, true);
assert.ok(L.isDone(s));
assert.strictEqual(L.progress(s).pct, 100);
assert.strictEqual(s.attempts, 5);
assert.strictEqual(s.forgotCounts.a, 2);
L.answer(s, true); assert.strictEqual(s.attempts, 5); // no-op when done
// shuffle keeps elements
const sh = L.shuffle([1,2,3,4,5]); assert.deepStrictEqual(sh.slice().sort(), [1,2,3,4,5]);
// stats
let st = {};
L.recordStat(st, 'x', false, 1000); L.recordStat(st, 'x', true, 2000);
L.recordStat(st, 'y', false, 3000); L.recordStat(st, 'z', true, 3000);
assert.deepStrictEqual(st.x, { seen: 2, remembered: 1, forgot: 1, last: 2000 });
assert.deepStrictEqual(L.mostForgotten(st), ['y','x']);
assert.deepStrictEqual(L.mostForgotten(st, 1), ['y']);
assert.deepStrictEqual(L.staleIds(st, 1, 2000 + 2*864e5).sort(), ['x','y','z']);
assert.deepStrictEqual(L.staleIds(st, 1, 3001), []);
assert.ok(L.suggestTip('Jane Doe').includes('"Doe"'));
assert.strictEqual(L.suggestTip(''), '');
// empty session
const e = L.createSession([]); assert.ok(L.isDone(e)); assert.strictEqual(L.progress(e).pct, 100);
console.log('logic tests passed');
