import {EXAMPLES,POS,ROLES,TYPES,MODES,SUBTYPES,CASE_TYPES,normalizeSentence,validateExamples} from "./data.mjs";
import {explainPartOfSpeech,explainSentenceRole,explainValency,explainRequired,explainMorphology,isCustomAnswer} from "./explanations.mjs";
import {analyzeUserSentence,ANALYSIS_VERSION} from "./model.mjs";
import {POS_FACETS,facetGroups,facetAnswersFor} from "./taxonomy.mjs";
import {explainFacet} from "./explanations.mjs";
import {explainFinalClassification} from "./explanations.mjs";
import {morphemeForm,morphemeLabel} from "./morphology.mjs";
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
const upgrading=new Set();
const automatic=q=>q.origin==="automatic"||q.id.startsWith("auto-");
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
 const prep=q.preprocessing;
 $("processingNote").textContent=prep?.corrections?.length?
   "입력: "+prep.original+" · 검사 후: "+prep.sentence+" · "+prep.corrections.map(c=>c.reason).join(" / "):"";
 renderTask();
 if(automatic(q)&&q.analysisVersion!==ANALYSIS_VERSION)upgradeAnalysis(q);
}
async function upgradeAnalysis(q){
 if(upgrading.has(q.id))return;
 upgrading.add(q.id);$("checkBtn").disabled=true;
 $("actionMessage").textContent="저장된 문장을 개선된 문맥 규칙으로 다시 분석하고 있어요…";
 try{
  const fresh=await analyzeUserSentence(q.preprocessing?.original||q.chunks.map(c=>c.t).join(" "),
   {correctSpelling:q.preprocessing?.correctSpelling!==false});
  fresh.id=q.id;fresh.analysisVersion=ANALYSIS_VERSION;
  const i=custom.findIndex(x=>x.id===q.id);if(i<0)return;
  custom[i]=fresh;
  for(const m of MODES){delete answers[q.id+":"+m.id];delete graded[q.id+":"+m.id];}
  persist(STORAGE_CUSTOM,custom);
  if(currentId===q.id){renderPractice();$("actionMessage").textContent="저장된 문장을 새 분석 규칙으로 갱신했어요.";}
 }catch{
  if(currentId===q.id)$("actionMessage").textContent="문장 재분석에 실패했습니다. 자유 문장 입력에서 다시 분석해 주세요.";
 }finally{upgrading.delete(q.id);}
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
function resolvedPart(part,a,index){
 const path=chosenPosPath(a,index);
 const alternative=path[0]===part.p&&part.alternativeDetails?.find(detail=>detail.every((v,i)=>v===path[i+1]));
 if(!alternative)return part;
 const facets={...part.facets,particleKind:alternative[0]};
 if(alternative[1])facets.caseKind=alternative[1];else delete facets.caseKind;
 return {...part,detail:alternative,facets,why:part.alternativeReason||part.why};
}
const expectedFacets=p=>facetAnswersFor(p);
const scoredFacets=p=>["조사","관형사"].includes(p.p)?[]:
 facetGroups(p.p,expectedFacets(p),p).filter(g=>!!expectedFacets(p)[g.id]);
const posTally = (q,a) => {
 const units=posUnits(q).map((p,i)=>resolvedPart(p,a,i)),eligible=units.filter(p=>p.gradeable!==false);
 const total=eligible.length;
 const filled=units.reduce((n,p,i)=>{
   if(p.gradeable===false)return n;
   const path=chosenPosPath(a,i);
   const facets=facetAnswer(a,i),groups=path[0]===p.p?scoredFacets(p):
     ['조사','관형사'].includes(path[0])?[]:facetGroups(path[0],facets,p);
   return n+(path.every(Boolean)&&groups.every(g=>!!facets[g.id])?1:0);
 },0);
 return {total,filled};
};
// One visible school-grammar word is one verdict, for every question source.
// Recompute from word verdicts so stale classification-level totals cannot leak
// into feedback, records, or the displayed denominator.
function wordResult(q,details){
 const words=posUnits(q).map((p,index)=>{
  const detail=details.find(d=>d.index===index)||{correct:false};
  return {...detail,index,label:p.t};
 });
 const eligible=words.filter(d=>!d.skipped);
 return {score:eligible.filter(d=>d.correct===true).length,total:eligible.length,details:words};
}
const choiceFacets=(pos,a,i,token,review=false)=>{
 if(!POS_FACETS[pos] || pos==="조사" || pos==="관형사")return "";
 const current=a.values[i]===pos?facetAnswer(a,i):{},unit=posUnits(currentQuestionForFacets)[i];
 const expected=unit?.p===pos?expectedFacets(unit):{};
 const groups=facetGroups(pos,current,unit);
 if(review&&unit?.p===pos)for(const g of facetGroups(pos,expected,unit)){
   if(!groups.some(x=>x.id===g.id))groups.push(g);
 }
 return groups.map(g=>{
   const graded=!!expected[g.id],value=current[g.id]||"";
   const wrongBranch=unit?.p!==pos||(POS_FACETS[pos]||[]).some(parent=>
     expected[parent.id]&&parent.next&&Object.values(parent.next).some(child=>child.id===g.id)&&
     current[parent.id]!==expected[parent.id]);
   return '<div class="facet-block"><div class="token-detail-label nested-label">'+escapeHtml(g.label)+
     (g.annotation?' <span class="facet-note">'+escapeHtml(g.annotation)+'</span>':'')+
     (!graded&&!wrongBranch?'<span class="facet-hold">채점 보류</span>':'')+'</div>'+
     choiceButtons(g.choices,value,'facet',i,token+" "+g.label,
       review&&(graded||wrongBranch)?{expected:expected[g.id],wrongBranch}:null,g.id)+'</div>';
 }).join("");
};
let currentQuestionForFacets=null;
const labelSelect=(values,selected="",kind="",index="")=>
 '<select data-kind="'+kind+'" data-index="'+index+'" aria-label="'+escapeHtml(kind==="pos"?"품사 선택":kind==="subtype"?"세부 품사 선택":kind==="caseType"?"격조사 세부 종류 선택":kind==="role"?"문장 성분 선택":"서술어 자릿수 선택")+'">'+
 '<option value="">선택하세요</option>'+values.map(x=>'<option value="'+escapeHtml(x)+'"'+(String(x)===String(selected)?" selected":"")+">"+escapeHtml(x)+"</option>").join("")+'</select>';
// Visible answer choices: no native select menu is needed for classification.
const choiceButtons=(values,selected,kind,index,label,review=null,facetId="")=>{
  return '<div class="choice-grid" role="group" aria-label="'+escapeHtml(label)+'">'+
   values.map(value=>{
    const picked=String(value)===String(selected);
    const correct=review?.expected!=null&&String(value)===String(review.expected);
    const wrong=!!review&&picked&&!correct&&(review.expected!=null||review.wrongBranch);
    const badge=correct?(picked?'내 선택 · 정답':'정답'):wrong?'내 선택':'';
    return '<button type="button" class="choice-button'+(picked?' is-selected':'')+
     (correct?' is-answer-correct':wrong?' is-answer-wrong':'')+
     '" data-kind="'+kind+'" data-index="'+index+'"'+(facetId?' data-facet-id="'+escapeHtml(facetId)+'"':'')+
     (correct||wrong?' data-answer-state="'+(correct?'correct':'wrong')+'" aria-label="'+escapeHtml(value+' · '+badge)+'"':'')+
     ' value="'+escapeHtml(value)+'" aria-pressed="'+(picked?'true':'false')+'">'+escapeHtml(value)+
     (badge?'<span class="choice-result-badge">'+badge+'</span>':'')+'</button>';
   }).join('')+'</div>';
};
function renderPosChoices(unit,a,i,mark){
 const review=!!mark&&!mark.skipped&&unit.gradeable!==false;
 const chosen=a.values[i]||"";
 if(review&&chosen!==unit.p)return renderAlignedClassification(unit,a,i);
 let html=choiceButtons(POS,chosen,'pos',i,unit.t+'의 품사',review?{expected:unit.p}:null);
 const branches=[...new Set([chosen,...(review?[unit.p]:[])])].filter(Boolean);
 for(const pos of branches){
  const pickedBranch=pos===chosen,expectedBranch=pos===unit.p;
  const subtype=pickedBranch?a.subtypes[i]||'':'';
  const expectedSubtype=expectedBranch?unit.detail?.[0]:undefined;
  if(review&&branches.length>1)html+='<div class="classification-branch-label">'+
    escapeHtml((expectedBranch?'정답 분류 · ':'선택한 분류 · ')+pos)+'</div>';
  if(SUBTYPES[pos])html+='<div class="token-detail-label nested-label">세부 분류</div>'+
    choiceButtons(SUBTYPES[pos],subtype,'subtype',i,unit.t+'의 '+pos+' 세부 분류',
      review?{expected:expectedSubtype,wrongBranch:!expectedBranch}:null);
  if(pos==='조사'&&(subtype==='격조사'||review&&expectedSubtype==='격조사'))html+=
    '<div class="token-detail-label nested-label">격조사 종류</div>'+
    choiceButtons(CASE_TYPES,pickedBranch?a.caseTypes[i]||'':'','caseType',i,unit.t+'의 격조사 종류',
      review?{expected:expectedBranch?unit.detail?.[1]:undefined,wrongBranch:!expectedBranch||expectedSubtype!=='격조사'}:null);
  html+=choiceFacets(pos,a,i,unit.t,review);
 }
 return html;
}
function renderAlignedClassification(unit,a,i){
 const levels=answer=>{
  const pos=answer?unit.p:a.values[i]||"",facets=answer?expectedFacets(unit):facetAnswer(a,i);
  const subtype=answer?unit.detail?.[0]:a.subtypes[i];
  const select=(values,value,kind,label,facetId="")=>choiceButtons(values,answer?'':value||'',kind,i,label,
    answer?{expected:value}:{wrongBranch:true},facetId);
  const blocks=[select(POS,pos,'pos',unit.t+' '+(answer?'정답':'사용자 답')+' 품사'),'', ''];
  if(SUBTYPES[pos])blocks[1]='<div class="comparison-group-label">세부 분류</div>'+
    select(SUBTYPES[pos],subtype,'subtype',unit.t+' '+pos+' 세부 분류');
  if(pos==='조사'&&subtype==='격조사')blocks[2]=select(CASE_TYPES,answer?unit.detail?.[1]:a.caseTypes[i],
    'caseType',unit.t+' 격조사 종류');
  if(pos!=='조사'&&pos!=='관형사')for(const group of facetGroups(pos,facets,unit)){
   const depth=(POS_FACETS[pos]||[]).some(g=>g.id===group.id)?1:2;
   blocks[depth]+='<div class="comparison-group-label">'+escapeHtml(group.label)+'</div>'+
    (answer&&!facets[group.id]?'<p class="comparison-empty">해당 없음</p>':
     select(group.choices,facets[group.id],'facet',unit.t+' '+group.label,group.id));
  }
  return blocks;
 };
 const chosen=levels(false),expected=levels(true),labels=['1차 · 품사','2차 · 세부 분류','3차 · 세부 종류'];
 return '<div class="classification-compare-scroll" tabindex="0" aria-label="'+escapeHtml(unit.t)+'의 계층별 답 비교">'+
  '<table class="classification-compare-table"><thead><tr><th scope="col">분류 단계</th><th scope="col" class="answer-column-user">사용자 답</th><th scope="col" class="answer-column-correct">정답</th></tr></thead><tbody>'+
  labels.map((label,depth)=>!chosen[depth]&&!expected[depth]?'':'<tr><th scope="row">'+label+'</th>'+
    [chosen[depth],expected[depth]].map(content=>'<td>'+ (content||'<span class="comparison-empty">해당 단계 없음</span>')+'</td>').join('')+'</tr>').join('')+
  '</tbody></table></div>';
}
function explanationCard(index,label,mark){
 return mark?'<button type="button" class="explanation-trigger" data-explanation-index="'+index+
   '" aria-haspopup="dialog" aria-label="'+escapeHtml(label)+' 해설"><span class="explanation-card-kicker">'+
   (mark.skipped?'판정 보류':mark.correct?'정답 근거':'답 비교')+'</span><strong>해설</strong><span>이유 살펴보기 ↗</span></button>':'';
}
const editorButtons=(values,selected,attribute,key,label)=>{
  return '<div class="choice-grid editor-choices" role="group" aria-label="'+escapeHtml(label)+'">'+
    values.map(value=>'<button type="button" class="choice-button'+(String(value)===String(selected)?' is-selected':'')+
    '" '+attribute+'="'+escapeHtml(key)+'" value="'+escapeHtml(value)+'" aria-pressed="'+
    (String(value)===String(selected)?'true':'false')+'">'+escapeHtml(value)+'</button>').join('')+'</div>';
};
function posUnits(q){return q.chunks.flatMap((c,ci)=>c.parts.map((p,pi)=>({...p,chunkIndex:ci,partIndex:pi})))}
function renderTask(){
 if(automatic(current())&&current().analysisVersion!==ANALYSIS_VERSION){
  $("answerArea").innerHTML='<p class="mode-instruction">저장된 문장을 새 분석기로 다시 나누고 있어요…</p>';
  $("feedback").hidden=true;$("checkBtn").disabled=true;$("taskProgress").textContent="분석 중";
  upgradeAnalysis(current());return;
 }
 const q=current(),config=MODES.find(m=>m.id===mode),a=response(),result=graded[activeKey()];
 currentQuestionForFacets=q;
 $("taskKicker").textContent=config.kicker;
 $("taskTitle").textContent=config.title;
 $("taskIntro").textContent=config.intro;
 $("actionMessage").textContent=q.origin==="automatic"?"형태소·문맥 분석으로 만든 추정 정답을 기준으로 채점해요.":q.id.startsWith("custom-")?"기존 사용자 정답표 기준":"";
 let html="";
 if(mode==="pos"){
   html='<div class="mode-instruction">모든 품사의 <b>프린트 기준 세부 분류</b>를 버튼으로 판별하세요. 명사는 이름의 범위와 자립성을 각각 선택하고, 용언은 활용 방식도 구분하세요.</div><div class="token-list">'+
   posUnits(q).map((u,i)=>{
     u=resolvedPart(u,a,i);
     const mark=result?result.details.find(d=>d.index===i):null;
     return '<div class="token'+(mark?' token-review':'')+(mark&&!mark.skipped?(mark.correct?' correct':' incorrect'):'')+'">'+
       '<div class="token-identity"><div class="token-caption">단어 '+String(i+1).padStart(2,'0')+'</div>'+
       '<div class="token-word">'+escapeHtml(u.t)+'</div>'+ (u.gradeable===false?'<div class="grade-hold">채점 보류</div>':'')+'</div>'+
       '<div class="token-answers"><div class="token-detail-label">품사</div>'+
       renderPosChoices(u,a,i,mark)+
       (mark&&u.gradeable!==false?'<div class="'+(mark.correct?'correct-answer':'wrong-answer')+'">정답 · '+
          escapeHtml(expectedPosPath(u).at(-1)+scoredFacets(u).map(g=>' / '+g.label+': '+expectedFacets(u)[g.id]).join(''))+'</div>':'')+
       '</div>'+explanationCard(i,u.t,mark)+'</div>';
   }).join('')+'</div>';
 }else if(mode==="syntax"){
   html='<div class="mode-instruction">각 문장 요소의 역할을 눌러 선택하세요. 품사와 문장 성분은 서로 다른 개념입니다.</div><div class="token-list">'+
     q.chunks.map((c,i)=>{
      const mark=result?result.details.find(d=>d.index===i):null;
      const expected=c.alternativeRoles?.includes(a.values[i])?a.values[i]:c.role;
      return '<div class="token'+(mark?' token-review':'')+(mark&&!mark.skipped?(mark.correct?' correct':' incorrect'):'')+'">'+
        '<div class="token-identity"><div class="token-caption">성분 '+String(i+1).padStart(2,'0')+'</div>'+
        '<div class="token-word">'+escapeHtml(c.t)+'</div>'+ (c.gradeable===false?'<div class="grade-hold">채점 보류</div>':'')+'</div>'+
        '<div class="token-answers"><div class="token-detail-label">문장 성분</div>'+
        choiceButtons(ROLES,a.values[i]||'','role',i,c.t+'의 문장 성분',mark&&!mark.skipped?{expected}:null)+
        (mark&&c.gradeable!==false?'<div class="'+(mark.correct?'correct-answer':'wrong-answer')+'">정답 · '+escapeHtml(expected)+'</div>':'')+
        '</div>'+explanationCard(i,c.t,mark)+'</div>';
     }).join('')+'</div>';
 }else if(mode==="slots"){
   html=(q.slotsGradeable===false?'<div class="grade-hold-block">이 문장의 서술어 자릿수는 신뢰성 있게 확인되지 않아 채점하지 않습니다.</div>':'')+'<div class="mode-instruction">필수 성분은 서술어가 문장을 구성할 때 요구하는 논항입니다. 여기서는 <b>서술어 자체를 선택하지 않습니다.</b> 부사어도 필수적일 수 있어요.</div>'+
   '<div class="slot-question"><strong>이 문장의 서술어는 몇 자리인가요?</strong>'+
   choiceButtons(["1","2","3"],a.slotCount||"","slot","0","서술어 자릿수",result&&q.slotsGradeable!==false?{expected:q.slots}:null)+'</div>'+
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
 if(mode==='pos')result=wordResult(q,result.details);
 el.hidden=false;
 const pct=result.total?Math.round((result.score/result.total)*100):0;
 const customNote=q.origin==="automatic"?
  '<div class="feedback-source-note"><strong>자동 분석의 잠정 정답</strong> 형태소 모델·사전·문맥 규칙으로 추정한 결과를 기준으로 채점했습니다. 자세한 판별 근거는 각 해설에서 확인하세요.</div>':isCustomAnswer(q)?
  '<div class="feedback-source-note"><strong>사용자 정답표 기준</strong> 이 문장의 정답은 사용자가 직접 지정했습니다. 아래 풀이에는 공통 문법 규칙을 적용하지만, 저장된 정답 자체가 옳은지까지 자동 검증하지는 않습니다.</div>':"";
 el.innerHTML='<div class="feedback-head"><div class="feedback-score '+(pct<70?"low":"")+'">'+result.score+' / '+result.total+'</div><div class="feedback-title">'+
   (result.total===0?"이 영역은 판정 근거가 부족해 채점을 보류했습니다.":mode==='pos'?result.total+'개 단어 중 '+result.score+'개 정답':pct===100?"좋아요. 채점 가능한 항목을 모두 맞혔습니다.":"해설 카드를 열어 선택과 정답의 차이를 확인하세요.")+'</div></div>'+
  (mode==='pos'?'<div class="word-results" role="group" aria-label="단어별 정답 확인">'+result.details.map(d=>
   '<button type="button" class="word-result '+(d.skipped?'pending':d.correct?'good':'bad')+'" data-word-result="'+
   (d.skipped?'pending':d.correct?'correct':'incorrect')+'" data-explanation-index="'+d.index+'" aria-haspopup="dialog" aria-label="'+
   escapeHtml(d.label+' · '+(d.skipped?'판정 보류':d.correct?'정답':'오답'))+'"><span>'+escapeHtml(d.label)+
   '</span><b aria-hidden="true">'+(d.skipped?'—':d.correct?'O':'X')+'</b></button>').join('')+'</div>':'')+
  customNote+
  '<div class="feedback-summary-actions"><p>각 분류 표 옆의 해설 카드에서 선택 비교와 문법 근거를 확인하세요.</p>'+
   '<button type="button" class="button button-outline" data-explanation-index="sentence" aria-haspopup="dialog">문장·형태소 해설 ↗</button></div>'+
   (!['pos','syntax'].includes(mode)?'<div class="feedback-card-list">'+result.details.map((d,i)=>explanationCard(i,d.label,d)).join('')+'</div>':'');
}
const explanationTable=(headers,rows)=>'<div class="explanation-table-scroll"><table class="explanation-table"><thead><tr>'+
 headers.map(h=>'<th scope="col">'+escapeHtml(h)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(row=>'<tr>'+
 row.map((v,i)=>(i===0?'<th scope="row">':'<td>')+escapeHtml(v??'—')+(i===0?'</th>':'</td>')).join('')+'</tr>').join('')+'</tbody></table></div>';
const explanationSection=(title,content)=>'<section class="explanation-section"><h3>'+escapeHtml(title)+'</h3>'+content+'</section>';
function classificationRows(q,index){
 const a=response(),part=resolvedPart(posUnits(q)[index],a,index),chosen=a.values[index]||'미응답';
 const rows=[['품사',chosen,part.p]];
 if(a.subtypes[index]||part.detail?.[0])rows.push(['세부 분류',a.subtypes[index]||'해당 없음',part.detail?.[0]||'해당 없음']);
 if(a.caseTypes[index]||part.detail?.[1])rows.push(['격조사 종류',a.caseTypes[index]||'해당 없음',part.detail?.[1]||'해당 없음']);
 const expected=expectedFacets(part),selected=facetAnswer(a,index);
 const groups=[...(!['조사','관형사'].includes(chosen)?facetGroups(chosen,selected,part):[]),
  ...(!['조사','관형사'].includes(part.p)?facetGroups(part.p,expected,part):[])];
 const ids=new Set();
 for(const g of groups)if(!ids.has(g.id)){
  ids.add(g.id);rows.push([g.label,selected[g.id]||'미응답',expected[g.id]||'해당 없음']);
 }
 return rows;
}
let explanationReturnFocus=null;
function openExplanation(index,trigger=null){
 const q=current(),result=graded[activeKey()];if(!result)return;
 let html='';
 if(index==='sentence'){
  $('explanationTitle').textContent='문장·형태소 해설';
  html=explanationSection('문장 전체 풀이',explanationTable(['항목','설명'],[
   ['문장',q.chunks.map(c=>c.t).join(' ')],['분석',q.overview],['기준',q.source||'학습용 기본 문제'],
   ...(q.notes||[]).map(note=>['문맥 판별',note])]))+renderMorphology(q);
 }else{
  const detail=result.details[Number(index)];if(!detail)return;
  $('explanationTitle').textContent=detail.label+' · 해설';
  html='<p class="explanation-verdict '+(detail.skipped?'pending':detail.correct?'good':'bad')+'">'+
   (detail.skipped?'판정 보류':detail.correct?'정답 · 근거를 확인하세요':'오답 · 분류 기준을 비교해 보세요')+'</p>';
  if(detail.skipped)html+=explanationSection('판정을 보류한 이유',explanationTable(['항목','설명'],[['판정 근거',detail.reason],['채점','이 항목은 점수에서 제외합니다.']]));
  else{
   const rows=mode==='pos'?classificationRows(q,Number(index)):[['답안',detail.chosen||'미응답',detail.expected]];
   html+=explanationSection('사용자 답과 정답',explanationTable(['분류 기준','사용자 답','정답'],rows));
   const e=detail.explanation;
   if(e?.diagnosis)html+=explanationSection('왜 틀렸을까?','<p>'+escapeHtml(e.diagnosis)+'</p>');
   const part=mode==='pos'?resolvedPart(posUnits(q)[Number(index)],response(),Number(index)):null;
   html+=explanationSection('문법 원리',explanationTable(['확인할 내용','설명'],[
    ['최종 분류',part?expectedPosPath(part).at(-1):detail.expected],
    ['판별 기준',(e?.principle||detail.reason||'').split(' 이 문장의 단서:')[0]],
    ['문장 속 단서',part?.why||detail.reason||q.overview],
    ...(q.origin==='automatic'?[['분석 기준',part?.confidence==='context'?'사전 밖 표현을 문장 속 쓰임으로 추정한 정답입니다.':'형태소 태그와 문맥 규칙을 조합한 추정 정답입니다.']]:[]),
    ...(part?.alternativeReason?[['가능한 다른 해석',part.alternativeReason]]:[])]));
   if(part?.morphemes?.length)html+=renderMorphology({morphology:[{surface:part.t,tokens:part.morphemes,
    rules:[part.inflection?.reason||part.why].filter(Boolean)}]});
   if(e?.check)html+=explanationSection('다음에는 이렇게 판별',explanationTable(['단계','확인 방법'],[['다시 살펴보기',e.check]]));
  }
  html+=explanationSection('문장 맥락',explanationTable(['원문','전체 풀이'],[[q.chunks.map(c=>c.t).join(' '),q.overview]]));
 }
 $('explanationBody').innerHTML=html;
 explanationReturnFocus=trigger;
 const dialog=$('explanationDialog');if(!dialog.open)dialog.showModal();
 $('explanationBody').scrollTop=0;
}
function renderMorphology(q){
 if(!q.morphology?.length)return "";
 return '<details class="morph-analysis" open><summary>형태소 분리와 복원 근거</summary>'+
  (q.modelWarning?'<p>'+escapeHtml(q.modelWarning)+'</p>':'')+
  '<div class="analysis-table-scroll"><table><thead><tr><th scope="col">표면형</th><th scope="col">형태소</th><th scope="col">분류</th><th scope="col">분리 근거</th></tr></thead>'+
  q.morphology.map(w=>'<tbody>'+w.tokens.map((t,i)=>'<tr>'+(i===0?'<th scope="rowgroup" rowspan="'+w.tokens.length+'">'+escapeHtml(w.surface)+'</th>':'')+
   '<td>'+escapeHtml(morphemeForm(t))+'</td><td>'+escapeHtml(morphemeLabel(t))+'</td>'+
   (i===0?'<td rowspan="'+w.tokens.length+'">'+escapeHtml(w.rules.join('; ')||'형태소 모델의 문맥 분석')+'</td>':'')+'</tr>').join('')+'</tbody>').join('')+
  '</table></div><p>어간 뒤에는 ‘-’, 어미 앞에는 ‘-’를 붙여 경계를 표시합니다. 어미는 독립된 품사가 아니며, 이-는 서술격 조사 ‘이다’의 어간입니다.</p></details>';
}
function grade(){
 if(automatic(current())&&current().analysisVersion!==ANALYSIS_VERSION){upgradeAnalysis(current());return;}
 const q=current(),a=response(),key=activeKey();if(graded[key])return;
 let details=[],score=0,total=0;
 if(mode==="pos"){
  const units=posUnits(q);
  details=units.map((p,i)=>{
    p=resolvedPart(p,a,i);
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
    const expected=expectedPath.at(-1)+axes.map(g=>" / "+g.label+": "+facetsExpected[g.id]).join("");
    const chosen=(chosenPath.filter(Boolean).at(-1)||"미응답")+axes.map(g=>" / "+g.label+": "+(facetsChosen[g.id]||"미응답")).join("");
    const correct=points===maximum;
    return {index:i,label:p.t,chosen,expected,correct,
      reason:explainFinalClassification(q,p),
      explanation:correct?null:!pathCorrect?explainPartOfSpeech(q,p,chosenPath):
       explainFacet(q,p,firstFacetError.group,firstFacetError.chosen,firstFacetError.expected)};
  });
 }else if(mode==="syntax"){
  total=q.chunks.filter(c=>c.gradeable!==false).length;
  details=q.chunks.map((c,i)=>{
    if(c.gradeable===false)return {index:i,label:c.t,skipped:true,reason:"격 관계가 모호해 문장 성분 채점을 보류했습니다."};
    const chosen=a.values[i]||"",expected=c.alternativeRoles?.includes(chosen)?chosen:c.role,correct=chosen===expected;if(correct)score++;
    return {index:i,label:c.t,chosen,expected,correct,reason:expected!==c.role?c.alternativeReason:c.why,
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
 const result=mode==='pos'?wordResult(q,details):{score,total,details};
 ({score,total}=result);
 graded[key]=result;
 history.push({id:q.id,mode,score,total,scoringBasis:mode==='pos'?'word':'item',at:Date.now(),text:q.chunks.map(c=>c.t).join(" ")});
 if(history.length>300)history=history.slice(-300);
 persist(STORAGE_HISTORY,history);
 renderTask();
 $("actionMessage").textContent=q.origin==="automatic"?"채점 완료 · 문맥 분석으로 생성한 정답을 기준으로 채점했어요.":"채점 완료";
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
 const attempts=history.length,comparable=history.filter(r=>r.mode!=='pos'||r.scoringBasis==='word'),
  sum=comparable.reduce((n,r)=>n+r.score,0),max=comparable.reduce((n,r)=>n+r.total,0);
 $("recordSummary").innerHTML=[
  ["채점 횟수",attempts+"회"],["평균 정답률",max?Math.round(sum/max*100)+"%":"—"],["분석한 문장",custom.length+"개"]
 ].map(v=>'<div class="record-stat"><strong>'+v[1]+'</strong><span>'+v[0]+'</span></div>').join("");
 $("recordList").innerHTML=!history.length?'<div class="empty-state">아직 채점 기록이 없어요. 분석 연습을 시작해 보세요.</div>':
  history.slice(-20).reverse().map(r=>'<div class="record-row"><div>'+escapeHtml(r.text)+
   '<div><small>'+escapeHtml(MODES.find(m=>m.id===r.mode)?.title||r.mode)+' · '+new Date(r.at).toLocaleString("ko-KR")+
   (r.mode==='pos'&&r.scoringBasis!=='word'?' · 단어 기준으로 다시 채점':'')+'</small></div></div><b>'+
   (r.mode==='pos'&&r.scoringBasis!=='word'?'재채점 필요':r.score+'/'+r.total)+"</b></div>").join("");
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
   const explanation=e.target.closest("button[data-explanation-index]");
   if(explanation){openExplanation(explanation.dataset.explanationIndex,explanation);return;}
   const button=e.target.closest("button[data-kind]");
   if(button)handleAnswer({target:button});
 });
 $("feedback").addEventListener("click",e=>{
   const button=e.target.closest("button[data-explanation-index]");
   if(button)openExplanation(button.dataset.explanationIndex,button);
 });
 $("closeExplanation").addEventListener("click",()=>$("explanationDialog").close());
 $("explanationDialog").addEventListener("close",()=>{explanationReturnFocus?.focus();explanationReturnFocus=null;});
 $("explanationDialog").addEventListener("click",e=>{
   const dialog=$("explanationDialog");if(e.target!==dialog)return;
   const box=dialog.getBoundingClientRect();
   if(e.clientX<box.left||e.clientX>box.right||e.clientY<box.top||e.clientY>box.bottom)dialog.close();
 });
 $("answerArea").addEventListener("input",handleAnswer);
 $("answerArea").addEventListener("change",handleAnswer);
 $("studioForm").addEventListener("submit",async e=>{
  e.preventDefault();
  const input=$("customSentence").value.trim();
  const message=$("studioMessage"),button=$("analyzeBtn");
  if(!input)return;
  const correctSpelling=$("correctSpelling").checked!==false;
  const existing=allExamples().find(q=>(!automatic(q)||(q.analysisVersion===ANALYSIS_VERSION&&q.preprocessing?.correctSpelling===correctSpelling))&&normalizeSentence(q.chunks.map(c=>c.t).join(" "))===normalizeSentence(input));
  if(existing){currentId=existing.id;$("difficultySelect").value="all";refreshSelect();showView("practice");return;}
  button.disabled=true;
  message.textContent="한국어 형태소 모델을 로드하고 문장 구조를 분석하는 중입니다…";
  try{
    const q=await analyzeUserSentence(input,{correctSpelling});
    q.analysisVersion=ANALYSIS_VERSION;
    custom.push(q);
    if(!persist(STORAGE_CUSTOM,custom))message.textContent="분석은 성공했지만 브라우저 저장에 실패했습니다.";
    currentId=q.id;
    $("customSentence").value="";
    $("difficultySelect").value="all";
    refreshSelect();setMode("pos");showView("practice");
    $("actionMessage").textContent=(q.modelWarning||"자동 분석 완료")+" · 모든 분류의 추정 정답과 해설을 만들었어요.";
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
   const group=facetGroups(pos,facetAnswer(a,index),posUnits(current())[index]).find(g=>g.id===id);
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

