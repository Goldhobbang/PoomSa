import assert from 'node:assert/strict';
import {facetGroups} from '../taxonomy.mjs';
export const reportedCases=[
 {input:'너만큼은 아는 대로 말하고 친구와 같이 가야 한다.',
  analyses:['너/만큼/은','알/는','대로','말하/고','친구/와','같이','가/아야','하/ㄴ다'],
  tags:[['NP','JX','JX'],['VV','ETM'],['NNB'],['VV','EC'],['NNG','JKB'],['MAG'],['VV','EC'],['VX','EF']],
  roles:['주어','관형어','부사어','부사어','부사어','부사어','서술어','서술어'],slots:1,
  variants:['너만큼은아는대로말하고친구와같이가야한다.','너만큼은아는 대로말하고 친구와같이가야한다.']},
 {input:'첫째 딸이 사과 한 개를 다른 사람에게 주었다.',
  analyses:['첫째','딸/이','사과','한','개/를','다른','사람/에게','주/었/다'],
  tags:[['MM'],['NNG','JKS'],['NNG'],['MM'],['NNB','JKO'],['MM'],['NNG','JKB'],['VV','EP','EF']],
  roles:['관형어','주어','목적어','관형어','목적어','관형어','부사어','서술어'],slots:3,
  variants:['첫째딸이사과한개를다른사람에게주었다.','첫째딸이 사과한 개를 다른사람에게주었다.','**첫째 딸이 사과 한 개를 다른 사람에게 주었다.**  ']}
];
export function verifyQuestion(q,f,input){
 assert.deepEqual(q.morphology.map(w=>w.analysis),f.analyses,input);
 assert.deepEqual(q.morphology.map(w=>w.tokens.map(t=>t.pos)),f.tags,input);
 assert.deepEqual(q.chunks.map(c=>c.role),f.roles,input);
 assert.equal(q.slots,f.slots,input);assert.equal(q.slotsGradeable,true,input);
 assert.equal(q.implicitArguments,0,input);
 assert.equal(q.preprocessing.original,input);
 for(const c of q.chunks){
  assert.equal(c.gradeable,true,input+' '+c.t);
  for(const p of c.parts){
   assert.equal(p.gradeable,true,input+' '+p.t);
   for(const g of facetGroups(p.p,p.facets))assert.ok(p.facets[g.id],input+' '+p.t+' '+g.id);
  }
 }
 const units=q.chunks.flatMap(c=>c.parts);
 if(input.includes('첫째')){
  assert.deepEqual(units.filter(p=>['첫째','한'].includes(p.t)).map(p=>p.detail),[['수 관형사'],['수 관형사']]);
  assert.equal(units.find(p=>p.t==='개').facets.nounIndependence,'의존 명사');
  assert.deepEqual(units.find(p=>p.t==='다른').detail,['성상 관형사']);
 }else{
  assert.equal(units.find(p=>p.t==='대로').facets.nounIndependence,'의존 명사');
  assert.equal(units.find(p=>p.t==='같이').p,'부사');
  assert.deepEqual(units.find(p=>p.t==='와').detail,['격조사','부사격 조사']);
  assert.deepEqual(units.find(p=>p.t==='만큼').alternativeDetails,[['격조사','부사격 조사']]);
 }
}
