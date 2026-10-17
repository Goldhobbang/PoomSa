import {EXAMPLES,POS,ROLES,TYPES,MODES,SUBTYPES,CASE_TYPES,normalizeSentence,validateExamples} from "./data.mjs";
import {explainPartOfSpeech,explainSentenceRole,explainValency,explainRequired,explainMorphology,isCustomAnswer} from "./explanations.mjs";
const $ = id => document.getElementById(id);
const escapeHtml = value => String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
const load = (key,fallback) => { try {const v=JSON.parse(localStorage.getItem(key));return Array.isArray(v)?v:fallback;} catch {return fallback;} };
const persist = (key,v) => {try {localStorage.setItem(key,JSON.stringify(v));return true;}catch{return false;}};
const STORAGE_CUSTOM="poomsa-custom-1",STORAGE_HISTORY="poomsa-history-1";
const errors=validateExamples();
if(errors.length) console.error("Question bank validation:",errors);
let custom=load(STORAGE_CUSTOM,[]).filter(q=>q&&typeof q.id==="string"&&Array.isArray(q.chunks));
let history=load(STORAGE_HISTORY,[]);
let answers={},graded={},currentId=EXAMPLES[0].id,mode="pos",draft=null,currentView="practice";
const allExamples = () => [...EXAMPLES,...custom];
const current = () => allExamples().find(q=>q.id===currentId)||EXAMPLES[0];
const activeKey = () => currentId+":"+mode;
const response = () => {
  const a=answers[activeKey()] ||= {values:{},subtypes:{},caseTypes:{},required:{}};
  a.values ||= {};a.subtypes ||= {};a.caseTypes ||= {};a.required ||= {};
  return a;
};
const visibleExamples=()=>allExamples().filter(q=>{
 const f=$("difficultySelect").value;return f==="all"||((f==="custom")?q.id.startsWith("custom-"):q.level===f);
});
const stripPunctuation=s=>String(s).replace(/[.,!?。？！]/g,"").trim();
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
const posTally = (q,a) => {
  const units=posUnits(q),total=units.reduce((n,p)=>n+expectedPosPath(p).length,0);
  const filled=units.reduce((n,p,i)=>n+Math.min(expectedPosPath(p).length,chosenPosPath(a,i).filter(Boolean).length),0);
  return {total,filled};
};
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
 $("taskKicker").textContent=config.kicker;
 $("taskTitle").textContent=config.title;
 $("taskIntro").textContent=config.intro;
 $("actionMessage").textContent=q.id.startsWith("custom-")?"내가 등록한 정답표 기준":"";
 let html="";
 if(mode==="pos"){
   html='<div class="mode-instruction">선택 메뉴를 열지 않고 <b>보이는 항목을 바로 누르세요.</b> 조사·관형사를 고르면 그 아래에서 세부 종류를 선택합니다. 어미는 별도의 품사가 아닙니다.</div><div class="token-list">'+
   posUnits(q).map((u,i)=>{
     const mark=result?result.details.find(d=>d.index===i):null;
     return '<div class="token'+(mark?(mark.correct?' correct':' incorrect'):'')+'">'+
       '<div class="token-identity"><div class="token-caption">단어 '+String(i+1).padStart(2,'0')+'</div>'+
       '<div class="token-word">'+escapeHtml(u.t)+'</div></div>'+
       '<div class="token-answers"><div class="token-detail-label">품사</div>'+
       choiceButtons(POS,a.values[i]||'','pos',i,u.t+'의 품사')+
       (SUBTYPES[a.values[i]]?'<div class="token-detail-label nested-label">세부 분류</div>'+
          choiceButtons(SUBTYPES[a.values[i]],a.subtypes[i]||'','subtype',i,u.t+'의 세부 분류'):'')+
       (a.values[i]==='조사'&&a.subtypes[i]==='격조사'?
          '<div class="token-detail-label nested-label">격조사 종류</div>'+
          choiceButtons(CASE_TYPES,a.caseTypes[i]||'','caseType',i,u.t+'의 격조사 종류'):'')+
       (mark?'<div class="'+(mark.correct?'correct-answer':'wrong-answer')+'">정답 · '+
          escapeHtml(expectedPosPath(u).join(' → '))+'</div>':'')+
       '</div></div>';
   }).join('')+'</div>';
 }else if(mode==="syntax"){
   html='<div class="mode-instruction">각 문장 요소의 역할을 눌러 선택하세요. 품사와 문장 성분은 서로 다른 개념입니다.</div><div class="token-list">'+
     q.chunks.map((c,i)=>{
      const mark=result?result.details.find(d=>d.index===i):null;
      return '<div class="token'+(mark?(mark.correct?' correct':' incorrect'):'')+'">'+
        '<div class="token-identity"><div class="token-caption">성분 '+String(i+1).padStart(2,'0')+'</div>'+
        '<div class="token-word">'+escapeHtml(c.t)+'</div></div>'+
        '<div class="token-answers"><div class="token-detail-label">문장 성분</div>'+
        choiceButtons(ROLES,a.values[i]||'','role',i,c.t+'의 문장 성분')+
        (mark?'<div class="'+(mark.correct?'correct-answer':'wrong-answer')+'">정답 · '+escapeHtml(c.role)+'</div>':'')+
        '</div></div>';
     }).join('')+'</div>';
 }else if(mode==="slots"){
   html='<div class="mode-instruction">필수 성분은 서술어가 문장을 구성할 때 요구하는 논항입니다. 여기서는 <b>서술어 자체를 선택하지 않습니다.</b> 부사어도 필수적일 수 있어요.</div>'+
   '<div class="slot-question"><strong>이 문장의 서술어는 몇 자리인가요?</strong>'+
   choiceButtons(["1","2","3"],a.slotCount||"","slot","0","서술어 자릿수")+'</div>'+
   '<div class="required-list">'+q.chunks.map((c,i)=>c.role==="서술어"?"":'<label class="required-option"><input type="checkbox" data-kind="required" data-index="'+i+'" '+(a.required[i]?"checked ":"")+'/><span>'+escapeHtml(c.t)+'</span></label>').join("")+'</div>';
 }else if(mode==="morph"){
   html='<div class="mode-instruction">형태소는 뜻을 가진 가장 작은 말의 단위입니다. /로 나누고, 정답 아래에서 자립·의존 및 실질·형식 분류도 확인하세요.</div>'+
   '<div class="morph-word">'+escapeHtml(q.morph.word)+'</div>'+
   '<label class="visually-hidden" for="morphInput">형태소 분리 결과</label>'+
   '<input id="morphInput" class="morph-entry" data-kind="morph" type="text" autocomplete="off" spellcheck="false" placeholder="예: 철수/가" value="'+escapeHtml(a.morph||"")+'"/>'+
   '<div class="morph-hint">띄어쓰기는 채점에서 무시합니다. 예: 철수/가, 선생님/께</div>';
 }
 $("answerArea").innerHTML=html;
 $("answerArea").querySelectorAll("[data-kind]").forEach(el=>{el.disabled=!!result});
 const total = mode==="pos"?posTally(q,a).total:mode==="syntax"?q.chunks.length:mode==="slots"?q.chunks.filter(c=>c.needed).length+1:1;
 let filled;
 if(mode==="slots")filled=(a.slotCount?1:0)+q.chunks.reduce((n,c,i)=>n+(c.role!=="서술어"&&a.required[i]?1:0),0);
 else if(mode==="morph")filled=a.morph?.trim()?1:0;
 else if(mode==="pos")filled=posTally(q,a).filled;
 else filled=Object.values(a.values).filter(Boolean).length;
 $("taskProgress").textContent=filled+" / "+total;
 $("checkBtn").disabled=!!result;
 $("retryBtn").disabled=!result&&filled===0;
 renderFeedback(result,q);
}
function renderFeedback(result,q){
 const el=$("feedback");
 if(!result){el.hidden=true;el.innerHTML="";return;}
 el.hidden=false;
 const pct=Math.round((result.score/result.total)*100);
 const formatExplanation=e=>{
  if(!e)return "";
  return '<div class="feedback-explanation">'+
    '<div class="feedback-explanation-row"><b>왜 틀렸을까?</b><p>'+escapeHtml(e.diagnosis)+'</p></div>'+
    '<div class="feedback-explanation-row"><b>문법 원리</b><p>'+escapeHtml(e.principle)+'</p></div>'+
    '<div class="feedback-explanation-row"><b>다음에는 이렇게 판별</b><p>'+escapeHtml(e.check)+'</p></div>'+
    '</div>';
 };
 const details=result.details.map(d=>{
  const state=d.correct?"good":"bad";
  const title=d.correct?" — 정답":" — 선택: "+(d.chosen||"미응답")+" / 정답: "+d.expected;
  return '<div class="feedback-detail '+state+'"><strong>'+
   escapeHtml(d.label+title)+'</strong>'+
   (!d.correct&&d.explanation?formatExplanation(d.explanation):
    '<p>'+escapeHtml(d.reason||"정답표와 일치합니다.")+'</p>')+'</div>';
 }).join("");
 const customNote=isCustomAnswer(q)?
  '<div class="feedback-source-note"><strong>사용자 정답표 기준</strong> 이 문장의 정답은 사용자가 직접 지정했습니다. 아래 풀이에는 공통 문법 규칙을 적용하지만, 저장된 정답 자체가 옳은지까지 자동 검증하지는 않습니다.</div>':"";
 el.innerHTML='<div class="feedback-head"><div class="feedback-score '+(pct<70?"low":"")+'">'+result.score+' / '+result.total+'</div><div class="feedback-title">'+
  (pct===100?"완벽해요. 개념이 정확합니다.":pct>=70?"좋아요. 틀린 항목의 판별 원리를 확인하세요.":"표시된 오답 해설을 읽고 다시 도전해 보세요.")+'</div></div>'+
  customNote+
  '<div class="feedback-detail"><strong>문장 해설</strong><p>'+escapeHtml(q.overview)+'</p></div>'+details;
}
function grade(){
 const q=current(),a=response(),key=activeKey();if(graded[key])return;
 let details=[],score=0,total=0;
 if(mode==="pos"){
  const units=posUnits(q);
  details=units.map((p,i)=>{
    const expectedPath=expectedPosPath(p),chosenPath=chosenPosPath(a,i);
    // 단계별 부분 점수: 상위 단계가 맞아야 하위 분류 점수를 받을 수 있다.
    let points=0;
    for(let k=0;k<expectedPath.length;k++){
      if(expectedPath[k]!==chosenPath[k])break;
      points++;
    }
    total+=expectedPath.length;score+=points;
    return {index:i,label:p.t,chosen:chosenPath.filter(Boolean).join(" → "),expected:expectedPath.join(" → "),
      correct:points===expectedPath.length,
      reason:p.why||"이 형태가 문장에서 나타내는 어휘적·문법적 기능으로 품사를 판별합니다.",
      explanation:points===expectedPath.length?null:explainPartOfSpeech(q,p,chosenPath)};
  });
 }else if(mode==="syntax"){
  total=q.chunks.length;
  details=q.chunks.map((c,i)=>{
    const chosen=a.values[i]||"",correct=chosen===c.role;if(correct)score++;
    return {index:i,label:c.t,chosen,expected:c.role,correct,reason:c.why,
      explanation:correct?null:explainSentenceRole(q,c,chosen)};
  });
 }else if(mode==="slots"){
  total=q.chunks.filter(c=>c.needed).length+1;
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
 }else{
  total=1;
  const normalizeMorph=s=>String(s||"").replace(/\s+/g,"").replace(/[|｜]/g,"/").replace(/\/+/g,"/").replace(/^\/|\/$/g,"");
  const chosen=normalizeMorph(a.morph),expected=normalizeMorph(q.morph.answer),correct=chosen===expected;
  score=correct?1:0;
  const units=expected.split("/");
  const typeNotes=units.map((s,i)=>s+" = "+(q.morph.types[i]||"분류 확인 필요")).join(" / ");
  details=[{label:q.morph.word,chosen:a.morph||"",expected:q.morph.answer,correct,
    reason:q.morph.note+" 형태소 분류: "+typeNotes,
    explanation:correct?null:explainMorphology(q,a.morph)}];
 }
 const result={score,total,details};
 graded[key]=result;
 history.push({id:q.id,mode,score,total,at:Date.now(),text:q.chunks.map(c=>c.t).join(" ")});
 if(history.length>300)history=history.slice(-300);
 persist(STORAGE_HISTORY,history);
 renderTask();
 $("actionMessage").textContent="채점 완료 · 학습 기록에 저장했어요.";
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
function guessParts(text){
 const plain=stripPunctuation(text);
 const known=new Set(["철수","민수","민지","영희","나","너","우리","학생","아버지","할머니","동생","선생님","엄마","친구","책","밥","사과","학교","도서관","계획","꽃","하늘","아이","고양이","강아지","집","서울","사람","컴퓨터","영화","편지"]);
 const suffixes=["께서","에게서","한테서","으로써","으로서","처럼","보다","에게","한테","에서","부터","까지","대로","만큼","조차","마저","으로","께","의","은","는","이","가","을","를","와","과","에","도","만"];
 for(const suffix of suffixes){
  if(plain.length>suffix.length+1&&plain.endsWith(suffix)){
   const stem=plain.slice(0,-suffix.length);
   if(known.has(stem)||suffix.length>1){
    return [{t:stem,p:known.has(stem)?["나","너","우리"].includes(stem)?"대명사":"명사":""},{t:suffix,p:"조사"}];
   }
  }
 }
 return [{t:plain,p:""}];
}
function parseDraft(raw){
 const source=raw.replace(/\s+/g," ").trim();
 const chunks=(source.includes("|")?source.split("|"):source.split(" ")).map(s=>s.trim()).filter(Boolean);
 return {sentence:source,slots:1,morphIndex:0,chunks:chunks.map(s=>({
  t:s,parts:s.includes(" ")?s.split(/\s+/).map(t=>({t,p:""})):guessParts(s),
  role:"",needed:false,why:"사용자가 등록한 문장 성분입니다."
 }))};
}
function renderStudio(){
 const el=$("studioEditor");
 if(!draft){el.hidden=true;return;}
 el.hidden=false;
 const rows=draft.chunks.map((c,i)=>{
  const units=c.parts.map((p,j)=>{
    const key=i+":"+j,detail=Array.isArray(p.detail)?p.detail:[];
    return '<div class="studio-part"><span class="studio-part-token">'+escapeHtml(p.t)+'</span>'+
      '<span class="studio-part-caption">품사</span>'+
      editorButtons(POS,p.p,"data-editor-pos",key,p.t+"의 품사")+
      (SUBTYPES[p.p]?'<span class="studio-part-caption">세부 분류</span>'+
        editorButtons(SUBTYPES[p.p],detail[0]||"","data-editor-subtype",key,p.t+"의 세부 분류"):"")+
      (p.p==="조사"&&detail[0]==="격조사"?
        '<span class="studio-part-caption">격조사 종류</span>'+
        editorButtons(CASE_TYPES,detail[1]||"","data-editor-case",key,p.t+"의 격조사 종류"):"")+
      '</div>';
  }).join("");
  return '<div class="studio-row"><div class="studio-row-top">'+
     '<label class="field">문장 요소 '+(i+1)+' / 형태소·단어 구분'+
     '<input type="text" data-editor-split="'+i+'" value="'+escapeHtml(c.parts.map(p=>p.t).join("/"))+
     '" aria-label="'+(i+1)+'번째 요소의 형태소 구분"></label>'+
     '<label class="studio-check"><input type="checkbox" data-editor-needed="'+i+'" '+
     (c.needed?"checked":"")+'>서술어의 필수 성분</label></div>'+
     '<div class="studio-role"><div class="studio-part-caption">문장 성분</div>'+
     editorButtons(ROLES,c.role,"data-editor-role",i,"문장 요소 "+(i+1)+"의 문장 성분")+'</div>'+
     '<div class="studio-parts">'+units+'</div></div>';
 }).join("");
 el.innerHTML='<h2 class="studio-heading">분석 초안을 검토하세요</h2>'+
  '<p class="studio-lead">① /로 형태를 구분하고 ② <b>화면에 보이는 품사·문장 성분 버튼을 직접 눌러</b> 지정하세요. ③ 서술어가 요구하는 필수 성분을 선택합니다.<br>문장의 일부가 하나의 구를 이루면 입력 때 <b>|</b>로 묶을 수 있습니다. 예: 나는 | 책상 위에 | 가방을 | 놓았다.</p>'+
   rows+'<div class="studio-bottom"><div class="studio-choice-block"><div class="studio-part-caption">서술어의 자릿수</div>'+
   editorButtons(["1","2","3"].map(v=>v+"자리"),draft.slots+"자리","data-editor-slots","0","서술어의 자릿수")+'</div>'+
   '<div class="studio-choice-block"><div class="studio-part-caption">형태소 연습 대상</div>'+
   '<div class="choice-grid editor-choices" role="group" aria-label="형태소 연습 대상">'+
   draft.chunks.map((c,i)=>'<button type="button" class="choice-button'+(draft.morphIndex===i?" is-selected":"")+
     '" data-editor-morph="'+i+'" aria-pressed="'+(draft.morphIndex===i?"true":"false")+
     '" value="'+i+'">'+escapeHtml(c.t)+'</button>').join("")+'</div></div>'+
   '<button class="button button-dark" id="saveStudio" type="button">정답표 저장 및 연습 ↗</button></div>'+
   '<p id="studioMessage" role="status" class="hint-red"></p>';
}
function saveStudio(){
 if(!draft)return;
 const m=$("studioMessage");
 if(draft.chunks.some(c=>c.parts.some(p=>!POS.includes(p.p)))){m.textContent="모든 부분의 품사를 선택해 주세요.";return;}
 if(draft.chunks.some(c=>c.parts.some(p=>
    SUBTYPES[p.p]&&(!Array.isArray(p.detail)||!SUBTYPES[p.p].includes(p.detail[0])||
    (p.detail[0]==="격조사"&&!CASE_TYPES.includes(p.detail[1])))))){
   m.textContent="조사·관형사는 세부 분류까지 모두 선택해 주세요.";return;
 }
 if(draft.chunks.some(c=>!ROLES.includes(c.role))){m.textContent="모든 문장 요소의 문장 성분을 선택해 주세요.";return;}
 if(draft.chunks.filter(c=>c.role==="서술어").length!==1){m.textContent="서술어는 하나만 지정해 주세요.";return;}
 if(draft.chunks.some(c=>c.role==="서술어"&&c.needed)){m.textContent="서술어 자체는 ‘서술어가 요구하는 필수 성분’으로 선택하지 않습니다.";return;}
 const req=draft.chunks.filter(c=>c.needed).length;
 if(req!==draft.slots){m.textContent="선택한 필수 성분 수("+req+")와 서술어 자릿수("+draft.slots+")가 일치해야 합니다.";return;}
 const mChunk=draft.chunks[draft.morphIndex];
 if(mChunk.parts.length<2){m.textContent="형태소 연습 대상에는 /로 구분된 형태소가 두 개 이상 필요합니다.";return;}
 for(const c of draft.chunks){
   if(stripPunctuation(c.parts.map(p=>p.t).join("").replace(/\s+/g,""))!==stripPunctuation(c.t.replace(/\s+/g,""))){
     m.textContent="‘"+c.t+"’의 / 분리 결과가 원래 문장 요소와 일치하지 않습니다.";return;
   }
 }
 const q={
  id:"custom-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,6),
  source:"내가 만든 정답표",level:"직접 등록",focus:"사용자가 분석한 문장",chunks:structuredClone(draft.chunks),
  slots:draft.slots,overview:"직접 등록한 문장입니다. 정답표는 사용자 작성 내용이므로 문법적 타당성을 보증하지 않습니다.",
  morph:{word:mChunk.t,answer:mChunk.parts.map(p=>p.t).join("/"),types:mChunk.parts.map(()=>"사용자 검토 필요"),note:"사용자가 등록한 분리입니다. 형태소의 자립성·의미 분류는 자동 검증되지 않습니다."}
 };
 custom.push(q);persist(STORAGE_CUSTOM,custom);draft=null;$("studioEditor").hidden=true;
 $("customSentence").value="";
 $("difficultySelect").value="all";currentId=q.id;refreshSelect();setMode("pos");showView("practice");
 $("actionMessage").textContent="내 문장을 저장했어요. 이제 정답표에 따라 채점할 수 있습니다.";
}
function renderRecords(){
 const attempts=history.length,sum=history.reduce((n,r)=>n+r.score,0),max=history.reduce((n,r)=>n+r.total,0);
 $("recordSummary").innerHTML=[
  ["채점 횟수",attempts+"회"],["평균 정답률",max?Math.round(sum/max*100)+"%":"—"],["내 문장",custom.length+"개"]
 ].map(v=>'<div class="record-stat"><strong>'+v[1]+'</strong><span>'+v[0]+'</span></div>').join("");
 $("recordList").innerHTML=!history.length?'<div class="empty-state">아직 채점 기록이 없어요. 분석 연습을 시작해 보세요.</div>':
  history.slice(-20).reverse().map(r=>'<div class="record-row"><div>'+escapeHtml(r.text)+
   '<div><small>'+escapeHtml(MODES.find(m=>m.id===r.mode)?.title||r.mode)+' · '+new Date(r.at).toLocaleString("ko-KR")+'</small></div></div><b>'+r.score+"/"+r.total+"</b></div>").join("");
 $("customList").innerHTML=!custom.length?'<div class="empty-state">저장된 사용자 문장이 없습니다.</div>':
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
 $("studioForm").addEventListener("submit",e=>{
  e.preventDefault();const text=$("customSentence").value.trim();
  if(!text)return;
  const match=allExamples().find(q=>normalizeSentence(q.chunks.map(c=>c.t).join(" "))===normalizeSentence(text));
  if(match){currentId=match.id;$("difficultySelect").value="all";refreshSelect();showView("practice");return;}
  draft=parseDraft(text);renderStudio();
 });
 $("studioEditor").addEventListener("change",e=>{
  if(!draft)return;
  const el=e.target;
  if(el.dataset.editorSplit!==undefined){
   const i=Number(el.dataset.editorSplit),src=draft.chunks[i];
   const segments=el.value.split("/").map(x=>x.trim()).filter(Boolean);
   if(!segments.length)return;
   const old=src.parts;
   src.parts=segments.map((t,j)=>({t,p:old[j]?.t===t?old[j].p:"",detail:old[j]?.t===t?old[j].detail||[]:[]}));
   renderStudio();
  }else if(el.dataset.editorNeeded!==undefined){
   draft.chunks[Number(el.dataset.editorNeeded)].needed=el.checked;
  }
 });
 $("studioEditor").addEventListener("click",e=>{
  const el=e.target.closest("button");
  if(!el||!draft)return;
  if(el.id==="saveStudio"){saveStudio();return;}
  const key=el.dataset.editorPos||el.dataset.editorSubtype||el.dataset.editorCase;
  if(key!==undefined){
   const [i,j]=key.split(":").map(Number),p=draft.chunks[i]?.parts[j];
   if(!p)return;
   if(el.dataset.editorPos!==undefined){
    p.p=el.value;p.detail=[];
   }else if(el.dataset.editorSubtype!==undefined){
    p.detail=[el.value];
   }else if(el.dataset.editorCase!==undefined){
    p.detail=["격조사",el.value];
   }
   renderStudio();return;
  }
  if(el.dataset.editorRole!==undefined){
   draft.chunks[Number(el.dataset.editorRole)].role=el.value;
   renderStudio();return;
  }
  if(el.dataset.editorSlots!==undefined){
   draft.slots=Number(el.value.replace("자리",""));
   renderStudio();return;
  }
  if(el.dataset.editorMorph!==undefined){
   draft.morphIndex=Number(el.dataset.editorMorph);
   renderStudio();
  }
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
     delete a.subtypes[index];delete a.caseTypes[index];
   }
   renderTask();return;
 }else if(kind==="subtype"){
   a.subtypes[index]=t.value;delete a.caseTypes[index];renderTask();return;
 }else if(kind==="caseType"){a.caseTypes[index]=t.value;renderTask();return;}
 else if(kind==="role"){a.values[index]=t.value;renderTask();return;}
 else if(kind==="slot"){a.slotCount=t.value;renderTask();return;}
 else if(kind==="required")a.required[index]=t.checked;
 else if(kind==="morph")a.morph=t.value;
 const q=current();
 const max=mode==="pos"?posTally(q,a).total:mode==="syntax"?q.chunks.length:mode==="slots"?q.chunks.filter(c=>c.needed).length+1:1;
 const filled=mode==="slots"?(a.slotCount?1:0)+q.chunks.reduce((n,c,i)=>n+(c.role!=="서술어"&&a.required[i]?1:0),0):
 mode==="morph"?(a.morph?.trim()?1:0):mode==="pos"?posTally(q,a).filled:Object.values(a.values).filter(Boolean).length;
 $("taskProgress").textContent=filled+" / "+max;
 $("retryBtn").disabled=filled===0;
}
setup();
