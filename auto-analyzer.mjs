import {inferFacets} from "./taxonomy.mjs";
import rules from "./grammar-rules.json" with {type:"json"};

const school={NNG:"명사",NNP:"명사",NNB:"명사",SL:"명사",SH:"명사",NR:"수사",SN:"수사",NP:"대명사",
 VV:"동사",VX:"동사",XSV:"동사",VA:"형용사",XSA:"형용사",VCN:"형용사",VCP:"조사",
 MM:"관형사",MAG:"부사",MAJ:"부사",IC:"감탄사"};
const transitive=new Set(["먹","마시","읽","보","쓰","사","찾","좋아하","사랑하","만나","만들","열","닫","잡","던지","공부하","배우","알","모르","기억하","입","신","들","꺾","기르","기다리","생각하","말하","닮","돕","듣","짓"]);
const three=new Set(["주","드리","건네","보내","전하","가르치","들려주","맡기","빌려주","보여주","알려주"]);
const intransitive=new Set(["웃","울","자","가","오","달리","걷","뛰","내리","날","살","떠나","앉","서","일어나","행동하","도착하","소리지르","소리치","놀","되"]);
const punct=t=>/^S[FWPSOECL]$/.test(t.pos);
const strip=s=>s.replace(/^[“‘"'([{]+|[,.!?。？！…;:”’"')\]}]+$/gu,"");
const detailFor={JKS:["격조사","주격 조사"],JKC:["격조사","보격 조사"],JKG:["격조사","관형격 조사"],JKO:["격조사","목적격 조사"],
 JKB:["격조사","부사격 조사"],JKQ:["격조사","부사격 조사"],JKV:["격조사","호격 조사"],VCP:["격조사","서술격 조사"],JC:["접속 조사"],JX:["보조사"]};

function segment(eo){
 const original=strip(eo.text),ts=(eo.tokens||[]).filter(t=>!punct(t));
 if(!ts.length)ts.push({text:original,pos:"NNG",confidence:"context",rule:"체언 위치로 미등록 명사 추정"});
 let remainder=original,idx=ts.length;const particles=[];
 while(idx>0&&/^J/.test(ts[idx-1].pos)){
  const t=ts[idx-1];if(!t.text||!remainder.endsWith(t.text))break;
  remainder=remainder.slice(0,-t.text.length);particles.unshift(t);idx--;
 }
 const copula=ts.findIndex(t=>t.pos==="VCP");
 if(!particles.length&&copula>0){
  const before=ts.slice(0,copula),surface=before.map(t=>t.surface??t.text).join("");
  if(original.startsWith(surface)){
   remainder=surface;idx=copula;
   particles.push({...ts[copula],text:original.slice(surface.length)||"이- (생략)",lemma:"이다"});
  }
 }
 const core=ts.slice(0,idx),tags=core.map(t=>t.pos);
 const derivation=core.findIndex(t=>["XSV","XSA"].includes(t.pos));
 const verb=core.find(t=>["VV","VA","VX","VCN","VCP"].includes(t.pos));
 const root=derivation>=0?core.slice(0,derivation+1).filter(t=>!/^E/.test(t.pos)).map(t=>t.text).join(""):verb?.text||"";
 const tag=derivation>=0?core[derivation].pos:
  core.find(t=>["VV","VA","VX","VCN","MM","MAG","MAJ","IC","NP","NR"].includes(t.pos))?.pos||
  core.find(t=>["NNG","NNP","NNB","SN","SL","SH"].includes(t.pos))?.pos||"NNG";
 const category=school[tag]||"명사",confidence=core.some(t=>t.confidence==="context"||t.uncertain)?"context":"model";
 const parts=[];
 if(remainder)parts.push({t:remainder,p:category,lemma:root?root+"다":core.find(t=>t.lemma)?.lemma,
  tag,root,confidence,gradeable:true,
  why:[...new Set(core.map(t=>t.rule).filter(Boolean))].join("; ")+
   (verb?.present?". "+verb.present.reason:"")+
   (tags.includes("NNB")?". 관형어의 수식을 받는 의존 명사로 분석했습니다.":"")});
 for(const t of particles)parts.push({t:t.text,p:"조사",tag:t.pos,detail:detailFor[t.pos]||["보조사"],lemma:t.lemma,
  alternativeDetails:t.acceptedPos?.map(pos=>detailFor[pos]).filter(Boolean),alternativeReason:t.alternativeReason,
  why:t.pos==="VCP"?"체언에 붙어 서술 기능을 하는 ‘이다’의 활용형입니다. 이-가 생략되면 복원합니다.":
   (t.rule?t.rule+". ":"")+"형태소 태그 "+t.pos+"와 앞말에 결합하는 쓰임으로 판별했습니다.",gradeable:true,confidence:t.confidence||"model"});
 return {...eo,parts,allTokens:ts,tags:ts.map(t=>t.pos),root,category,particle:particles.at(-1)?.pos||"",original,
  predicate:!!root||copula>=0};
}
function predicateChains(words){
 for(let i=0;i<words.length;i++){
  const w=words[i],prior=words[i-1],ending=prior?.allTokens.at(-1);
  const auxiliary=w.allTokens.some(t=>t.auxiliary||t.pos==="VX")&&prior?.predicate&&ending?.pos==="EC";
  w.auxiliaryOf=auxiliary?i-1:null;
  w.head=auxiliary?prior.head:i;w.terminal=i;
  if(auxiliary)for(let j=w.head;j<i;j++)if(words[j].predicate)words[j].terminal=i;
 }
}
function predicateIndex(words){
 const finite=words.map((w,i)=>({w,i})).filter(x=>x.w.tags.includes("EF"));
 if(finite.length)return finite.at(-1).i;
 const predicates=words.map((w,i)=>({w,i})).filter(x=>x.w.predicate);
 return predicates.at(-1)?.i??words.length-1;
}
function governor(words,index,pred){
 for(let i=index+1;i<words.length;i++)if(words[i].predicate)return words[i].terminal??i;
 return pred;
}
function roleFor(w,index,pred,words){
 const {tags,particle}=w;
 if(index===pred||w.predicate&&w.terminal===pred)return ["서술어",w.terminal!==w.head?"본용언과 보조 용언이 연결되어 하나의 서술어 구성을 이룹니다.":"문장 끝의 종결 표현을 중심으로 서술어를 판별했습니다."];
 const cases={JKS:"주어",JKO:"목적어",JKC:"보어",JKG:"관형어",JKB:"부사어",JKQ:"부사어",JKV:"독립어"};
 const caseTag=[...w.allTokens].reverse().find(t=>cases[t.pos])?.pos;
 if(caseTag)return [cases[caseTag],"결합한 격조사 "+caseTag+"의 문법 기능을 적용했습니다."];
 if(tags.includes("IC"))return ["독립어","감탄사는 다른 성분과 독립적으로 쓰입니다."];
 if(tags.includes("MM")||tags.includes("ETM"))return ["관형어","관형사 또는 관형사형 어미가 뒤 체언을 꾸밉니다."];
 if(tags.includes("MAG")||tags.includes("MAJ"))return ["부사어","부사로서 서술 표현이나 문장을 수식합니다."];
 if(w.allTokens.some(t=>t.pos==="NNB"&&["대로","만큼","듯"].includes(t.text)))return ["부사어","앞 관형절을 받는 의존 명사가 방법·정도·양태를 나타내는 부사어로 쓰였습니다."];
 if(tags.includes("EC")||tags.includes("ETN"))return ["부사어","뒤 서술 표현에 이어지는 절의 기능으로 판별했습니다."];
 if(w.allTokens.some(t=>["대로","처럼","만큼","부터","까지"].includes(t.text)&&/^J/.test(t.pos)&&!(t.text==="만큼"&&t.pos==="JX")))
  return ["부사어","방법·기준·범위를 나타내는 조사와 뒤 서술어의 관계를 적용했습니다."];
 if(["오늘","어제","내일","지금"].includes(w.allTokens[0]?.text))return ["부사어","시간을 나타내는 체언이 뒤 서술어의 때를 꾸밉니다."];
 const gov=governor(words,index,pred),start=words.slice(0,index).findLastIndex(x=>x.predicate)+1;
 const clause=words.slice(start,gov),explicitSubject=clause.some(x=>x!==w&&x.tags.includes("JKS"));
 const object=clause.some(x=>x!==w&&x.tags.includes("JKO"));
 const root=words[gov]?.root,needsObject=transitive.has(root)||three.has(root)||rules.frames[root]?.object;
 if(w.category==="명사"&&index+2<words.length&&words[index+1].tags.includes("MM")&&
   words[index+2].allTokens.some(t=>t.pos==="NNB"&&rules.counters.includes(t.text))&&words[index+2].tags.includes("JKO"))
  return ["목적어","뒤 수량 표현과 함께 한 명사구를 이루며, 그 명사구의 목적격을 함께 적용했습니다."];
 if(particle==="JC"){
  const next=words[index+1];
  if(next?.tags.includes("JKO"))return ["목적어","접속 조사로 연결된 뒤 체언의 목적격을 함께 적용했습니다."];
  if(next?.tags.includes("JKB"))return ["부사어","함께함을 나타내는 접속 표현과 뒤 부사격을 적용했습니다."];
 }
 if(needsObject&&!object&&particle==="JX"&&w.category!=="대명사"&&w.allTokens.some(t=>["만","도"].includes(t.text)))
  return ["목적어","타동사 앞의 체언에 ‘만/도’가 목적격 대신 결합한 문맥으로 판별했습니다.","context"];
 if(explicitSubject&&!object&&needsObject)return ["목적어","같은 절의 주어와 타동사를 확인해 격조사가 생략된 목적어로 추정했습니다.","context"];
 if(!explicitSubject)return ["주어","같은 절에 별도 주격 표지가 없어 화제 체언을 주어로 추정했습니다.","context"];
 return ["부사어","격 표지·서술어·어순을 조합해 부사어로 추정했습니다.","context"];
}
function addValency(words,chunks,pred){
 const w=words[words[pred]?.head??pred],root=w?.root||"",frame=rules.frames[root],copula=w?.tags.includes("VCP");
 const object=chunks.some((c,i)=>c.role==="목적어"&&governor(words,i,pred)===pred);
 let slots=copula?1:frame?.slots||(three.has(root)?3:transitive.has(root)?2:1);
 const exact=!!(copula||frame||transitive.has(root)||three.has(root)||intransitive.has(root)||w?.category==="형용사");
 const requiredAdverbs=frame?.adverb||(three.has(root)?["에게","한테","께","에"]:[]);
 const adverb=chunks.findIndex((c,i)=>c.role==="부사어"&&governor(words,i,pred)===pred&&
  words[i].allTokens.some(t=>t.pos==="JKB"&&requiredAdverbs.includes(t.text)));
 if(["가","오"].includes(root)&&adverb<0)slots=1;
 if(!exact&&object)slots=2;
 const start=words.slice(0,pred).findLastIndex(x=>x.predicate&&x.tags.includes("EC")&&x.terminal!==pred)+1;
 const explicitMainSubject=chunks.some((c,i)=>c.role==="주어"&&i>=start&&governor(words,i,pred)===pred);
 chunks.forEach((c,i)=>{
  const sharedTopic=!explicitMainSubject&&c.role==="주어"&&words[i].allTokens[0]?.pos==="NP"&&words[i].allTokens.some(t=>t.pos==="JX"&&["은","는"].includes(t.text));
  const main=c.role!=="서술어"&&(i>=start&&governor(words,i,pred)===pred||sharedTopic);
  c.needed=main&&(["주어","보어"].includes(c.role)||c.role==="목적어"&&slots>=2||i===adverb);
  c.neededGradeable=true;
 });
 const visible=new Set(chunks.map((c,i)=>c.needed?(c.argumentGroup??i):null).filter(i=>i!==null)).size,implicit=Math.max(0,slots-visible);
 return {slots,gradeable:true,implicit,confidence:exact?"rule":"context",notes:[
  ...(implicit?["서술어가 요구하는 "+slots+"자리 중 "+implicit+"자리가 문장에서 생략된 것으로 분석했습니다."]:[]),
  ...(!exact?["서술어 사전에 없는 논항 구조는 같은 절의 격 표지와 어순으로 추정했습니다."]:[])]};
}
function morphCandidate(words){
 const usable=words.filter(w=>w.allTokens.some(t=>!punct(t)));
 const chosen=usable.find(w=>w.allTokens.length>=2&&w.allTokens.map(t=>t.text).join("")===w.original)||
  usable.find(w=>w.allTokens.length>=2)||usable[0];
 const ts=chosen?.allTokens||[],pieces=ts.map(t=>t.text);
 return {word:chosen?.original||"",answer:pieces.join("/"),gradeable:true,
  types:ts.map(t=>/^(J|E|X|VCP)/.test(t.pos)?"의존·형식":/^V/.test(t.pos)||t.pos==="NNB"?"의존·실질":"자립·실질"),
  note:pieces.join("")===chosen?.original?"형태소 태그의 어간·조사·어미 경계를 적용했습니다.":
   "표면형에서 탈락·축약된 형태를 복원한 기본 형태소로 나누었습니다."};
}
export function inferSchoolAnalysis(text,tokens,{id="auto-"+Date.now().toString(36)}={}){
 const sentence=String(text||"").trim().replace(/\s+/gu," ").normalize("NFC");
 if(!sentence||sentence.length>180)throw Error("문장은 1자 이상 180자 이하로 입력하세요.");
 const eojeols=[...sentence.matchAll(/\S+/gu)].map(m=>({text:m[0],start:m.index,end:m.index+m[0].length,tokens:[]}));
 for(const t of tokens||[]){const w=eojeols.find(w=>Number(t.start)>=w.start&&Number(t.start)<w.end);if(w)w.tokens.push({...t});}
 const words=eojeols.map(segment);predicateChains(words);const pred=predicateIndex(words);
 const chunks=words.map((w,i)=>{
  const [role,why,confidence="rule"]=roleFor(w,i,pred,words);
  const gov=governor(words,i,pred),hasObject=words.some((x,j)=>x.tags.includes("JKO")&&governor(words,j,pred)===(w.predicate?w.terminal:gov));
  for(const p of w.parts){
   p.facets=inferFacets(p,{tag:p.tag,root:p.root||w.root,argumentRoot:words[w.head]?.root,context:sentence,hasObject});
   if(p.p==="관형사")p.detail=[p.facets.determinerKind];
  }
  return {t:w.text,parts:w.parts,role,needed:false,gradeable:true,why,confidence,
   ...(role==="주어"&&w.parts.some(p=>p.alternativeDetails?.some(d=>d[1]==="부사격 조사"))?
    {alternativeRoles:["부사어"],alternativeReason:w.parts.find(p=>p.alternativeReason)?.alternativeReason}: {})};
 });
 for(let i=0;i+2<words.length;i++)if(chunks[i].role==="목적어"&&words[i+1].tags.includes("MM")&&words[i+2].tags.includes("JKO")&&
   words[i+2].allTokens.some(t=>t.pos==="NNB"&&rules.counters.includes(t.text))){chunks[i].argumentGroup=i+2;chunks[i+2].argumentGroup=i+2;}
 const valency=addValency(words,chunks,pred),morph=morphCandidate(words);
 const estimated=chunks.flatMap(c=>c.parts.filter(p=>p.confidence==="context").map(p=>p.t));
 return {id,source:"자동 분석 (문맥 기반 추정)",origin:"automatic",level:"자동",focus:"형태소·문맥 자동 분석",chunks,
  slots:valency.slots,slotsGradeable:true,implicitArguments:valency.implicit,morph,
  overview:"형태소 모델·사전·조사·어미·절의 문맥을 조합한 학습용 추정 정답입니다. 서술어가 요구하는 자릿수에는 생략된 논항도 포함합니다.",
  notes:valency.notes,stats:{scoreEligible:chunks.flatMap(c=>c.parts).length,roleEligible:chunks.length,
   ambiguous:[],estimated:[...new Set(estimated)],total:chunks.flatMap(c=>c.parts).length},rawTags:words.map(w=>w.tags)};
}
