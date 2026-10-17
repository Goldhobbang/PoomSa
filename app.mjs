import {EXAMPLES,POS,ROLES,TYPES,MODES,SUBTYPES,CASE_TYPES,normalizeSentence,validateExamples} from "./data.mjs";
import {explainPartOfSpeech,explainSentenceRole,explainValency,explainRequired,explainMorphology,isCustomAnswer} from "./explanations.mjs";
import {analyzeUserSentence} from "./model.mjs";
import {POS_FACETS,facetGroups,facetAnswersFor} from "./taxonomy.mjs";
import {explainFacet} from "./explanations.mjs";
const $ = id => document.getElementById(id);
const escapeHtml = value => String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
const load = (key,fallback) => { try {const v=JSON.parse(localStorage.getItem(key));return Array.isArray(v)?v:fallback;} catch {return fallback;} };
const persist = (key,v) => {try {localStorage.setItem(key,JSON.stringify(v));return true;}catch{return false;}};
const STORAGE_CUSTOM="poomsa-custom-1",STORAGE_HISTORY="poomsa-history-1";
const errors=validateExamples();
if(errors.length) console.error("Question bank validation:",errors);
let custom=load(STORAGE_CUSTOM,[]).filter(q=>q&&typeof q.id==="string"&&Array.isArray(q.chunks));
let history=load(STORAGE_HISTORY,[]);
let answers={},graded={},currentId=EXAMPLES[0].id,mode="pos",currentView="practice";
const allExamples = () => [...EXAMPLES,...custom];
const current = () => allExamples().find(q=>q.id===currentId)||EXAMPLES[0];
const activeKey = () => currentId+":"+mode;
const response = () => {
  const a=answers[activeKey()] ||= {values:{},subtypes:{},caseTypes:{},required:{}};
  a.values ||= {};a.subtypes ||= {};a.caseTypes ||= {};a.required ||= {};a.facets ||= {};
  return a;
};
const visibleExamples=()=>allExamples().filter(q=>{
 const f=$("difficultySelect").value;return f==="all"||((f==="custom")?(q.origin==="automatic"||q.id.startsWith("auto-")||q.id.startsWith("custom-")):q.level===f);
});
function refreshSelect(){
 const visible=visibleExamples();
 if(!visible.length){$("difficultySelect").value="all";return refreshSelect();}
 if(!visible.some(q=>q.id===currentId)&&visible.length) currentId=visible[0].id;
 $("exampleSelect").innerHTML=visible.length?visible.map((q,i)=>
   '<option value="'+escapeHtml(q.id)+'"'+(q.id===currentId?" selected":"")+">"+
   String(i+1).padStart(2,"0")+" · "+escapeHtml(q.chunks.map(c=>c.t).join(" ")).replaceAll('"',"&quot;")+"</option>"
 ).join(""):'<option value="">등록된 문장이 없습니다</option>';
 $("nextBtn").disabled=visible.length<2;
 renderPractice();
}
function setCurrent(id){if(!allExamples().some(q=>q.id===id))return;currentId=id;refreshSelect();}
function renderPractice(){
 const q=current(),list=visibleExamples();
 $("currentSentence").textContent=q.chunks.map(c=>c.t).join(" ");
 $("exampleIndex").textContent=String(Math.max(1,list.findIndex(x=>x.id===q.id)+1)).padStart(3,"0");
 $("sentenceLevel").textContent=q.level;
 $("sentenceFocus").textContent=q.focus;
 $("sentenceOrigin").textContent=q.source||"학습용 기본 문제";
 renderTask();
}
function setMode(next){
 if(!MODES.some(m=>m.id===next))return;mode=next;
 document.querySelectorAll(".mode-tab").forEach(el=>{
   const active=el.dataset.mode===mode;el.classList.toggle("active",active);
   el.setAttribute("aria-selected",active?"true":"false");el.tabIndex=active?0:-1;
 });
 renderTask();
}
const expectedPosPath = p => [p.p,...(Array.isArray(p.detail)?p.detail:[])];
const chosenPosPath = (a,i) => {
  const pos=a.values[i]||"",path=[pos];
  if(SUBTYPES[pos]){
    const subtype=a.subtypes?.[i]||"";
    path.push(subtype);
    if(subtype==="격조사")path.push(a.caseTypes?.[i]||"");
  }
  return path;
};
const facetAnswer=(a,i)=>a.facets?.[i]||{};
const expectedFacets=p=>facetAnswersFor(p);
const scoredFacets=p=>["조사","관형사"].includes(p.p)?[]:
 facetGroups(p.p,expectedFacets(p)).filter(g=>!!expectedFacets(p)[g.id]);
const posTally = (q,a) => {
 const units=posUnits(q),eligible=units.filter(p=>p.gradeable!==false);
 const total=eligible.reduce((n,p)=>n+expectedPosPath(p).length+scoredFacets(p).length,0);
 const filled=units.reduce((n,p,i)=>{
   if(p.gradeable===false)return n;
   const path=chosenPosPath(a,i);
   const base=Math.min(expectedPosPath(p).length,path.filter(Boolean).length);
   const extra=path[0]===p.p?scoredFacets(p).filter(g=>facetAnswer(a,i)[g.id]).length:0;
   return n+base+extra;
 },0);
 return {total,filled};
};
const choiceFacets=(pos,a,i,token)=>{
 if(!POS_FACETS[pos] || pos==="조사" || pos==="관형사")return "";
 const current=facetAnswer(a,i),unit=posUnits(currentQuestionForFacets)[i];
 const expected=unit?.p===pos?expectedFacets(unit):{};
 return facetGroups(pos,current).map(g=>{
   const graded=!!expected[g.id],value=current[g.id]||"";
   return '<div class="facet-block"><div class="token-detail-label nested-label">'+escapeHtml(g.label)+
     (g.annotation?' <span class="facet-note">'+escapeHtml(g.annotation)+'</span>':'')+
     (!graded?'<span class="facet-hold">채점 보류</span>':'')+'</div>'+
     '<div class="choice-grid" role="group" aria-label="'+escapeHtml(token+" "+g.label)+'">'+
     g.choices.map(v=>'<button type="button" class="choice-button'+(v===value?' is-selected':'')+
       '" data-kind="facet" data-facet-id="'+escapeHtml(g.id)+'" data-index="'+i+
       '" value="'+escapeHtml(v)+'" aria-pressed="'+(v===value?'true':'false')+
       '">'+escapeHtml(v)+'</button>').join("")+'</div></div>';
 }).join("");
};
let currentQuestionForFacets=null;
const labelSelect=(values,selected="",kind="",index="")=>
 '<select data-kind="'+kind+'" data-index="'+index+'" aria-label="'+escapeHtml(kind==="pos"?"품사 선택":kind==="subtype"?"세부 품사 선택":kind==="caseType"?"격조사 세부 종류 선택":kind==="role"?"문장 성분 선택":"서술어 자릿수 선택")+'">'+
 '<option value="">선택하세요</option>'+values.map(x=>'<option value="'+escapeHtml(x)+'"'+(String(x)===String(selected)?" selected":"")+">"+escapeHtml(x)+"</option>").join("")+'</select>';
// Visible answer choices: no native select menu is needed for classification.
const choiceButtons=(values,selected,kind,index,label)=>{
  return '<div class="choice-grid" role="group" aria-label="'+escapeHtml(label)+'">'+
   values.map(value=>'<button type="button" class="choice-button'+(String(value)===String(selected)?' is-selected':'')+
    '" data-kind="'+kind+'" data-index="'+index+'" value="'+escapeHtml(value)+'" aria-pressed="'+
    (String(value)===String(selected)?'true':'false')+'">'+escapeHtml(value)+'</button>').join('')+'</div>';
};
const editorButtons=(values,selected,attribute,key,label)=>{
  return '<div class="choice-grid editor-choices" role="group" aria-label="'+escapeHtml(label)+'">'+
    values.map(value=>'<button type="button" class="choice-button'+(String(value)===String(selected)?' is-selected':'')+
    '" '+attribute+'="'+escapeHtml(key)+'" value="'+escapeHtml(value)+'" aria-pressed="'+
    (String(value)===String(selected)?'true':'false')+'">'+escapeHtml(value)+'</button>').join('')+'</div>';
};
function posUnits(q){return q.chunks.flatMap((c,ci)=>c.parts.map((p,pi)=>({...p,chunkIndex:ci,partIndex:pi})))}
function renderTask(){
 const q=current(),config=MODES.find(m=>m.id===mode),a=response(),result=graded[activeKey()];
 currentQuestionForFacets=q;
 $("taskKicker").textContent=config.kicker;
 $("taskTitle").textContent=config.title;
 $("taskIntro").textContent=config.intro;
 $("actionMessage").textContent=q.origin==="automatic"?"자동 분석 추정 정답 기준 · 낮은 신뢰도 항목은 채점 보류":q.id.startsWith("custom-")?"기존 사용자 정답표 기준":"";
 let html="";
 if(mode==="pos"){
   html='<div class="mode-instruction">선택 메뉴 없이 모든 품사의 <b>프린트 기준 세부 분류</b>를 버튼으로 판별하세요. 명사는 2개 분류 축이 있으며, 용언의 활용 종류는 품사와 별도의 학습 분류입니다. 자동 분석이 확정하지 못한 세부 항목은 채점 보류됩니다.</div><div class="token-list">'+
   posUnits(q).map((u,i)=>{
     const mark=result?result.details.find(d=>d.index===i):null;
     return '<div class="token'+(mark&&!mark.skipped?(mark.correct?' correct':' incorrect'):'')+'">'+
       '<div class="token-identity"><div class="token-caption">단어 '+String(i+1).padStart(2,'0')+'</div>'+
       '<div class="token-word">'+escapeHtml(u.t)+'</div>'+ (u.gradeable===false?'<div class="grade-hold">채점 보류</div>':'')+'</div>'+
       '<div class="token-answers"><div class="token-detail-label">품사</div>'+
       choiceButtons(POS,a.values[i]||'','pos',i,u.t+'의 품사')+
       (SUBTYPES[a.values[i]]?'<div class="token-detail-label nested-label">세부 분류</div>'+
          choiceButtons(SUBTYPES[a.values[i]],a.subtypes[i]||'','subtype',i,u.t+'의 세부 분류'):'')+
       (a.values[i]==='조사'&&a.subtypes[i]==='격조사'?
          '<div class="token-detail-label nested-label">격조사 종류</div>'+
          choiceButtons(CASE_TYPES,a.caseTypes[i]||'','caseType',i,u.t+'의 격조사 종류'):'')+
       choiceFacets(a.values[i],a,i,u.t)+
       (mark&&u.gradeable!==false?'<div class="'+(mark.correct?'correct-answer':'wrong-answer')+'">정답 · '+
          escapeHtml(expectedPosPath(u).join(' → ')+scoredFacets(u).map(g=>' / '+g.label+': '+expectedFacets(u)[g.id]).join(''))+'</div>':'')+
       '</div></div>';
   }).join('')+'</div>';
 }else if(mode==="syntax"){
   html='<div class="mode-instruction">각 문장 요소의 역할을 눌러 선택하세요. 품사와 문장 성분은 서로 다른 개념입니다.</div><div class="token-list">'+
     q.chunks.map((c,i)=>{
      const mark=result?result.details.find(d=>d.index===i):null;
      return '<div class="token'+(mark&&!mark.skipped?(mark.correct?' correct':' incorrect'):'')+'">'+
        '<div class="token-identity"><div class="token-caption">성분 '+String(i+1).padStart(2,'0')+'</div>'+
        '<div class="token-word">'+escapeHtml(c.t)+'</div>'+ (c.gradeable===false?'<div class="grade-hold">채점 보류</div>':'')+'</div>'+
        '<div class="token-answers"><div class="token-detail-label">문장 성분</div>'+
        choiceButtons(ROLES,a.values[i]||'','role',i,c.t+'의 문장 성분')+
        (mark&&c.gradeable!==false?'<div class="'+(mark.correct?'correct-answer':'wrong-answer')+'">정답 · '+escapeHtml(c.role)+'</div>':'')+
        '</div></div>';
     }).join('')+'</div>';
 }else if(mode==="slots"){
   html=(q.slotsGradeable===false?'<div class="grade-hold-block">이 문장의 서술어 자릿수는 신뢰성 있게 확인되지 않아 채점하지 않습니다.</div>':'')+'<div class="mode-instruction">필수 성분은 서술어가 문장을 구성할 때 요구하는 논항입니다. 여기서는 <b>서술어 자체를 선택하지 않습니다.</b> 부사어도 필수적일 수 있어요.</div>'+
   '<div class="slot-question"><strong>이 문장의 서술어는 몇 자리인가요?</strong>'+
   choiceButtons(["1","2","3"],a.slotCount||"","slot","0","서술어 자릿수")+'</div>'+
   '<div class="required-list">'+q.chunks.map((c,i)=>c.role==="서술어"?"":'<label class="required-option"><input type="checkbox" data-kind="required" data-index="'+i+'" '+(a.required[i]?"checked ":"")+'/><span>'+escapeHtml(c.t)+'</span></label>').join("")+'</div>';
 }else if(mode==="morph"){
   html=(q.morph?.gradeable===false?'<div class="grade-hold-block">이 문장의 형태소 경계는 활용·축약으로 인해 판정을 보류합니다.</div>':'')+'<div class="mode-instruction">형태소는 뜻을 가진 가장 작은 말의 단위입니다. /로 나누고, 정답 아래에서 자립·의존 및 실질·형식 분류도 확인하세요.</div>'+
   '<div class="morph-word">'+escapeHtml(q.morph.word)+'</div>'+
   '<label class="visually-hidden" for="morphInput">형태소 분리 결과</label>'+
   '<input id="morphInput" class="morph-entry" data-kind="morph" type="text" autocomplete="off" spellcheck="false" placeholder="예: 철수/가" value="'+escapeHtml(a.morph||"")+'"/>'+
   '<div class="morph-hint">띄어쓰기는 채점에서 무시합니다. 예: 철수/가, 선생님/께</div>';
 }
 $("answerArea").innerHTML=html;
 $("answerArea").querySelectorAll("[data-kind]").forEach(el=>{el.disabled=!!result});
 const total = mode==="pos"?posTally(q,a).total:mode==="syntax"?q.chunks.filter(c=>c.gradeable!==false).length:mode==="slots"?(q.slotsGradeable===false?0:q.chunks.filter(c=>c.needed).length+1):(q.morph?.gradeable===false?0:1);
 let filled;
 if(mode==="slots")filled=(a.slotCount?1:0)+q.chunks.reduce((n,c,i)=>n+(c.role!=="서술어"&&a.required[i]?1:0),0);
 else if(mode==="morph")filled=a.morph?.trim()?1:0;
 else if(mode==="pos")filled=posTally(q,a).filled;
 else filled=Object.values(a.values).filter(Boolean).length;
 $("taskProgress").textContent=(total?Math.min(filled,total):0)+" / "+total;
 $("checkBtn").disabled=!!result||total===0;
 $("retryBtn").disabled=!result&&filled===0;
 renderFeedback(result,q);
}
function renderFeedback(result,q){
 const el=$("feedback");
 if(!result){el.hidden=true;el.innerHTML="";return;}
 el.hidden=false;
 const pct=result.total?Math.round((result.score/result.total)*100):0;
 const formatExplanation=e=>{
  if(!e)return "";
  return '<div class="feedback-explanation">'+
    '<div class="feedback-explanation-row"><b>왜 틀렸을까?</b><p>'+escapeHtml(e.diagnosis)+'</p></div>'+
    '<div class="feedback-explanation-row"><b>문법 원리</b><p>'+escapeHtml(e.principle)+'</p></div>'+
    '<div class="feedback-explanation-row"><b>다음에는 이렇게 판별</b><p>'+escapeHtml(e.check)+'</p></div>'+
    '</div>';
 };
 const details=result.details.map(d=>{
  if(d.skipped)return '<div class="feedback-detail skipped"><strong>'+escapeHtml(d.label)+' — 판정 보류</strong><p>'+escapeHtml(d.reason)+'</p></div>';
  const state=d.correct?"good":"bad";
  const title=d.correct?" — 정답":" — 선택: "+(d.chosen||"미응답")+" / 정답: "+d.expected;
  return '<div class="feedback-detail '+state+'"><strong>'+
   escapeHtml(d.label+title)+'</strong>'+
   (!d.correct&&d.explanation?formatExplanation(d.explanation):
    '<p>'+escapeHtml(d.reason||"정답표와 일치합니다.")+'</p>')+'</div>';
 }).join("");
 const customNote=q.origin==="automatic"?
  '<div class="feedback-source-note"><strong>자동 분석의 잠정 정답</strong> 형태소 모델과 문장 규칙이 추정한 결과입니다. 복잡한 문장에서는 오분석 가능성이 있으며, 확실하지 않은 항목은 점수에서 제외했습니다.</div>':isCustomAnswer(q)?
  '<div class="feedback-source-note"><strong>사용자 정답표 기준</strong> 이 문장의 정답은 사용자가 직접 지정했습니다. 아래 풀이에는 공통 문법 규칙을 적용하지만, 저장된 정답 자체가 옳은지까지 자동 검증하지는 않습니다.</div>':"";
 el.innerHTML='<div class="feedback-head"><div class="feedback-score '+(pct<70?"low":"")+'">'+result.score+' / '+result.total+'</div><div class="feedback-title">'+
  (result.total===0?"이 영역은 판정 근거가 부족해 채점을 보류했습니다.":pct===100?"좋아요. 채점 가능한 항목을 모두 맞혔습니다.":pct>=70?"좋아요. 틀린 항목의 판별 원리를 확인하세요.":"표시된 오답 해설을 읽고 다시 도전해 보세요.")+'</div></div>'+
  customNote+
  '<div class="feedback-detail"><strong>문장 해설</strong><p>'+escapeHtml(q.overview)+'</p></div>'+details;
}
function grade(){
 const q=current(),a=response(),key=activeKey();if(graded[key])return;
 let details=[],score=0,total=0;
 if(mode==="pos"){
  const units=posUnits(q);
  details=units.map((p,i)=>{
    if(p.gradeable===false)return {index:i,label:p.t,skipped:true,reason:"근거가 불확실해 품사 채점을 보류했습니다."};
    const expectedPath=expectedPosPath(p),chosenPath=chosenPosPath(a,i),
      facetsExpected=expectedFacets(p),facetsChosen=facetAnswer(a,i),axes=scoredFacets(p);
    let points=0;
    for(let k=0;k<expectedPath.length;k++){
      if(expectedPath[k]!==chosenPath[k])break;
      points++;
    }
    const pathCorrect=points===expectedPath.length;
    let firstFacetError=null;
    for(const g of axes){
      if(pathCorrect && facetsChosen[g.id]===facetsExpected[g.id])points++;
      else if(!firstFacetError)firstFacetError={group:g,chosen:facetsChosen[g.id]||"",expected:facetsExpected[g.id]};
    }
    const maximum=expectedPath.length+axes.length;
    total+=maximum;score+=points;
    const expected=expectedPath.join(" → ")+axes.map(g=>" / "+g.label+": "+facetsExpected[g.id]).join("");
    const chosen=chosenPath.filter(Boolean).join(" → ")+axes.map(g=>" / "+g.label+": "+(facetsChosen[g.id]||"미응답")).join("");
    const correct=points===maximum;
    return {index:i,label:p.t,chosen,expected,correct,
      reason:p.why||"이 형태가 문장에서 나타내는 어휘적·문법적 기능으로 품사를 판별합니다.",
      explanation:correct?null:!pathCorrect?explainPartOfSpeech(q,p,chosenPath):
       explainFacet(q,p,firstFacetError.group,firstFacetError.chosen,firstFacetError.expected)};
  });
 }else if(mode==="syntax"){
  total=q.chunks.filter(c=>c.gradeable!==false).length;
  details=q.chunks.map((c,i)=>{
    if(c.gradeable===false)return {index:i,label:c.t,skipped:true,reason:"격 관계가 모호해 문장 성분 채점을 보류했습니다."};
    const chosen=a.values[i]||"",correct=chosen===c.role;if(correct)score++;
    return {index:i,label:c.t,chosen,expected:c.role,correct,reason:c.why,
      explanation:correct?null:explainSentenceRole(q,c,chosen)};
  });
 }else if(mode==="slots"){
  total=q.slotsGradeable===false?0:q.chunks.filter(c=>c.needed).length+1;
  if(q.slotsGradeable===false){details=[{skipped:true,label:"서술어 자릿수",reason:"명확한 필수 성분 관계가 없어 잠정 분석 결과만 제공합니다."}];}
  else {
  const chosen=a.slotCount||"";
  const correct=String(q.slots)===String(chosen);
  if(correct)score++;
  details=[{label:"서술어 자릿수",chosen:chosen?chosen+"자리":"",expected:q.slots+"자리",correct,reason:q.overview,
   explanation:correct?null:explainValency(q,chosen)}];
  q.chunks.forEach((c,i)=>{
    if(c.role==="서술어")return;
    const picked=!!a.required[i];if(c.needed&&picked)score++;
    if(c.needed||picked)details.push({label:c.t,chosen:picked?"필수 성분 선택":"선택하지 않음",
      expected:c.needed?"필수 성분":"수의적 성분",correct:picked===c.needed,reason:c.why,
      explanation:picked===c.needed?null:explainRequired(q,c,picked)});
    if(!c.needed&&picked)score--;
  });
  score=Math.min(total,Math.max(0,score));
  }
 }else{
  total=q.morph?.gradeable===false?0:1;
  if(!total){details=[{label:q.morph?.word||"형태소",skipped:true,reason:q.morph?.note||"자동 분절이 불확실하여 채점 보류"}];}
  else {
  const normalizeMorph=s=>String(s||"").replace(/\s+/g,"").replace(/[|｜]/g,"/").replace(/\/+/g,"/").replace(/^\/|\/$/g,"");
  const chosen=normalizeMorph(a.morph),expected=normalizeMorph(q.morph.answer),correct=chosen===expected;
  score=correct?1:0;
  const units=expected.split("/");
  const typeNotes=units.map((s,i)=>s+" = "+(q.morph.types[i]||"분류 확인 필요")).join(" / ");
  details=[{label:q.morph.word,chosen:a.morph||"",expected:q.morph.answer,correct,
    reason:q.morph.note+" 형태소 분류: "+typeNotes,
    explanation:correct?null:explainMorphology(q,a.morph)}];
  }
 }
 const result={score,total,details};
 graded[key]=result;
 history.push({id:q.id,mode,score,total,at:Date.now(),text:q.chunks.map(c=>c.t).join(" ")});
 if(history.length>300)history=history.slice(-300);
 persist(STORAGE_HISTORY,history);
 renderTask();
 $("actionMessage").textContent="채점 완료 · 신뢰도 높은 항목만 점수에 포함했어요.";
}
function retry(){
 const key=activeKey();delete answers[key];delete graded[key];renderTask();$("actionMessage").textContent="답안을 초기화했어요.";
}
function showView(view){
 currentView=view;
 document.querySelectorAll("[data-view]").forEach(el=>{
  const active=el.dataset.view===view;el.classList.toggle("is-active",active);
  if(active)el.setAttribute("aria-current","page");else el.removeAttribute("aria-current");
 });
 for(const v of ["practice","studio","records"]){
  const el=$(v+"View");el.hidden=v!==view;el.classList.toggle("active",v===view);
 }
 if(view==="records")renderRecords();
 window.scrollTo({top:0,behavior:"auto"});
}
function renderRecords(){
 const attempts=history.length,sum=history.reduce((n,r)=>n+r.score,0),max=history.reduce((n,r)=>n+r.total,0);
 $("recordSummary").innerHTML=[
  ["채점 횟수",attempts+"회"],["평균 정답률",max?Math.round(sum/max*100)+"%":"—"],["분석한 문장",custom.length+"개"]
 ].map(v=>'<div class="record-stat"><strong>'+v[1]+'</strong><span>'+v[0]+'</span></div>').join("");
 $("recordList").innerHTML=!history.length?'<div class="empty-state">아직 채점 기록이 없어요. 분석 연습을 시작해 보세요.</div>':
  history.slice(-20).reverse().map(r=>'<div class="record-row"><div>'+escapeHtml(r.text)+
   '<div><small>'+escapeHtml(MODES.find(m=>m.id===r.mode)?.title||r.mode)+' · '+new Date(r.at).toLocaleString("ko-KR")+'</small></div></div><b>'+r.score+"/"+r.total+"</b></div>").join("");
 $("customList").innerHTML=!custom.length?'<div class="empty-state">자동 분석한 문장이 아직 없습니다.</div>':
 custom.map(q=>'<div class="custom-row"><span>'+escapeHtml(q.chunks.map(c=>c.t).join(" "))+'</span>'+
 '<div><button type="button" data-open-custom="'+escapeHtml(q.id)+'">연습하기 ↗</button> '+
 '<button type="button" data-remove-custom="'+escapeHtml(q.id)+'">삭제</button></div></div>').join("");
}
function setup(){
 document.querySelectorAll("[data-view]").forEach(el=>el.addEventListener("click",()=>showView(el.dataset.view)));
 document.querySelectorAll(".mode-tab").forEach((el,i)=>{
  el.addEventListener("click",()=>setMode(el.dataset.mode));
  el.addEventListener("keydown",e=>{if(e.key==="ArrowRight"||e.key==="ArrowLeft"){
   e.preventDefault();const arr=[...document.querySelectorAll(".mode-tab")];const next=arr[(i+(e.key==="ArrowRight"?1:3))%4];next.focus();setMode(next.dataset.mode);
  }});
 });
 $("exampleSelect").addEventListener("change",e=>setCurrent(e.target.value));
 $("difficultySelect").addEventListener("change",refreshSelect);
 $("nextBtn").addEventListener("click",()=>{
  const list=visibleExamples();if(!list.length)return;const i=list.findIndex(q=>q.id===currentId);
  currentId=list[(i+1)%list.length].id;refreshSelect();
 });
 $("checkBtn").addEventListener("click",grade);
 $("retryBtn").addEventListener("click",retry);
 $("answerArea").addEventListener("click",e=>{
   const button=e.target.closest("button[data-kind]");
   if(button)handleAnswer({target:button});
 });
 $("answerArea").addEventListener("input",handleAnswer);
 $("answerArea").addEventListener("change",handleAnswer);
 $("studioForm").addEventListener("submit",async e=>{
  e.preventDefault();
  const input=$("customSentence").value.trim();
  const message=$("studioMessage"),button=$("analyzeBtn");
  if(!input)return;
  const existing=allExamples().find(q=>normalizeSentence(q.chunks.map(c=>c.t).join(" "))===normalizeSentence(input));
  if(existing){currentId=existing.id;$("difficultySelect").value="all";refreshSelect();showView("practice");return;}
  button.disabled=true;
  message.textContent="한국어 형태소 모델을 로드하고 문장 구조를 분석하는 중입니다…";
  try{
    const q=await analyzeUserSentence(input);
    custom.push(q);
    if(!persist(STORAGE_CUSTOM,custom))message.textContent="분석은 성공했지만 브라우저 저장에 실패했습니다.";
    currentId=q.id;
    $("customSentence").value="";
    $("difficultySelect").value="all";
    refreshSelect();setMode("pos");showView("practice");
    $("actionMessage").textContent="자동 분석 완료 · 불확실한 항목은 감점하지 않습니다.";
  }catch(error){
    console.error("Auto analysis failed",error);
    message.textContent="자동 분석을 시작하지 못했습니다. 새로고침 후 다시 시도해 주세요. ("+
      (error?.message||"모델 로드 오류")+")";
  }finally{button.disabled=false;}
 });
 $("clearRecords").addEventListener("click",()=>{if(!history.length)return;if(confirm("이 브라우저에 저장된 채점 기록을 삭제할까요?")){history=[];persist(STORAGE_HISTORY,history);renderRecords();}});
 $("customList").addEventListener("click",e=>{
  const open=e.target.closest("[data-open-custom]"),remove=e.target.closest("[data-remove-custom]");
  if(open){$("difficultySelect").value="all";currentId=open.dataset.openCustom;refreshSelect();showView("practice");}
  if(remove&&confirm("선택한 사용자 문장을 삭제할까요?")){
   custom=custom.filter(q=>q.id!==remove.dataset.removeCustom);
   persist(STORAGE_CUSTOM,custom);
   if(currentId===remove.dataset.removeCustom)currentId=EXAMPLES[0].id;
   refreshSelect();renderRecords();
  }
 });
 refreshSelect();
}
function handleAnswer(e){
 const t=e.target,kind=t.dataset.kind,index=Number(t.dataset.index),a=response();
 if(!kind||graded[activeKey()])return;
 if(kind==="pos"){
   if(a.values[index]!==t.value){
     a.values[index]=t.value;
     delete a.subtypes[index];delete a.caseTypes[index];delete a.facets[index];
   }
   renderTask();return;
 }else if(kind==="subtype"){
   a.subtypes[index]=t.value;delete a.caseTypes[index];renderTask();return;
 }else if(kind==="caseType"){a.caseTypes[index]=t.value;renderTask();return;}
 else if(kind==="facet"){
   const id=t.dataset.facetId, pos=a.values[index];
   const group=facetGroups(pos,facetAnswer(a,index)).find(g=>g.id===id);
   if(!group?.choices.includes(t.value))return;
   const per=a.facets[index]||={};
   per[id]=t.value;
   // Discard answers to now-hidden nested facets whenever a parent changes.
   for(const g of POS_FACETS[pos]||[]){
     if(g.id===id&&g.next){
       for(const child of Object.values(g.next))delete per[child.id];
     }
   }
   renderTask();return;
 }
 else if(kind==="role"){a.values[index]=t.value;renderTask();return;}
 else if(kind==="slot"){a.slotCount=t.value;renderTask();return;}
 else if(kind==="required")a.required[index]=t.checked;
 else if(kind==="morph")a.morph=t.value;
 const q=current();
 const max=mode==="pos"?posTally(q,a).total:mode==="syntax"?q.chunks.filter(c=>c.gradeable!==false).length:mode==="slots"?(q.slotsGradeable===false?0:q.chunks.filter(c=>c.needed).length+1):(q.morph?.gradeable===false?0:1);
 const filled=mode==="slots"?(a.slotCount?1:0)+q.chunks.reduce((n,c,i)=>n+(c.role!=="서술어"&&a.required[i]?1:0),0):
 mode==="morph"?(a.morph?.trim()?1:0):mode==="pos"?posTally(q,a).filled:Object.values(a.values).filter(Boolean).length;
 $("taskProgress").textContent=filled+" / "+max;
 $("retryBtn").disabled=filled===0;
}
setup();
