import {inferFacets} from "./taxonomy.mjs";
/**
 * Offline Korean school-grammar inference pipeline.
 * Garu supplies Sejong morphological tags. This module converts them to
 * school-level words, sentence roles, valency, and conservative grading flags.
 * It does NOT claim to be a full syntactic parser.
 */
const posTagToSchool = tag => ({
 NNG:"명사",NNP:"명사",NNB:"명사",NR:"수사",NP:"대명사",
 VV:"동사",VX:"동사",VA:"형용사",VCP:"조사",VCN:"형용사",
 MM:"관형사",MAG:"부사",MAJ:"부사",IC:"감탄사",
 JKS:"조사",JKC:"조사",JKG:"조사",JKO:"조사",JKB:"조사",
 JKV:"조사",JKQ:"조사",JC:"조사",JX:"조사",SN:"수사"
})[tag]||null;

const knownTransitive = new Set(["먹","마시","읽","보","쓰","사","찾","좋아하","사랑하","만나","만들","열","닫","잡","던지","공부하","배우","알","기억하","입","신","들","꺾","기르"]);
const knownThree = new Set(["주","드리","건네","보내","전하","가르치","들려주","맡기","빌려주","보여주","알려주"]);
const knownIntransitive = new Set(["웃","울","자","가","오","달리","걷","뛰","내리","날","살","떠나","앉","서","일어나","크","맑","예쁘","빠르","춥","덥","작","많","적","없","있","행동하","도착하"]);
const predicateRoots = {"되":2,"아니":2};
const normalizedRoot = value=>String(value||"").replace(/다$/,"").replace(/(었|았|겠|시|셨|는)$/,"");
const stripEnd = word=>word.replace(/[,.!?。？！…;:]+$/gu,"");
const isParticle = t=>/^J/.test(t.pos);
const isEnding = t=>/^(E[PCFMTN]|XSN|XSV|XSA|XPN)$/.test(t.pos);
const punct = t=>/^S[FWPSOECL]$/.test(t.pos);
const guessDetail=(j,word,role)=>{
  if(j.pos==="JKS")return ["격조사","주격 조사"];
  if(j.pos==="JKC")return ["격조사","보격 조사"];
  if(j.pos==="JKG")return ["격조사","관형격 조사"];
  if(j.pos==="JKO")return ["격조사","목적격 조사"];
  if(j.pos==="JKB")return ["격조사","부사격 조사"];
  if(j.pos==="JKV")return ["격조사","호격 조사"];
  if(j.pos==="JKQ")return ["격조사","부사격 조사"];
  if(j.pos==="JC")return ["접속 조사"];
  if(j.pos==="JX")return ["보조사"];
  return null;
};
const modifierSubtype=(word)=>{
 const pure=stripEnd(word);
 if(/^(이|그|저|이런|그런|저런|어느|무슨)$/.test(pure))return ["지시 관형사"];
 if(/^(한|두|세|네|첫|첫째|둘째|셋째|몇|여러|모든|온갖)$/.test(pure))return ["수 관형사"];
 if(/^(새|헌|옛|순|맨|참|풋)$/.test(pure))return ["성상 관형사"];
 return null;
};
const matches = (text,words)=>words.some(w=>text===w || text.startsWith(w));
function buildEojeols(sentence){
 const result=[];
 for(const m of sentence.matchAll(/\S+/gu))result.push({text:m[0],start:m.index,end:m.index+m[0].length});
 return result;
}
function groupTags(eojeols,tokens){
 const sorted=Array.isArray(tokens)?tokens:[];
 for(const tok of sorted){
  const start=Number(tok.start),end=Number(tok.end);
  if(!Number.isInteger(start)||!Number.isInteger(end))continue;
  const target=eojeols.find(w=>start>=w.start&&start<w.end || start===w.start&&end===w.end);
  if(target)(target.tokens ||= []).push({...tok,text:String(tok.text||""),pos:String(tok.pos||"")});
 }
}
function segmentWord(eo){
 const original=stripEnd(eo.text),ts=(eo.tokens||[]).filter(t=>!punct(t));
 const particles=[];
 let remainder=original,idx=ts.length;
 while(idx>0&&isParticle(ts[idx-1])){
  const tok=ts[idx-1];
  if(!remainder.endsWith(tok.text)||tok.text.length===0)break;
  remainder=remainder.slice(0,-tok.text.length);
  particles.unshift(tok);idx--;
 }
 const copulaIndex=ts.findIndex(t=>t.pos==="VCP");
 if(particles.length===0&&copulaIndex>0){
   const before=ts.slice(0,copulaIndex);
   const nounSurface=before.map(t=>t.surface??t.text).join("");
   if(original.startsWith(nounSurface)){
    remainder=nounSurface;idx=copulaIndex;
    particles.push({...ts[copulaIndex],text:original.slice(nounSurface.length)||"이- (생략)",pos:"VCP",lemma:"이다"});
   }
 }
 const core=ts.slice(0,idx),tags=core.map(t=>t.pos),posTag=tags.find(t=>["VV","VX","VA","VCN","MM","MAG","MAJ","IC","NR","NP"].includes(t)) ||
     tags.find(t=>["XSV","XSA"].includes(t)) ||
     tags.find(t=>["NNG","NNP","NNB","SN","SL","SH"].includes(t)) ||
     null;
 let category=posTagToSchool(posTag);
 if(tags.includes("XSV"))category="동사";
 if(tags.includes("XSA"))category="형용사";
 if(tags.includes("VCP")&&particles.length===0)category="명사";
 if(!category&&/^[0-9]+$/.test(remainder))category="수사";
 if(!category&&remainder)category="명사";
 if(!remainder&&particles.length)remainder=original;
 const confidence=posTag&&posTagToSchool(posTag)&&!tags.includes("NA")&&!core.some(t=>t.uncertain)?"model":"uncertain";
 const parts=[];
 if(remainder){
  parts.push({t:remainder,p:category||"명사",detail:category==="관형사"?modifierSubtype(remainder):undefined,
    lemma:core.find(t=>t.lemma)?.lemma,
    why:[...new Set(core.map(t=>t.rule).filter(Boolean))].join("; ")+
      (core.find(t=>t.present)?.present?". "+core.find(t=>t.present).present.reason:"")+
      (core.some(t=>t.pos==="NNB")?". 앞 관형어의 수식을 받아 대상을 나타내는 의존 명사입니다.":""),
    gradeable:confidence==="model"&& !(category==="관형사"&&!modifierSubtype(remainder)),
    confidence});
 }
 for(const particle of particles){
  const detail=particle.pos==="VCP"?["격조사","서술격 조사"]:guessDetail(particle,remainder);
  parts.push({t:particle.text,p:"조사",detail,lemma:particle.lemma,why:particle.pos==="VCP"?
    "체언 뒤에서 서술 기능을 하는 ‘이다’의 활용형입니다. 생략된 어간 ‘이-’를 복원하고 어미를 분리합니다.":
    "형태소 태그 "+particle.pos+"와 앞말에 결합하는 쓰임으로 판별했습니다.",
    gradeable:!!detail,confidence:detail?"model":"uncertain"});
 }
 const coreTokens=ts.filter(t=>!isParticle(t));
 const verbToken=coreTokens.find(t=>["VV","VA","VCN","VCP","VX"].includes(t.pos));
 const root=verbToken?.text||"";
 for(const p of parts){
   const tokenTag=p.p==="조사"?(particles.find(t=>t.text===p.t)?.pos||""):
     (p===parts[0]?posTag||"":"");
   p.facets=inferFacets(p,{tag:tokenTag,root});
 }

 return {parts,allTokens:ts,root,hasPredicate:!!verbToken&&
   (!!tags.some(t=>["EF","EC","EP","ETM","ETN"].includes(t))||eo===null),
   tags,category,original,particle:particles.at(-1)?.pos||"",low:parts.some(p=>!p.gradeable),
   morphTokens:ts.filter(t=>t.text&&!punct(t)),text:eo.text};
}

function resolvePredicate(words){
 // Prioritize an eojeol ending in final ending (EF), then rightmost VV/VA/VCP.
 const finite=words.map((w,i)=>({w,i})).filter(x=>
  x.w.tags.some(t=>t==="EF")||x.w.allTokens.some(t=>t.pos==="EF"));
 if(finite.length)return finite.at(-1).i;
 const other=words.map((w,i)=>({w,i})).filter(x=>x.w.allTokens.some(t=>["VV","VA","VCP","VCN","VX"].includes(t.pos)));
 return other.at(-1)?.i??-1;
}
function roleFor(word,index,predIndex,words){
 const {tags,particle,category}=word;
 if(index===predIndex)return ["서술어",true,"서술 표현으로 추정되었습니다."];
 if(particle==="JKS")return ["주어",true,"주격 조사(-이/-가/-께서)의 기능입니다."];
 if(particle==="JKO")return ["목적어",true,"목적격 조사(-을/-를)의 기능입니다."];
 if(particle==="JKC")return ["보어",true,"보격 조사(-이/-가)의 기능입니다."];
 if(particle==="JKG")return ["관형어",true,"관형격 조사가 뒤 체언을 꾸밉니다."];
 if(particle==="JKB"||particle==="JKQ")return ["부사어",true,"부사격 조사가 서술어와의 관계를 나타냅니다."];
 if(particle==="JKV")return ["독립어",true,"호격 조사가 부름을 나타냅니다."];
 if(tags.includes("IC"))return ["독립어",true,"감탄사는 문장 안에서 독립어가 됩니다."];
 if(tags.includes("MM"))return ["관형어",true,"관형사가 체언을 꾸미므로 관형어입니다."];
 if(tags.includes("MAG")||tags.includes("MAJ"))return ["부사어",true,"부사가 수식하므로 부사어입니다."];
 if(tags.includes("ETM"))return ["관형어",true,"관형사형 어미가 뒤 체언을 꾸밉니다."];
 if(tags.includes("EC")||tags.includes("ETN"))return ["부사어",false,"이어진 절의 내부 구조를 확인해야 합니다."];
 if(particle==="JC")return ["주어",false,"접속 조사가 연결한 체언의 결합 방식은 문맥 확인이 필요합니다."];
 if(particle==="JX")return ["주어",false,"보조사는 주격·목적격을 직접 확정하지 않아 문맥적 중의성이 있습니다."];
 if(index<predIndex&&category==="명사")return ["주어",false,"조사가 없는 체언은 여러 문장 성분으로 해석될 수 있습니다."];
 return ["부사어",false,"명시적인 격 표지가 없어 문장 성분을 확정하지 못했습니다."];
}
function addValency(words,chunks,predIdx){
 if(predIdx<0)return {slots:1,gradeable:false,notes:["서술어를 확정하지 못해 자릿수 채점을 보류합니다."]};
 const pred=words[predIdx];const root=normalizedRoot(pred.root);
 let slots=0,gradeable=false;
 if(pred.allTokens.some(t=>t.pos==="VCP")){slots=1;gradeable=true;}
 else if(Object.hasOwn(predicateRoots,root)){slots=predicateRoots[root];gradeable=true;}
 else if(knownThree.has(root)){slots=3;gradeable=true;}
 else if(knownTransitive.has(root)){slots=2;gradeable=true;}
 else if(knownIntransitive.has(root)||pred.tags.includes("VA")||pred.tags.includes("VCN")){slots=1;gradeable=true;}
 else {slots=Math.max(1,chunks.filter(c=>["주어","목적어","보어"].includes(c.role)).length);gradeable=false;}
 const candidates=chunks.filter(c=>["주어","목적어","보어"].includes(c.role)&&c.gradeable);
 const preferred=chunks.filter(c=>c.role==="부사어"&&c.gradeable&&["JKB","JKQ"].includes(words[chunks.indexOf(c)]?.particle));
 chunks.forEach(c=>{c.needed=false;c.neededGradeable=false;});
 for(const c of candidates){c.needed=true;c.neededGradeable=gradeable;}
 if(slots===3&&preferred.length) {
  preferred[0].needed=true;
  preferred[0].neededGradeable=gradeable;
 }
 // If the required-argument set does not match inferred valency, don't grade it.
 const count=chunks.filter(c=>c.needed).length;
 if(count!==slots){gradeable=false;for(const c of chunks)c.neededGradeable=false;}
 return {slots,gradeable,notes:gradeable?[]:["격 표지/논항 구조가 불분명해 서술어 자릿수의 확정 채점을 보류합니다."]};
}
const morphCandidate=(words)=>{
 for(const w of words){
  const text=stripEnd(w.text),pieces=w.morphTokens.map(t=>t.text);
  if(pieces.length>=2&&pieces.join("")===text){
    return {word:text,answer:pieces.join("/"),types:pieces.map(t=>/^(J|E|X)/.test(t.pos)?"형식·의존":/^(V)/.test(t.pos)?"실질·의존":"실질·자립"),
      note:"형태소 분석기의 분절 결과에서 직접 구성했습니다. 표면형과 분석형이 일치하는 예시입니다.",gradeable:true};
  }
 }
 return {word:stripEnd(words[0]?.text||""),answer:"",types:[],note:"활용·축약 때문에 형태소 분절의 표면형이 원문과 일치하지 않아 정답 확정을 보류합니다.",gradeable:false};
};
export function inferSchoolAnalysis(text,tokens,{id="auto-"+Date.now().toString(36)}={}){
 const sentence=String(text||"").trim().replace(/\s+/gu," ").normalize("NFC");
 if(!sentence||sentence.length>180)throw Error("문장은 1자 이상 180자 이하로 입력하세요.");
 const eojeols=buildEojeols(sentence);
 groupTags(eojeols,tokens);
 const words=eojeols.map(segmentWord);
 const predIdx=resolvePredicate(words);
 const chunks=words.map((w,i)=>{
   const [role,certain,why]=roleFor(w,i,predIdx,words);
   return {t:w.text,parts:w.parts,role,needed:false,gradeable:certain&&!w.low,why};
 });
 const slots=addValency(words,chunks,predIdx),morph=morphCandidate(words);
 const scoreEligible=chunks.flatMap(c=>c.parts).filter(p=>p.gradeable).length;
 const roleEligible=chunks.filter(c=>c.gradeable).length;
 const ambiguous=chunks.flatMap(c=>c.parts.filter(p=>!p.gradeable).map(p=>p.t)).concat(chunks.filter(c=>!c.gradeable).map(c=>c.t));
 const overview="브라우저 형태소 모델의 세종 품사 태그를 학교 문법으로 변환하고, 조사·어미·서술어의 단서로 문장 성분을 추정했습니다. 이 결과는 자동 생성된 학습용 추정 정답이며 공식 검수가 아닙니다.";
 return {id,source:"자동 분석 (검수되지 않은 추정)",origin:"automatic",level:"자동",focus:"형태소 기반 자동 분석",
   chunks,slots:slots.slots,slotsGradeable:slots.gradeable,morph,overview,
   notes:slots.notes,stats:{scoreEligible,roleEligible,ambiguous:[...new Set(ambiguous)],total:chunks.flatMap(c=>c.parts).length},
   rawTags:words.map(w=>w.allTokens.map(t=>t.pos))};
}

