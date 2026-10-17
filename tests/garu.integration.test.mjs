import test from "node:test";
import assert from "node:assert/strict";
import {Garu} from "garu-ko/node";
import {inferSchoolAnalysis} from "../auto-analyzer.mjs";
import {createSentenceAnalyzer} from "../model.mjs";
import cases from './context-cases.json' with {type:'json'};
import {facetGroups} from '../taxonomy.mjs';

test("bundled Garu model loads and produces usable real morphology", async()=>{
 const garu=await Garu.load();
 try{
  for(const sentence of ["철수가 밥을 먹는다.","철수가 학생이 되었다.","철수가 영희에게 책을 주었다.","두 사람이 웃는다."]){
   const result=garu.analyze(sentence);
   assert.ok(result.tokens?.length>0,sentence);
   const q=inferSchoolAnalysis(sentence,result.tokens,{id:"auto-integration"});
   console.log("AUTO ANALYSIS",JSON.stringify({
     input:sentence,
     tags:result.tokens.map(t=>t.text+"/"+t.pos),
     units:q.chunks.map(c=>({word:c.t,role:c.role,gradeable:c.gradeable,parts:c.parts.map(p=>({t:p.t,p:p.p,detail:p.detail}))})),
     valency:q.slots,slotsGradeable:q.slotsGradeable,
     morphology:q.morph.answer
   }));
   assert.ok(q.chunks.length>=2,sentence);
   assert.ok(q.chunks.some(c=>c.role==="서술어"),sentence);
  }
  const analyze=createSentenceAnalyzer(async()=>garu);
  const q=await analyze("썸네일만 보아도 소리지르는 거구만.");
  assert.equal(q.modelWarning,"");
  assert.equal(q.preprocessing.sentence,"썸네일만 보아도 소리지르는 거구먼.");
  assert.deepEqual(q.morphology.map(w=>w.analysis),["썸네일/만","보/아도","소리지르/는","것/이/구먼"]);
  assert.equal(q.chunks.at(-1).parts.at(-1).detail.at(-1),"서술격 조사");
  const restored=await analyze("써도 몰라.");
  assert.deepEqual(restored.morphology.map(w=>w.analysis),["쓰/어도","모르/아"]);
  for(const f of cases){
   const q=await analyze(f.input);
   console.log('CONTEXT CHECK',JSON.stringify({input:f.input,roles:q.chunks.map(c=>c.role),slots:q.slots}));
   assert.deepEqual(q.chunks.map(c=>c.role),f.roles,f.input);
   assert.equal(q.slots,f.slots,f.input);
   assert.equal(q.slotsGradeable,true,f.input);assert.equal(q.morph.gradeable,true,f.input);
   for(const c of q.chunks){assert.equal(c.gradeable,true,f.input);
    for(const p of c.parts){assert.equal(p.gradeable,true,f.input);
     for(const g of facetGroups(p.p,p.facets))assert.ok(p.facets[g.id],f.input+' '+p.t+' '+g.id);
    }
   }
  }
 }finally{garu.destroy();}
});

