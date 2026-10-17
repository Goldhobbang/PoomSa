import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {EXAMPLES,POS,ROLES,TYPES,MODES,SUBTYPES,CASE_TYPES,normalizeSentence,validateExamples} from "../data.mjs";

function harness(){
  const events={};
  const elements={};
  const make=id=>elements[id]??={
    id,value:id==="difficultySelect"?"all":"",dataset:{},
    classList:{add(){},remove(){},toggle(){}},
    setAttribute(){},removeAttribute(){},
    addEventListener(event,fn){(events[id]??={})[event]=fn},
    querySelectorAll(){return []},
    innerHTML:"",textContent:"",hidden:false
  };
  const document={getElementById:make,querySelectorAll(){return []}};
  const localStorage={getItem(){return null},setItem(){}};
  const window={scrollTo(){}};
  const code=readFileSync(new URL("../app.mjs",import.meta.url),"utf8").replace(/^import .+;\s*/,"");
  const api=new Function("document","localStorage","window","confirm",
    "EXAMPLES","POS","ROLES","TYPES","MODES","SUBTYPES","CASE_TYPES",
    "normalizeSentence","validateExamples",code+"\nreturn {setCurrent,setMode,answers,graded,posUnits,current};"
  )(document,localStorage,window,()=>true,EXAMPLES,POS,ROLES,TYPES,MODES,SUBTYPES,CASE_TYPES,normalizeSentence,validateExamples);
  function clickAnswer(kind,index,value){
    events.answerArea.click({target:{closest(selector){
      return selector==="button[data-kind]"?{value,dataset:{kind,index:String(index)}}:null;
    }}});
  }
  function clickStudio(dataName,index,value){
    events.studioEditor.click({target:{closest(selector){
      return selector==="button"?{value,id:"",dataset:{[dataName]:String(index)}}:null;
    }}});
  }
  return {api,elements,events,make,clickAnswer,clickStudio};
}

test("classification choices are always-visible buttons (no dropdown)",()=>{
  const h=harness();
  for(const mode of ["pos","syntax","slots"]){
    h.api.setMode(mode);
    assert.ok(h.elements.answerArea.innerHTML.includes('class="choice-button'),mode);
    assert.ok(!h.elements.answerArea.innerHTML.includes("<select"),mode);
  }
});

test("visible nested particle buttons select and show pressed state",()=>{
  const h=harness();
  h.api.setCurrent("s01");h.api.setMode("pos");
  const i=h.api.posUnits(h.api.current()).findIndex(p=>p.p==="조사");
  h.clickAnswer("pos",i,"조사");
  assert.match(h.elements.answerArea.innerHTML,/data-kind="subtype"/);
  h.clickAnswer("subtype",i,"격조사");
  assert.match(h.elements.answerArea.innerHTML,/data-kind="caseType"/);
  h.clickAnswer("caseType",i,"주격 조사");
  assert.equal(h.api.answers["s01:pos"].caseTypes[i],"주격 조사");
  assert.ok(h.elements.answerArea.innerHTML.includes('value="주격 조사" aria-pressed="true"'));
});

test("syntax answer chips update the selected classification",()=>{
  const h=harness();
  h.api.setCurrent("s02");h.api.setMode("syntax");
  h.clickAnswer("role",0,"주어");
  assert.equal(h.api.answers["s02:syntax"].values[0],"주어");
  assert.ok(h.elements.answerArea.innerHTML.includes('value="주어" aria-pressed="true"'));
});

test("custom sentence editor exposes all classification choices without dropdowns",()=>{
  const h=harness();
  h.make("customSentence").value="고양이가 산책한다.";
  h.events.studioForm.submit({preventDefault(){}});
  const html=h.elements.studioEditor.innerHTML;
  assert.ok(!html.includes("<select"));
  assert.ok(html.includes("data-editor-pos"));
  assert.ok(html.includes("data-editor-role"));
  assert.ok(html.includes("data-editor-slots"));
  assert.ok(html.includes("data-editor-morph"));
  h.clickStudio("editorPos","0:0","명사");
  assert.ok(h.elements.studioEditor.innerHTML.includes('value="명사" aria-pressed="true"'));
});
