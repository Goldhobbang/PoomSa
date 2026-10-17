import test from "node:test";
import assert from "node:assert/strict";
import {inferSchoolAnalysis} from "../auto-analyzer.mjs";
const p=(text,pos,start,end)=>({text,pos,start,end});
const phrase = (s, words) => {
 const tokens=[];let pos=0;
 for(const [surface,forms] of words){
  const start=s.indexOf(surface,pos),end=start+surface.length;
  assert.ok(start>=pos,surface+" not found");
  for(const [t,tag] of forms)tokens.push(p(t,tag,start,end));
  pos=end;
 }
 return inferSchoolAnalysis(s,tokens,{id:"auto-unit-test"});
};
test("nominative/objective + finite verb makes two-place predicate",()=>{
 const q=phrase("철수가 밥을 먹는다.",[
  ["철수가",[["철수","NNP"],["가","JKS"]]],
  ["밥을",[["밥","NNG"],["을","JKO"]]],
  ["먹는다.",[["먹","VV"],["는다","EF"]]]
 ]);
 assert.equal(q.chunks.length,3);
 assert.deepEqual(q.chunks[0].parts.map(p=>p.t),["철수","가"]);
 assert.deepEqual(q.chunks[0].parts[1].detail,["격조사","주격 조사"]);
 assert.equal(q.chunks[1].role,"목적어");
 assert.equal(q.chunks[2].role,"서술어");
 assert.equal(q.slots,2);
 assert.equal(q.slotsGradeable,true);
 assert.equal(q.morph.answer,"철수/가");
});
test("complement particle differs from nominative particle",()=>{
 const q=phrase("철수가 학생이 되었다.",[
  ["철수가",[["철수","NNP"],["가","JKS"]]],
  ["학생이",[["학생","NNG"],["이","JKC"]]],
  ["되었다.",[["되","VV"],["었","EP"],["다","EF"]]]
 ]);
 assert.equal(q.chunks[1].role,"보어");
 assert.deepEqual(q.chunks[1].parts[1].detail,["격조사","보격 조사"]);
 assert.equal(q.slots,2);
 assert.equal(q.slotsGradeable,true);
});
test("three-place verb requires dative argument",()=>{
 const q=phrase("철수가 영희에게 책을 주었다.",[
  ["철수가",[["철수","NNP"],["가","JKS"]]],
  ["영희에게",[["영희","NNP"],["에게","JKB"]]],
  ["책을",[["책","NNG"],["을","JKO"]]],
  ["주었다.",[["주","VV"],["었","EP"],["다","EF"]]]
 ]);
 assert.equal(q.slots,3);
 assert.equal(q.chunks[1].role,"부사어");
 assert.equal(q.chunks[1].needed,true);
 assert.equal(q.slotsGradeable,true);
});
test("topic and manner particles are resolved using the clause predicate",()=>{
 const q=phrase("우리는 계획대로 행동했다.",[
  ["우리는",[["우리","NP"],["는","JX"]]],
  ["계획대로",[["계획","NNG"],["대로","JX"]]],
  ["행동했다.",[["행동","NNG"],["하","XSV"],["었","EP"],["다","EF"]]]
 ]);
 assert.equal(q.chunks[0].gradeable,true);
 assert.equal(q.chunks[1].gradeable,true);
 assert.equal(q.chunks[0].role,"주어");
 assert.equal(q.chunks[1].role,"부사어");
 assert.equal(q.chunks[2].parts[0].lemma,"행동하다");
 assert.ok(q.chunks[0].parts.some(p=>p.p==="조사"));
});
test("canonical morphology remains gradeable when surface contraction differs",()=>{
 const q=phrase("내가 갔다.",[
  ["내가",[["나","NP"],["가","JKS"]]],
  ["갔다.",[["가","VV"],["았","EP"],["다","EF"]]]
 ]);
 assert.equal(q.morph.gradeable,true);
 assert.equal(q.morph.answer,"나/가");
});
test("derived predicate root restores the lexical valency even with an omitted object",()=>{
 const q=phrase("철수가 생각했다.",[
  ["철수가",[["철수","NNP"],["가","JKS"]]],
  ["생각했다.",[["생각","NNG"],["하","XSV"],["었","EP"],["다","EF"]]]
 ]);
 assert.equal(q.slotsGradeable,true);
 assert.equal(q.slots,2);
 assert.equal(q.implicitArguments,1);
 assert.equal(q.chunks[1].parts[0].lemma,"생각하다");
});
test("determinants are separated and fine types assigned when strong evidence exists",()=>{
 const q=phrase("두 사람이 웃는다.",[
  ["두",[["두","MM"]]],
  ["사람이",[["사람","NNG"],["이","JKS"]]],
  ["웃는다.",[["웃","VV"],["는다","EF"]]]
 ]);
 assert.equal(q.chunks[0].parts[0].p,"관형사");
 assert.deepEqual(q.chunks[0].parts[0].detail,["수 관형사"]);
 assert.equal(q.chunks[0].role,"관형어");
});

