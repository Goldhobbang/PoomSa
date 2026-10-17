import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {EXAMPLES,POS,ROLES,TYPES,MODES,SUBTYPES,CASE_TYPES,normalizeSentence,validateExamples} from "../data.mjs";
import {inferSchoolAnalysis} from "../auto-analyzer.mjs";
import {explainPartOfSpeech,explainSentenceRole,explainValency,explainRequired,explainMorphology,isCustomAnswer} from "../explanations.mjs";

function setup(){
 const events={},elements={};
 const element=id=>elements[id]??={
   id,value:id==="difficultySelect"?"all":"",dataset:{},disabled:false,
   classList:{add(){},remove(){},toggle(){}},setAttribute(){},removeAttribute(){},
   addEventListener(evt,fn){(events[id]??={})[evt]=fn},
   querySelectorAll(){return []},innerHTML:"",textContent:"",hidden:false
 };
 const document={getElementById:element,querySelectorAll(){return []}};
 const localStorage={getItem(){return null},setItem(){}},window={scrollTo(){}};
 const code=readFileSync(new URL("../app.mjs",import.meta.url),"utf8")
   .split("\n").filter(line=>!line.trimStart().startsWith("import ")).join("\n");
 const stub=async sentence=>inferSchoolAnalysis(sentence,[
   {text:"고양이",pos:"NNG",start:0,end:4},
   {text:"가",pos:"JKS",start:0,end:4},
   {text:"웃",pos:"VV",start:5,end:9},
   {text:"는다",pos:"EF",start:5,end:9}
 ]);
 const api=new Function("document","localStorage","window","confirm",
   "EXAMPLES","POS","ROLES","TYPES","MODES","SUBTYPES","CASE_TYPES",
   "normalizeSentence","validateExamples","explainPartOfSpeech",
   "explainSentenceRole","explainValency","explainRequired","explainMorphology",
   "isCustomAnswer","analyzeUserSentence",
   code+"\nreturn {setMode,setCurrent,grade,answers,graded,current,posUnits,custom};"
 )(document,localStorage,window,()=>true,EXAMPLES,POS,ROLES,TYPES,MODES,SUBTYPES,CASE_TYPES,
 normalizeSentence,validateExamples,explainPartOfSpeech,explainSentenceRole,
 explainValency,explainRequired,explainMorphology,isCustomAnswer,stub);
 function click(kind,index,value){
   events.answerArea.click({target:{closest(selector){
     return selector==="button[data-kind]"?{value,dataset:{kind,index:String(index)}}:null;
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
 assert.match(h.element("feedback").innerHTML,/왜 틀렸을까/);
 assert.ok(h.api.graded["s05:pos"].score<h.api.graded["s05:pos"].total);
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
