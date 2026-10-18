import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {EXAMPLES,POS,ROLES,TYPES,MODES,SUBTYPES,CASE_TYPES,normalizeSentence,validateExamples} from "../data.mjs";
import {inferSchoolAnalysis} from "../auto-analyzer.mjs";
import {POS_FACETS,facetGroups,facetAnswersFor} from "../taxonomy.mjs";
import {explainPartOfSpeech,explainSentenceRole,explainValency,explainRequired,explainMorphology,isCustomAnswer,explainFacet} from "../explanations.mjs";
import {explainFinalClassification} from "../explanations.mjs";
import {createSentenceAnalyzer,ANALYSIS_VERSION} from "../model.mjs";
import {morphemeForm,morphemeLabel} from "../morphology.mjs";

function setup(analyzer,saved=[]){
 const events={},elements={};
 const element=id=>elements[id]??={
   id,value:id==="difficultySelect"?"all":"",dataset:{},disabled:false,
   classList:{add(){},remove(){},toggle(){}},setAttribute(){},removeAttribute(){},
   open:false,showModal(){this.open=true;},close(){this.open=false;events[id]?.close?.();},focus(){this.focused=true;},
   addEventListener(evt,fn){(events[id]??={})[evt]=fn},
   querySelectorAll(){return []},innerHTML:"",textContent:"",hidden:false
 };
 const document={getElementById:element,querySelectorAll(){return []}};
 const localStorage={getItem(key){return key==='poomsa-custom-1'?JSON.stringify(saved):null},setItem(){}},window={scrollTo(){}};
 const code=readFileSync(new URL("../app.mjs",import.meta.url),"utf8")
   .split("\n").filter(line=>!line.trimStart().startsWith("import ")).join("\n");
 const stub=analyzer||(async sentence=>inferSchoolAnalysis(sentence,[
   {text:"고양이",pos:"NNG",start:0,end:4},
   {text:"가",pos:"JKS",start:0,end:4},
   {text:"웃",pos:"VV",start:5,end:9},
   {text:"는다",pos:"EF",start:5,end:9}
 ]));
 const api=new Function("document","localStorage","window","confirm",
   "EXAMPLES","POS","ROLES","TYPES","MODES","SUBTYPES","CASE_TYPES",
   "normalizeSentence","validateExamples","explainPartOfSpeech",
   "explainSentenceRole","explainValency","explainRequired","explainMorphology",
   "isCustomAnswer","analyzeUserSentence","ANALYSIS_VERSION","POS_FACETS","facetGroups","facetAnswersFor","explainFacet","explainFinalClassification","morphemeForm","morphemeLabel",
   code+"\nreturn {setMode,setCurrent,grade,retry,openExplanation,answers,graded,current,posUnits,custom};"
 )(document,localStorage,window,()=>true,EXAMPLES,POS,ROLES,TYPES,MODES,SUBTYPES,CASE_TYPES,
 normalizeSentence,validateExamples,explainPartOfSpeech,explainSentenceRole,
 explainValency,explainRequired,explainMorphology,isCustomAnswer,stub,ANALYSIS_VERSION,POS_FACETS,facetGroups,facetAnswersFor,explainFacet,explainFinalClassification,morphemeForm,morphemeLabel);
 function click(kind,index,value,facetId=""){
   events.answerArea.click({target:{closest(selector){
     return selector==="button[data-kind]"?{value,dataset:{kind,index:String(index),facetId}}:null;
   }}});
 }
 return {api,elements,events,element,click};
}

test("static classifications remain clickable chips",()=>{
 const h=setup();
 for(const mode of ["pos","syntax","slots"]){
   h.api.setMode(mode);
   assert.match(h.element("answerArea").innerHTML,/choice-button/);
   assert.ok(!h.element("answerArea").innerHTML.includes("<select"));
 }
});

test("fine-grained particle choice and diagnostic feedback still work",()=>{
 const h=setup();
 h.api.setCurrent("s05");h.api.setMode("pos");
 const units=h.api.posUnits(h.api.current()),idx=units.findIndex(x=>x.t==="이"&&x.p==="조사");
 units.forEach((p,i)=>{h.click("pos",i,p.p);if(p.detail?.[0])h.click("subtype",i,p.detail[0]);if(p.detail?.[1])h.click("caseType",i,p.detail[1]);});
 h.click("caseType",idx,"주격 조사");
 h.api.grade();
 h.api.openExplanation(idx);
 assert.match(h.element("explanationBody").innerHTML,/왜 틀렸을까/);
 assert.ok(h.api.graded["s05:pos"].score<h.api.graded["s05:pos"].total);
 assert.ok(!h.element("feedback").innerHTML.includes("조사 → 격조사"));
 assert.ok(!h.element("answerArea").innerHTML.includes("조사 → 격조사"));
 assert.match(h.element("explanationBody").innerHTML,/최종 분류/);
});

test("user supplies only a sentence: app stores generated analysis and opens practice",async()=>{
 const h=setup();
 h.element("customSentence").value="고양이가 웃는다.";
 await h.events.studioForm.submit({preventDefault(){}});
 assert.equal(h.api.custom.length,1);
 assert.equal(h.api.custom[0].origin,"automatic");
 assert.ok(h.api.custom[0].chunks.length>=2);
 assert.equal(h.api.current().id,h.api.custom[0].id);
 assert.equal(h.element("customSentence").value,"");
 assert.match(h.element("actionMessage").textContent,/자동 분석/);
});

test("auto items without a safe category are visibly excluded from grading",async()=>{
 const h=setup();
 h.element("customSentence").value="고양이가 웃는다.";
 await h.events.studioForm.submit({preventDefault(){}});
 h.api.setMode("syntax");h.api.grade();
 const result=h.api.graded[h.api.current().id+":syntax"];
 assert.ok(result.total>0);
 assert.ok(result.score<=result.total);
 assert.match(h.element("feedback").innerHTML,/자동 분석의 잠정 정답/);
});

test("existing validated examples still grade correctly in all modes",()=>{
 const h=setup();
 for(const mode of ["pos","syntax","slots","morph"]){
   h.api.setCurrent("s01");h.api.setMode(mode);
   if(mode==="pos")h.api.posUnits(h.api.current()).forEach((p,i)=>{
     h.click("pos",i,p.p);
     if(p.detail?.[0])h.click("subtype",i,p.detail[0]);
     if(p.detail?.[1])h.click("caseType",i,p.detail[1]);
     if(p.p!=="조사"&&p.p!=="관형사")for(const [id,value] of Object.entries(p.facets||{}))h.click("facet",i,value,id);
   });
   else if(mode==="syntax")h.api.current().chunks.forEach((c,i)=>h.click("role",i,c.role));
   else if(mode==="slots"){
     h.click("slot",0,"2");
     const a=h.api.answers["s01:slots"];h.api.current().chunks.forEach((c,i)=>{if(c.needed)a.required[i]=true;});
   }else h.api.answers["s01:morph"]={values:{},subtypes:{},caseTypes:{},required:{},morph:"철수/가"};
   h.api.grade();
   const result=h.api.graded["s01:"+mode];
   assert.equal(result.score,result.total,mode);
 }
});


test("every school POS displays subcategory choices on click",()=>{
 const h=setup();
 const per={
  "명사":["고유 명사","보통 명사","자립 명사","의존 명사"],
  "대명사":["인칭 대명사","지시 대명사","미지칭 대명사","부정칭 대명사","재귀칭 대명사"],
  "수사":["양수사","서수사"],
  "동사":["자동사","타동사","규칙 활용","불규칙 활용"],
  "형용사":["성상 형용사","지시 형용사","규칙 활용","불규칙 활용"],
  "관형사":["성상 관형사","지시 관형사","수 관형사"],
  "부사":["성분 부사","문장 부사"],
  "감탄사":["감정","의지","호응","구습·입버릇"],
  "조사":["격조사","보조사","접속 조사"]
 };
 h.api.setCurrent("s01");h.api.setMode("pos");
 for(const [pos,choices] of Object.entries(per)){
  h.click("pos",0,pos);
  const html=h.element("answerArea").innerHTML;
  for(const choice of choices)assert.ok(html.includes(">"+choice+"</button>"),pos+": "+choice);
 }
});

test("noun classification axes independently select and award separate points",()=>{
 const h=setup();
 h.api.setCurrent("s01");h.api.setMode("pos");
 h.click("pos",0,"명사");
 h.click("facet",0,"고유 명사","nounKind");
 h.click("facet",0,"자립 명사","nounIndependence");
 assert.deepEqual(h.api.answers["s01:pos"].facets[0],{nounKind:"고유 명사",nounIndependence:"자립 명사"});
 const q=h.api.current(),u=h.api.posUnits(q)[0];
 assert.equal(u.p,"명사");
 assert.ok(h.element("answerArea").innerHTML.includes("이름의 범위"));
 assert.ok(h.element("answerArea").innerHTML.includes("자립성"));
});

test("nested pronoun and conjugation menus follow selected option",()=>{
 const h=setup();
 h.api.setCurrent("s01");h.api.setMode("pos");
 h.click("pos",0,"대명사");
 h.click("facet",0,"인칭 대명사","pronounKind");
 assert.match(h.element("answerArea").innerHTML,/1인칭/);
 h.click("facet",0,"1인칭","person");
 h.click("facet",0,"지시 대명사","pronounKind");
 assert.match(h.element("answerArea").innerHTML,/사물 지시/);
 assert.equal(h.api.answers["s01:pos"].facets[0].person,undefined);
 h.click("pos",0,"동사");
 h.click("facet",0,"불규칙 활용","conjugation");
 assert.match(h.element("answerArea").innerHTML,/ㄷ 불규칙/);
});

test("custom input flows through correction, real rules, grading and morphology evidence",async()=>{
 const analyze=createSentenceAnalyzer(async()=>{throw Error("offline test engine");});
 const h=setup(analyze);
 h.element("customSentence").value="썸네일만 보아도 소리지르는 거구만.";
 await h.events.studioForm.submit({preventDefault(){}});
 assert.equal(h.api.custom.length,1);
 assert.equal(h.element("currentSentence").textContent,"썸네일만 보아도 소리지르는 거구먼.");
 assert.match(h.element("processingNote").textContent,/입력: 썸네일만/);
 assert.match(h.element("processingNote").textContent,/표준 표기/);
 h.api.grade();
 h.api.openExplanation('sentence');
 assert.match(h.element("explanationBody").innerHTML,/<td>것<\/td><td>의존 명사/);
 assert.match(h.element("explanationBody").innerHTML,/<td>이-<\/td><td>서술격 조사 어간/);
 assert.match(h.element("explanationBody").innerHTML,/<td>-구먼<\/td><td>종결 어미/);
 assert.match(h.element("explanationBody").innerHTML,/의존 명사/);
 assert.match(h.element("explanationBody").innerHTML,/서술격 조사 어간/);
 assert.match(h.element("explanationBody").innerHTML,/관형사형 어미/);
 assert.ok(!h.element("feedback").innerHTML.includes("조사 → 격조사"));
});

function renderedButton(h,kind,index,value,facetId){
 const buttons=h.element("answerArea").innerHTML.match(/<button\b[^>]*>[\s\S]*?<\/button>/g)||[];
 const matches=buttons.filter(b=>b.includes('data-kind="'+kind+'"')&&b.includes('data-index="'+index+'"')&&
  b.includes('value="'+value+'"')&&(!facetId||b.includes('data-facet-id="'+facetId+'"')));
 const found=matches.find(b=>b.includes('data-answer-state'))||matches[0];
 assert.ok(found,kind+': '+value+' should remain in the classification list');
 return found;
}

test("free sentence review preserves chosen branches and reveals correct particle choices",async()=>{
 const h=setup(createSentenceAnalyzer(async()=>{throw Error("offline test");}));
 h.element("customSentence").value="학교에 간다.";
 await h.events.studioForm.submit({preventDefault(){}});
 const i=h.api.posUnits(h.api.current()).findIndex(p=>p.t==="에");
 h.click("pos",i,"명사");h.click("facet",i,"고유 명사","nounKind");
 h.api.grade();
 assert.match(renderedButton(h,"pos",i,"명사"),/is-answer-wrong/);
 assert.match(renderedButton(h,"pos",i,"조사"),/is-answer-correct/);
 assert.match(renderedButton(h,"facet",i,"고유 명사","nounKind"),/is-answer-wrong/);
 assert.match(renderedButton(h,"subtype",i,"격조사"),/is-answer-correct/);
 assert.match(renderedButton(h,"caseType",i,"부사격 조사"),/is-answer-correct/);
 assert.match(renderedButton(h,"pos",i,"명사"),/내 선택/);
 h.api.retry();
 assert.ok(!h.element("answerArea").innerHTML.includes("is-answer-"));
});

test("wrong fine category is red and correct category green in the same list",()=>{
 const h=setup();h.api.setCurrent("s05");
 const i=h.api.posUnits(h.api.current()).findIndex(p=>p.detail?.[1]==="보격 조사");
 h.click("pos",i,"조사");h.click("subtype",i,"격조사");h.click("caseType",i,"주격 조사");
 h.api.grade();
 assert.match(renderedButton(h,"pos",i,"조사"),/is-answer-correct/);
 assert.match(renderedButton(h,"caseType",i,"주격 조사"),/is-answer-wrong/);
 assert.match(renderedButton(h,"caseType",i,"보격 조사"),/is-answer-correct/);
});

test("nested correct facet remains visible beside an incorrect selected facet",()=>{
 const h=setup();h.api.setCurrent("s27");
 const i=h.api.posUnits(h.api.current()).findIndex(p=>p.p==="부사");
 assert.ok(i>=0);
 h.click("pos",i,"부사");h.click("facet",i,"성분 부사","adverbKind");
 h.click("facet",i,"성상 부사","adverbComponent");h.api.grade();
 assert.match(renderedButton(h,"facet",i,"성분 부사","adverbKind"),/is-answer-wrong/);
 assert.match(renderedButton(h,"facet",i,"성상 부사","adverbComponent"),/is-answer-wrong/);
 assert.match(renderedButton(h,"facet",i,"문장 부사","adverbKind"),/is-answer-correct/);
 assert.match(renderedButton(h,"facet",i,"화자 태도·양태","adverbSentence"),/is-answer-correct/);
});

test("correct answers stay green and contextual predictions are also graded",async()=>{
 const h=setup(createSentenceAnalyzer(async()=>{throw Error("offline test");}));
 h.element("customSentence").value="미등록표현 학교에 간다.";
 await h.events.studioForm.submit({preventDefault(){}});
 const units=h.api.posUnits(h.api.current()),i=units.findIndex(p=>p.t==="에");
 h.click("pos",0,"수사");
 h.click("pos",i,"조사");h.click("subtype",i,"격조사");h.click("caseType",i,"부사격 조사");
 h.api.grade();
 assert.match(renderedButton(h,"caseType",i,"부사격 조사"),/is-answer-correct/);
 assert.match(renderedButton(h,"caseType",i,"부사격 조사"),/내 선택 · 정답/);
 assert.match(renderedButton(h,"pos",0,"수사"),/is-answer-wrong/);
 assert.ok(!h.element("answerArea").innerHTML.includes("채점 보류"),h.element("answerArea").innerHTML.match(/.{0,140}채점 보류.{0,100}/g)?.join('\n'));
});

test("first-level mismatch aligns both answer trees in shared hierarchy rows",async()=>{
 const h=setup(createSentenceAnalyzer(async()=>{throw Error('offline');}));
 h.element('customSentence').value='학교에 간다.';
 await h.events.studioForm.submit({preventDefault(){}});
 h.click('pos',1,'명사');h.click('facet',1,'고유 명사','nounKind');h.api.grade();
 const html=h.element('answerArea').innerHTML;
 const comparison=html.match(/<table class="classification-compare-table">[\s\S]*?<\/table>/g).find(t=>t.includes('에의')||t.includes('에 사용자 답'));
 assert.ok(comparison);
 assert.match(comparison,/<th scope="col"[^>]*>사용자 답<\/th><th scope="col"[^>]*>정답<\/th>/);
 assert.match(comparison,/<tr><th scope="row">1차 · 품사<\/th><td>[\s\S]*?내 선택[\s\S]*?<\/td><td>[\s\S]*?정답/);
 assert.match(comparison,/<tr><th scope="row">3차 · 세부 종류<\/th><td><span class="comparison-empty">해당 단계 없음<\/span><\/td><td>[\s\S]*?부사격 조사/);
 assert.match(html,/data-explanation-index="1"/);
 assert.ok(!html.includes('선택한 분류 · 명사'));
 h.api.openExplanation(1);
 assert.equal((h.element('explanationBody').innerHTML.match(/<th scope="row">격조사 종류<\/th>/g)||[]).length,1);
});

test("explanation cards open a table-based modal and return focus on close",()=>{
 const h=setup();h.api.setCurrent('s05');h.api.grade();
 const idx=h.api.posUnits(h.api.current()).findIndex(p=>p.detail?.[1]==='보격 조사');
 const trigger={dataset:{explanationIndex:String(idx)},focused:false,focus(){this.focused=true;}};
 h.events.answerArea.click({target:{closest:s=>s==='button[data-explanation-index]'?trigger:null}});
 assert.equal(h.element('explanationDialog').open,true);
 assert.match(h.element('explanationTitle').textContent,/해설/);
 const html=h.element('explanationBody').innerHTML;
 assert.ok((html.match(/class="explanation-table"/g)||[]).length>=3);
 assert.ok(html.indexOf('사용자 답과 정답')<html.indexOf('왜 틀렸을까?'));
 assert.ok(html.indexOf('왜 틀렸을까?')<html.indexOf('문법 원리'));
 h.events.closeExplanation.click();
 assert.equal(h.element('explanationDialog').open,false);
 assert.equal(trigger.focused,true);
});

test("no answers appear before grading and contextual explanations identify prediction basis",async()=>{
 const h=setup(createSentenceAnalyzer(async()=>{throw Error('offline');}));
 h.api.openExplanation(0);
 assert.equal(h.element('explanationDialog').open,false);
 h.element('customSentence').value='미등록표현 간다.';
 await h.events.studioForm.submit({preventDefault(){}});h.api.grade();h.api.openExplanation(0);
 const html=h.element('explanationBody').innerHTML;
 assert.ok(!html.includes('판정을 보류한 이유'));
 assert.match(html,/최종 분류/);
 assert.match(html,/문장 속 쓰임으로 추정/);
});

test('saved automatic questions are reanalyzed on selection and retain their existing identity',async()=>{
 const old={id:'auto-saved',origin:'automatic',analysisVersion:'hybrid-1',chunks:[{t:'학교에 간다.',parts:[]}],preprocessing:{original:'학교에 간다.',correctSpelling:true}};
 const h=setup(createSentenceAnalyzer(async()=>{throw Error('offline migration');}),[old]);
 h.api.setCurrent(old.id);
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(h.api.current().id,old.id);
 assert.equal(h.api.current().analysisVersion,ANALYSIS_VERSION);
 assert.equal(h.api.custom.length,1);
 assert.ok(h.api.posUnits(h.api.current()).every(p=>p.gradeable));
 h.api.grade();
 assert.ok(h.api.graded[old.id+':pos'].total>0);
 assert.ok(!h.element('answerArea').innerHTML.includes('채점 보류'));
});

test('a linguistically valid alternate reading of 만큼 is accepted and its explanation stays consistent',async()=>{
 const h=setup(createSentenceAnalyzer(async()=>{throw Error('offline');}));
 h.element('customSentence').value='너만큼은 아는 대로 말하고 친구와 같이 가야 한다.';
 await h.events.studioForm.submit({preventDefault(){}});
 const units=h.api.posUnits(h.api.current());
 units.forEach((p,i)=>{
  h.click('pos',i,p.p);
  if(p.detail?.[0])h.click('subtype',i,p.detail[0]);
  if(p.detail?.[1])h.click('caseType',i,p.detail[1]);
  if(!['조사','관형사'].includes(p.p))for(const [id,value] of Object.entries(p.facets||{}))h.click('facet',i,value,id);
 });
 const i=units.findIndex(p=>p.t==='만큼');
 h.click('subtype',i,'격조사');h.click('caseType',i,'부사격 조사');h.api.grade();
 const result=h.api.graded[h.api.current().id+':pos'];
 assert.equal(result.score,result.total);
 assert.match(renderedButton(h,'caseType',i,'부사격 조사'),/is-answer-correct/);
 h.api.openExplanation(i);
 assert.match(h.element('explanationBody').innerHTML,/비슷한 정도·한도/);
 assert.match(h.element('explanationBody').innerHTML,/가능한 다른 해석/);
 h.api.setMode('syntax');
 h.api.current().chunks.forEach((c,i)=>h.click('role',i,i===0?'부사어':c.role));h.api.grade();
 const syntax=h.api.graded[h.api.current().id+':syntax'];assert.equal(syntax.score,syntax.total);
});

test('stale analyses with held words are hidden and cannot be graded during reanalysis',async()=>{
 const fresh=await createSentenceAnalyzer(async()=>{throw Error('offline');})('같이가야한다.');
 const old={...fresh,id:'auto-old-held',analysisVersion:'hybrid-2',chunks:fresh.chunks.map(c=>({...c,gradeable:false,parts:c.parts.map(p=>({...p,gradeable:false}))}))};
 let finish;
 const h=setup(()=>new Promise(resolve=>{finish=resolve;}),[old]);
 h.api.setCurrent(old.id);h.api.grade();
 assert.match(h.element('answerArea').innerHTML,/새 분석기로 다시/);
 assert.ok(!h.element('answerArea').innerHTML.includes('채점 보류'));
 assert.ok(!h.api.graded[old.id+':pos']);
 finish(fresh);await new Promise(resolve=>setImmediate(resolve));
 assert.equal(h.api.current().analysisVersion,ANALYSIS_VERSION);
 assert.deepEqual(h.api.posUnits(h.api.current()).map(p=>p.p),['부사','동사','동사']);
 h.api.grade();assert.ok(h.api.graded[old.id+':pos'].total>0);
});

test('reported inflections grade with actual form labels and each card explains its own morphemes',async()=>{
 const h=setup(createSentenceAnalyzer(async()=>{throw Error('offline');}));
 h.element('customSentence').value='너만큼은 아는 대로 말하고 친구와 같이 가야 한다.';
 await h.events.studioForm.submit({preventDefault(){}});
 const units=h.api.posUnits(h.api.current());
 units.forEach((p,i)=>{
  h.click('pos',i,p.p);
  if(p.detail?.[0])h.click('subtype',i,p.detail[0]);
  if(p.detail?.[1])h.click('caseType',i,p.detail[1]);
  if(!['조사','관형사'].includes(p.p))for(const [id,value] of Object.entries(p.facets||{}))h.click('facet',i,value,id);
 });
 h.api.grade();
 const result=h.api.graded[h.api.current().id+':pos'];assert.equal(result.score,result.total);
 const speak=units.findIndex(p=>p.t==='말하고'),aux=units.findIndex(p=>p.t==='한다'),go=units.findIndex(p=>p.t==='가야');
 assert.match(renderedButton(h,'facet',speak,'규칙 활용','conjugation'),/is-answer-correct/);
 h.api.openExplanation(speak);
 let html=h.element('explanationBody').innerHTML;
 assert.match(html,/이 문장의 활용/);assert.ok(!html.includes('여 불규칙'));
 assert.match(html,/<td>말하-<\/td><td>동사 어간/);
 assert.match(html,/<td>-고<\/td><td>연결 어미/);
 h.api.openExplanation(aux);html=h.element('explanationBody').innerHTML;
 assert.match(html,/<td>하-<\/td><td>보조 동사 어간/);
 assert.match(html,/<td>-ㄴ다<\/td><td>종결 어미/);assert.ok(!html.includes('여 불규칙'));
 assert.match(html,/필요·의무/);
 h.api.openExplanation(go);assert.match(h.element('explanationBody').innerHTML,/<td>-아야<\/td><td>연결 어미/);
 h.api.retry();h.click('pos',speak,'동사');h.click('facet',speak,'불규칙 활용','conjugation');h.click('facet',speak,'여 불규칙','irregularKind');h.api.grade();
 assert.match(renderedButton(h,'facet',speak,'불규칙 활용','conjugation'),/is-answer-wrong/);
 assert.match(renderedButton(h,'facet',speak,'규칙 활용','conjugation'),/is-answer-correct/);
 h.api.openExplanation(speak);assert.ok(!h.element('explanationBody').innerHTML.includes('채점 보류'));
});

test('hybrid-3 saved lemma-level irregular answers are refreshed before grading',async()=>{
 const analyze=createSentenceAnalyzer(async()=>{throw Error('offline');});
 const old=await analyze('말하고 같이 가야 한다.');old.id='auto-old-conjugation';old.analysisVersion='hybrid-3';
 for(const p of old.chunks.flatMap(c=>c.parts))if(p.root?.endsWith('하')){delete p.inflection;delete p.morphemes;p.facets={conjugation:'불규칙 활용',irregularKind:'여 불규칙'};}
 const h=setup(analyze,[old]);h.api.setCurrent(old.id);
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(h.api.current().analysisVersion,ANALYSIS_VERSION);
 for(const p of h.api.posUnits(h.api.current()).filter(p=>p.root?.endsWith('하'))){
  assert.equal(p.facets.conjugation,'규칙 활용');assert.equal(p.facets.irregularKind,undefined);assert.ok(p.morphemes.length);
 }
});

