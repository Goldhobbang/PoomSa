import test from 'node:test';
import assert from 'node:assert/strict';
import cases from './context-cases.json' with {type:'json'};
import {createSentenceAnalyzer} from '../model.mjs';
import {facetGroups,validateFacets} from '../taxonomy.mjs';

test('24 context fixtures retain correct roles, stems and valency without holds when WASM is unavailable',async()=>{
 const analyze=createSentenceAnalyzer(async()=>{throw Error('offline fixture');});
 for(const f of cases){
  const q=await analyze(f.input);
  assert.deepEqual(q.chunks.map(c=>c.role),f.roles,f.input);
  assert.equal(q.slots,f.slots,f.input);
  assert.equal(q.slotsGradeable,true,f.input);
  assert.equal(q.morph.gradeable,true,f.input);
  assert.ok(q.morph.answer,f.input);
  if(f.analyses)assert.deepEqual(q.morphology.map(w=>w.analysis),f.analyses,f.input);
  if(f.implicit!==undefined)assert.equal(q.implicitArguments,f.implicit,f.input);
  for(const c of q.chunks){
   assert.equal(c.gradeable,true,f.input+' '+c.t);
   for(const p of c.parts){
    assert.equal(p.gradeable,true,f.input+' '+p.t);
    assert.ok(validateFacets(p,p.facets),p.t);
    for(const g of facetGroups(p.p,p.facets))assert.ok(p.facets[g.id],f.input+' '+p.t+' '+g.id);
   }
  }
 }
});

test('an unknown model verb uses its clause object and productive conjugation rather than an empty answer',async()=>{
 const sentence='나는 소설을 탐독했다.';
 const analyze=createSentenceAnalyzer(async()=>({analyze(){return {tokens:[
  {text:'나',pos:'NP',start:0,end:2},{text:'는',pos:'JX',start:0,end:2},
  {text:'소설',pos:'NNG',start:3,end:6},{text:'을',pos:'JKO',start:3,end:6},
  {text:'탐독',pos:'NNG',start:7,end:12},{text:'하',pos:'XSV',start:7,end:12},
  {text:'었',pos:'EP',start:7,end:12},{text:'다',pos:'EF',start:7,end:12}
 ]};}}));
 const q=await analyze(sentence),verb=q.chunks.at(-1).parts[0];
 assert.equal(verb.p,'동사');assert.equal(verb.lemma,'탐독하다');
 assert.equal(verb.facets.verbArguments,'타동사');
 assert.equal(verb.facets.irregularKind,'여 불규칙');
 assert.equal(q.slots,2);assert.equal(q.slotsGradeable,true);
});
