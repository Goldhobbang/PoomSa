import test from 'node:test';
import assert from 'node:assert/strict';
import {EXAMPLES, POS, ROLES, SUBTYPES, CASE_TYPES, normalizeSentence, validateExamples} from '../data.mjs';

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


test('all particle and determiner subcategories have actual practice examples',()=>{
  const annotated=EXAMPLES.flatMap(q=>q.chunks.flatMap(c=>c.parts))
    .filter(p=>p.p==='조사'||p.p==='관형사');
  const seen=new Set(annotated.map(p=>p.detail[0]));
  for(const top of [...SUBTYPES.조사,...SUBTYPES.관형사]){
    assert.ok(seen.has(top),'missing subtype: '+top);
  }
  const cases=new Set(annotated.filter(p=>p.detail[0]==='격조사').map(p=>p.detail[1]));
  for(const type of CASE_TYPES)assert.ok(cases.has(type),'missing case: '+type);
});

test('same form can distinguish nominative and complement particle',()=>{
  const get=(id,token)=>EXAMPLES.find(q=>q.id===id).chunks
    .flatMap(c=>c.parts).find(p=>p.t===token&&p.p==='조사');
  assert.deepEqual(get('s01','가').detail,['격조사','주격 조사']);
  assert.deepEqual(get('s05','이').detail,['격조사','보격 조사']);
});

test('determiners distinguish adjective and numeral types',()=>{
  const get=(id,token)=>EXAMPLES.find(q=>q.id===id).chunks.flatMap(c=>c.parts).find(p=>p.t===token);
  assert.deepEqual(get('s12','새').detail,['성상 관형사']);
  assert.deepEqual(get('s06','그').detail,['지시 관형사']);
  assert.deepEqual(get('s16','두').detail,['수 관형사']);
});

test('a particle form can be an associative or adverbial case depending on usage',()=>{
  const q=EXAMPLES.find(q=>q.id==='s21');
  const part=q.chunks[0].parts.find(p=>p.t==='와');
  assert.deepEqual(part.detail,['접속 조사']);
  assert.equal(q.chunks[0].role,'주어');
});
