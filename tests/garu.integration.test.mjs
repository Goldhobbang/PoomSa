import test from "node:test";
import assert from "node:assert/strict";
import {Garu} from "garu-ko/node";
import {inferSchoolAnalysis} from "../auto-analyzer.mjs";

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
 }finally{garu.destroy();}
});
