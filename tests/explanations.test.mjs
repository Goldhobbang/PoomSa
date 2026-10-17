import test from "node:test";
import assert from "node:assert/strict";
import {EXAMPLES,POS,ROLES} from "../data.mjs";
import {
 explainPartOfSpeech,explainSentenceRole,explainValency,
 explainRequired,explainMorphology,isCustomAnswer,normalizeMorph
} from "../explanations.mjs";

const example=id=>EXAMPLES.find(q=>q.id===id);
const findPart=(q,text)=>q.chunks.flatMap(c=>c.parts).find(p=>p.t===text);

test("sample and custom get same grammar criteria while custom provenance is explicit",()=>{
 const sample=example("s05");
 const part=findPart(sample,"이");
 const choice=["조사","격조사","주격 조사"];
 const sampleReason=explainPartOfSpeech(sample,part,choice);
 const custom={...sample,id:"custom-an-example"};
 const customReason=explainPartOfSpeech(custom,part,choice);
 assert.match(sampleReason.diagnosis,/주격 조사/);
 assert.match(sampleReason.principle,/보어|되다/);
 assert.match(sampleReason.check,/되다\/아니다/);
 assert.equal(customReason.principle,sampleReason.principle);
 assert.equal(customReason.diagnosis,sampleReason.diagnosis);
 assert.match(customReason.source,/자동 검증되지/);
 assert.equal(sampleReason.source,"");
});

test("part of speech explanations distinguish inflected adjectives from adverbs",()=>{
 const q=example("s13");
 const exp=explainPartOfSpeech(q,findPart(q,"빠르게"),["부사"]);
 assert.match(exp.check,/형용사/);
 assert.match(exp.principle,/용언/);
});

test("all known incorrect pos labels receive substantive explanations",()=>{
 for(const q of EXAMPLES){
  for(const p of q.chunks.flatMap(c=>c.parts)){
   for(const selected of POS.filter(x=>x!==p.p)){
    const exp=explainPartOfSpeech(q,p,[selected]);
    assert.ok(exp.diagnosis.length>12,q.id);
    assert.ok(exp.principle.length>12,q.id);
    assert.ok(exp.check.length>12,q.id);
   }
  }
 }
});

test("sentence roles explain likely confusions for all examples",()=>{
 for(const q of EXAMPLES)for(const c of q.chunks){
  const chosen=ROLES.find(x=>x!==c.role);
  const exp=explainSentenceRole(q,c,chosen);
  assert.ok(exp.diagnosis.includes(c.role));
  assert.ok(exp.check.length>15);
 }
});

test("valency and obligatory adverbials are explained by predicate and role",()=>{
 const q=example("s04");
 const valency=explainValency(q,"2");
 assert.match(valency.principle,/선생님께\(부사어\)/);
 assert.match(valency.check,/필수적 부사어/);
 const adverbial=q.chunks.find(c=>c.t==="선생님께");
 const required=explainRequired(q,adverbial,false);
 assert.match(required.diagnosis,/필수 성분/);
 const optional=example("s03");
 const degree=optional.chunks.find(c=>c.t==="매우");
 assert.match(explainRequired(optional,degree,true).principle,/수의적 성분/);
});

test("morpheme errors provide boundary-specific diagnoses",()=>{
 const q=example("s01");
 assert.match(explainMorphology(q,"").diagnosis,/입력하지 않았/);
 assert.match(explainMorphology(q,"철수가").diagnosis,/개로 나눴지만/);
 assert.match(explainMorphology(q,"철/수가").diagnosis,/경계 위치/);
 assert.match(explainMorphology(q,"철수/나").diagnosis,/원래 표현과 일치/);
 assert.equal(normalizeMorph(" 철수 / 가  "),"철수/가");
});

test("custom sentences without hand-written rationales still get usable explanations",()=>{
 const q={
   id:"custom-id",slots:2,
   chunks:[
     {t:"철수는",parts:[{t:"철수",p:"명사"},{t:"는",p:"조사",detail:["보조사"]}],role:"주어",needed:true},
     {t:"물을",parts:[{t:"물",p:"명사"},{t:"을",p:"조사",detail:["격조사","목적격 조사"]}],role:"목적어",needed:true},
     {t:"마셨다.",parts:[{t:"마셨다",p:"동사"}],role:"서술어",needed:false}
   ],
   morph:{word:"물을",answer:"물/을"}
 };
 assert.equal(isCustomAnswer(q),true);
 const exp=explainPartOfSpeech(q,q.chunks[1].parts[1],["명사"]);
 assert.match(exp.principle,/조사/);
 assert.match(exp.source,/사용자가 저장한 정답표/);
 const role=explainSentenceRole(q,q.chunks[1],"주어");
 assert.match(role.principle,/대상/);
 assert.match(explainMorphology(q,"물/으/ㄹ").source,/자동 검증되지/);
});
