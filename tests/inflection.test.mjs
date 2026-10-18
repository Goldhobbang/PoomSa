import test from 'node:test';
import assert from 'node:assert/strict';
import {createSentenceAnalyzer} from '../model.mjs';
import {facetAnswersFor,facetGroups,inflectionFor,validateFacets} from '../taxonomy.mjs';
import {morphemeForm,morphemeLabel} from '../morphology.mjs';
import {explainFacet,normalizeMorph} from '../explanations.mjs';
import raw from './garu-reported-fixtures.json' with {type:'json'};
import {reportedCases} from './reported-cases.mjs';

const offline=()=>createSentenceAnalyzer(async()=>{throw Error('offline fixture');});
test('reported sentence uses observed inflections in model and fallback with every spacing variant',async()=>{
 for(const model of [true,false]){
  const analyze=model?createSentenceAnalyzer(async()=>({analyze(input){return {tokens:raw.records.find(r=>r.input===input)?.tokens||[]};}})):offline();
  for(const input of [reportedCases[0].input,...reportedCases[0].variants]){
   const q=await analyze(input),verbs=q.chunks.flatMap(c=>c.parts).filter(p=>p.inflection);
   assert.deepEqual(verbs.map(p=>[p.t,p.facets.conjugation,p.facets.regularKind,p.facets.irregularKind]),[
    ['아는','규칙 활용','ㄹ 탈락',undefined],['말하고','규칙 활용','일반 규칙',undefined],
    ['가야','규칙 활용','동일 모음 탈락',undefined],['한다','규칙 활용','일반 규칙',undefined]],input);
   for(const p of verbs){
    assert.ok(validateFacets(p));
    assert.ok(!JSON.stringify(p).includes('여 불규칙'),p.t);
    assert.match(facetGroups(p.p,p.facets,p).find(g=>g.id==='conjugation').label,/이 문장의 활용/);
   }
   const auxiliary=verbs.at(-1);
   assert.match(auxiliary.why,/필요·의무.*보조 동사/);
   assert.equal(morphemeLabel(auxiliary.morphemes[0]),'보조 동사 어간');
   assert.deepEqual(verbs.find(p=>p.t==='가야').morphemes.map(morphemeForm),['가-','-아야']);
  }
 }
});

test('the same lemma only gets a change label on the forms that exhibit it',async()=>{
 const analyze=offline();
 const cases=[
  ['말하고.','일반 규칙'],['말한다.','일반 규칙'],['말하면.','일반 규칙'],['한다.','일반 규칙'],
  ['말해.','여 불규칙'],['말하여.','여 불규칙'],['말했다.','여 불규칙'],['해야.','여 불규칙'],
  ['알고.','일반 규칙'],['아는.','ㄹ 탈락'],['안다.','ㄹ 탈락'],
  ['쓰는.','일반 규칙'],['써.','ㅡ 탈락'],['모르고.','일반 규칙'],['몰라.','르 불규칙'],
  ['듣는다.','일반 규칙'],['들어.','ㄷ 불규칙'],['돕는다.','일반 규칙'],['도와.','ㅂ 불규칙'],
  ['가야.','동일 모음 탈락'],['봐.','모음 축약']
 ];
 for(const [input,kind] of cases){
  const p=(await analyze(input)).chunks[0].parts[0];
  assert.ok(p.inflection,input);
  assert.equal(p.facets.regularKind||p.facets.irregularKind,kind,input);
  assert.ok(validateFacets(p),input);
 }
});

test('surface evidence wins over stale lexical facets and explains the current ending',async()=>{
 const q=await offline()('말하고.'),p=q.chunks[0].parts[0];
 p.facets={conjugation:'불규칙 활용',irregularKind:'여 불규칙',verbArguments:'타동사'};
 assert.deepEqual(facetAnswersFor(p),{conjugation:'규칙 활용',regularKind:'일반 규칙',verbArguments:'타동사'});
 const g=facetGroups(p.p,facetAnswersFor(p),p).find(g=>g.id==='conjugation');
 const explanation=explainFacet(q,p,g,'불규칙 활용','규칙 활용');
 assert.match(explanation.principle,/말하- \+ -고/);
 assert.ok(!explanation.principle.includes('여 불규칙'));
 assert.match(explanation.check,/모든 활용형/);
});

test('plain model tags can establish an observed change without a restoration rule string',()=>{
 const f=(surface,root,end)=>inflectionFor(surface,root,[{text:root,pos:'VV'},{text:end,pos:'EC'}]);
 assert.equal(f('들어','듣','어').irregularKind,'ㄷ 불규칙');
 assert.equal(f('듣고','듣','고').regularKind,'일반 규칙');
 assert.equal(f('말하여','말하','여').irregularKind,'여 불규칙');
 assert.equal(f('말하고','말하','고').regularKind,'일반 규칙');
 assert.equal(f('살고','살','고').regularKind,'일반 규칙');
});

test('every token in the reported sentence has a readable Korean label',async()=>{
 const q=await offline()(reportedCases[0].input);
 assert.deepEqual(q.morphology.flatMap(w=>w.tokens.map(t=>[morphemeForm(t),morphemeLabel(t)])),[
  ['너','대명사'],['만큼','보조사'],['은','보조사'],['알-','동사 어간'],['-는','관형사형 어미'],
  ['대로','의존 명사'],['말하-','동사 어간'],['-고','연결 어미'],['친구','보통 명사'],['와','부사격 조사'],
  ['같이','부사'],['가-','동사 어간'],['-아야','연결 어미'],['하-','보조 동사 어간'],['-ㄴ다','종결 어미']]);
});

test('boundary notation in explanations can be used in morphology answers without dropping 야',()=>{
 assert.equal(normalizeMorph('알- + -는'),'알/는');
 assert.equal(normalizeMorph('하- / -였- / -다'),'하/였/다');
 assert.equal(normalizeMorph('가- + -아야'),'가/아야');
 assert.notEqual(normalizeMorph('가- + -아'),normalizeMorph('가/아야'));
});
