import test from "node:test";
import assert from "node:assert/strict";
import {preprocessSentence,analyzeHybrid,presentDeclarative} from "../hybrid-analyzer.mjs";
import {inferSchoolAnalysis} from "../auto-analyzer.mjs";
import {explainPartOfSpeech,explainFinalClassification} from "../explanations.mjs";

test("requested sentence is corrected, restored and mapped to school words",()=>{
 const prepared=preprocessSentence("썸네일만 보아도 소리지르는 거구만.");
 assert.equal(prepared.sentence,"썸네일만 보아도 소리지르는 거구먼.");
 assert.equal(prepared.original,"썸네일만 보아도 소리지르는 거구만.");
 const result=analyzeHybrid(prepared.sentence);
 assert.deepEqual(result.words.map(w=>w.analysis),["썸네일/만","보/아도","소리지르/는","것/이/구먼"]);
 assert.deepEqual(result.words[3].tokens.map(t=>t.pos),["NNB","VCP","EF"]);
 const q=inferSchoolAnalysis(prepared.sentence,result.tokens);
 assert.deepEqual(q.chunks[3].parts.map(p=>p.p),["명사","조사"]);
 assert.equal(q.chunks[3].parts[0].facets.nounIndependence,"의존 명사");
 assert.equal(q.chunks[3].parts[1].detail.at(-1),"서술격 조사");
 assert.equal(q.chunks[3].parts[1].lemma,"이다");
 assert.match(explainFinalClassification(q,q.chunks[3].parts[0]),/의존 명사/);
 const e=explainPartOfSpeech(q,q.chunks[3].parts[1],["명사"]);
 assert.match(e.principle,/서술격 조사/);
});

test("raw contracted ending remains analyzable when correction is disabled",()=>{
 const p=preprocessSentence("소리지르는 거구만.",{correctSpelling:false});
 assert.equal(p.sentence,"소리지르는 거구만.");
 assert.equal(p.corrections.length,0);
 assert.equal(analyzeHybrid(p.sentence).words[1].analysis,"것/이/구만");
});

test("restoration keeps canonical stems and attached endings",()=>{
 const r=analyzeHybrid("써 몰라 써도 몰라도 썼다 몰랐다 빨라 예뻐");
 assert.deepEqual(r.words.map(w=>w.analysis),["쓰/어","모르/아","쓰/어도","모르/아도","쓰/었/다","모르/았/다","빠르/아","예쁘/어"]);
 assert.ok(r.words.every(w=>w.restored&&w.gradeable));
 assert.equal(r.words.at(-1).tokens.at(-1).pos,"EF");
});

test("adnominal context prioritizes candidate dependent nouns, not ordinary nouns",()=>{
 const r=analyzeHybrid("예쁜 사람이 읽을 책을 볼 수 있는 것");
 assert.equal(r.words[1].tokens[0].pos,"NNG");
 assert.equal(r.words[3].tokens[0].pos,"NNG");
 assert.equal(r.words[5].tokens[0].pos,"NNB");
 assert.equal(r.words[7].tokens[0].pos,"NNB");
 assert.equal(analyzeHybrid("수").words[0].tokens[0].pos,"NA");
 assert.equal(analyzeHybrid("할 줄 안다.").words[1].tokens[0].pos,"NNB");
});

test("present tense tests verb/adjective class including ㄹ stems and exceptions",()=>{
 assert.equal(presentDeclarative("보").form,"본다");
 assert.equal(presentDeclarative("먹").form,"먹는다");
 assert.equal(presentDeclarative("살").form,"산다");
 assert.equal(presentDeclarative("예쁘").acceptsNda,false);
 assert.equal(presentDeclarative("있").acceptsNda,false);
 assert.deepEqual(analyzeHybrid("먹는다 산다 예쁜 있는").words.map(w=>w.tokens[0].pos),["VV","VV","VA","VA"]);
 assert.equal(analyzeHybrid("예쁜다").words[0].gradeable,false);
});

test("unknown model tokens are retained; conflicts and unknowns are not certain",()=>{
 const model=[{text:"아름답",pos:"VA",start:0,end:3},{text:"ㄴ",pos:"ETM",start:0,end:3}];
 assert.equal(analyzeHybrid("아름다운",model).tokens[0].text,"아름답");
 assert.equal(analyzeHybrid("미등록표현").words[0].gradeable,false);
 const conflict=analyzeHybrid("써",[{text:"쓰",pos:"VA",start:0,end:1},{text:"어",pos:"EF",start:0,end:1}]);
 assert.equal(conflict.words[0].gradeable,false);
 assert.equal(inferSchoolAnalysis("써",conflict.tokens).chunks[0].parts[0].gradeable,false);
 const nominalConflict=analyzeHybrid("살",[{text:"살",pos:"NNG",start:0,end:1}]);
 assert.equal(nominalConflict.words[0].gradeable,false);
});

test("spacing correction runs before token offsets and validates input",()=>{
 const p=preprocessSentence("  할수   있다.  ");
 assert.equal(p.sentence,"할 수 있다.");
 const r=analyzeHybrid(p.sentence);
 assert.equal(r.words[1].tokens[0].pos,"NNB");
 assert.equal(r.words[1].start,2);
 assert.throws(()=>preprocessSentence(" "));
 assert.throws(()=>preprocessSentence("가".repeat(181)));
});

test("noun suffix protection and complement context survive rules",()=>{
 assert.equal(analyzeHybrid("고양이").words[0].analysis,"고양이");
 const s="고양이가 친구가 되었다.";
 const r=analyzeHybrid(s);
 assert.equal(r.words[1].tokens.at(-1).pos,"JKC");
 assert.equal(inferSchoolAnalysis(s,r.tokens).chunks[1].role,"보어");
});
