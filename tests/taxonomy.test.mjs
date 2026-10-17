import test from "node:test";
import assert from "node:assert/strict";
import {EXAMPLES,POS} from "../data.mjs";
import {POS_FACETS,facetGroups,inferFacets,facetAnswersFor,validateFacets} from "../taxonomy.mjs";

test("all 9 parts of speech expose at least one visible subtype axis",()=>{
 for(const pos of POS){
  assert.ok(POS_FACETS[pos]?.length>0,pos);
  assert.ok(facetGroups(pos).length>0,pos);
 }
});
test("noun's proper/common and free/dependent classifications are independent",()=>{
 const iron=facetGroups("명사").map(g=>g.id);
 assert.deepEqual(iron,["nounKind","nounIndependence"]);
 assert.deepEqual(inferFacets({p:"명사",t:"윤현경"}),{nounKind:"고유 명사",nounIndependence:"자립 명사"});
 assert.equal(inferFacets({p:"명사",t:"대로"}).nounIndependence,"의존 명사");
 const actual=EXAMPLES.find(q=>q.id==="s10").chunks.flatMap(c=>c.parts).find(p=>p.t==="대로");
 assert.equal(actual.p,"명사");
 assert.equal(facetAnswersFor(actual).nounIndependence,"의존 명사");
});
test("pronouns cover speaker, addressee, third person, referential and reflexive",()=>{
 const f=(w)=>inferFacets({p:"대명사",t:w});
 assert.equal(f("나").person,"1인칭");
 assert.equal(f("너").person,"2인칭");
 assert.equal(f("그녀").person,"3인칭");
 assert.deepEqual([f("이것").pronounKind,f("이것").demonstrative],["지시 대명사","사물 지시"]);
 assert.deepEqual([f("여기").pronounKind,f("여기").demonstrative],["지시 대명사","장소 지시"]);
 assert.equal(f("무엇").pronounKind,"미지칭 대명사");
 assert.equal(f("자기").pronounKind,"재귀칭 대명사");
 const branch=facetGroups("대명사",{pronounKind:"인칭 대명사"});
 assert.deepEqual(branch.map(x=>x.id),["pronounKind","person"]);
});
test("numerals, adverbs, interjections have the print's fine types",()=>{
 assert.equal(inferFacets({p:"수사",t:"첫째"}).numeralKind,"서수사");
 assert.equal(inferFacets({p:"수사",t:"셋"}).numeralKind,"양수사");
 assert.equal(inferFacets({p:"부사",t:"아마"}).adverbKind,"문장 부사");
 assert.equal(inferFacets({p:"부사",t:"그러나"}).adverbSentence,"접속 기능");
 assert.equal(inferFacets({p:"부사",t:"안"}).adverbComponent,"부정 부사");
 assert.equal(inferFacets({p:"부사",t:"이리"}).adverbComponent,"지시 부사");
 for(const [word,type] of [["아","감정"],["자","의지"],["예","호응"],["음","구습·입버릇"]]){
  assert.equal(inferFacets({p:"감탄사",t:word}).interjectionKind,type);
 }
});
test("verb and adjective conjugation types separate regular and irregular",()=>{
 assert.equal(inferFacets({p:"동사",t:"먹는다"}).conjugation,"규칙 활용");
 assert.equal(inferFacets({p:"동사",t:"듣는다"}).irregularKind,"ㄷ 불규칙");
 assert.equal(inferFacets({p:"동사",t:"돕는다"}).irregularKind,"ㅂ 불규칙");
 assert.equal(inferFacets({p:"형용사",t:"파랗다"}).irregularKind,"ㅎ 불규칙");
 assert.equal(inferFacets({p:"형용사",t:"그렇다"}).adjectiveKind,"지시 형용사");
 assert.equal(inferFacets({p:"형용사",t:"크다"}).regularKind,"ㅡ 탈락");
 assert.ok(facetGroups("동사",{conjugation:"불규칙 활용"}).some(g=>g.choices.includes("러 불규칙")));
});
test("known POS completes subtype axes using lexical and contextual priors",()=>{
 assert.deepEqual(inferFacets({p:"명사",t:"신조어개념어"}),{nounKind:"보통 명사",nounIndependence:"자립 명사"});
 assert.equal(inferFacets({p:"부사",t:"아주"}).adverbComponent,"성상 부사");
 assert.equal(inferFacets({p:"대명사",t:"누구"}).pronounKind,"미지칭 대명사");
 assert.equal(inferFacets({p:"명사",t:"줄"},{tag:"NNG"}).nounIndependence,"자립 명사");
 assert.equal(inferFacets({p:"명사",t:"것"},{tag:"NNB"}).nounKind,"보통 명사");
});
test("all built-in facet answers are legal choices",()=>{
 for(const q of EXAMPLES)
  for(const c of q.chunks)
   for(const p of c.parts)assert.ok(validateFacets(p),q.id+" "+p.t);
});

