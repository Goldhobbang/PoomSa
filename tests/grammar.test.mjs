import test from 'node:test';
import assert from 'node:assert/strict';
import {EXAMPLES, POS, ROLES, normalizeSentence, validateExamples} from '../data.mjs';

test('question bank has no broken labels or argument counts', () => {
  assert.deepEqual(validateExamples(), []);
  assert.ok(EXAMPLES.length >= 15);
});

test('all nine school-grammar parts of speech are practiced', () => {
  const seen = new Set(EXAMPLES.flatMap(x => x.chunks.flatMap(c => c.parts.map(p => p.p))));
  for (const p of POS) assert.ok(seen.has(p), 'missing '+p);
});

test('morpheme exercise segmentation matches printed surface forms', () => {
  for (const q of EXAMPLES) {
    const actual = q.morph.answer.replace(/[\/\s]/g, '');
    const surface = q.morph.word.replace(/\s/g, '');
    assert.equal(actual, surface, q.id);
  }
});

test('no repeated questions, one predicate and valid roles', () => {
  const seen = new Set();
  for (const q of EXAMPLES) {
    const normalized=normalizeSentence(q.chunks.map(c=>c.t).join(" "));
    assert.ok(!seen.has(normalized), 'duplicate sentence: '+normalized);
    seen.add(normalized);
    assert.equal(q.chunks.filter(c=>c.role==='서술어').length, 1, q.id);
    for (const c of q.chunks) assert.ok(ROLES.includes(c.role));
  }
});

test('word class differs from sentence role where relevant', () => {
  const sentence=EXAMPLES.find(q=>q.id==='s13');
  const unit=sentence.chunks.find(c=>c.t==='빠르게');
  assert.equal(unit.parts[0].p, '형용사');
  assert.equal(unit.role, '부사어');
});

test('predicate valency distinguishes obligatory adverbials', () => {
  const sentence=EXAMPLES.find(q=>q.id==='s04');
  assert.equal(sentence.slots,3);
  const unit=sentence.chunks.find(c=>c.t==='선생님께');
  assert.equal(unit.role,'부사어');
  assert.equal(unit.needed,true);
});
