import rules from "./grammar-rules.json" with {type:"json"};

const nouns=new Set(rules.nouns),dependent=new Set(rules.dependentNouns),proper=new Set(rules.properNouns);
const clean=s=>s.replace(/^[“‘"'([{]+|[,.!?。？！…;:”’"')\]}]+$/gu,"");
const syllable=s=>{const n=s.charCodeAt(s.length-1)-0xac00;return n>=0&&n<11172?{n,final:n%28}:null;};
const withFinal=(s,n)=>{const h=syllable(s);return h?s.slice(0,-1)+String.fromCharCode(0xac00+h.n-h.final+n):s;};
const token=(text,pos,rule,extra={})=>({text,pos,rule,...extra});
const quantity=t=>["NR","SN"].includes(t.pos)||t.pos==="MM"&&rules.quantityDeterminers.includes(t.text);

/** Limited local spelling checks; preserve original and report every edit. */
export function preprocessSentence(input,{correctSpelling=true}={}){
 const original=String(input??"");
 if(!original.trim()||original.length>180)throw Error("문장은 1자 이상 180자 이하로 입력하세요.");
 let sentence=original.normalize("NFC").trim().replace(/\s+/gu," ");
 const corrections=[];
 const replace=(pattern,value,reason)=>{
  sentence=sentence.replace(pattern,(...args)=>{
   const before=args[0],after=typeof value==="function"?value(...args):value;
   if(before!==after)corrections.push({before,after,reason});return after;
  });
 };
 if(sentence!==original)corrections.push({before:original,after:sentence,reason:"유니코드·공백 정규화"});
 if(correctSpelling){
  replace(/(거|이|는|었|았|겠|좋|없|있|크)구만(?=[.!?。？！…]|$)/gu,(_,a)=>a+"구먼","종결 어미 ‘-구만’의 표준 표기는 ‘-구먼’입니다.");
  replace(/(할|갈|볼|먹을|읽을)수(?=\s|[.!?]|$)/gu,(_,a)=>a+" 수","관형사형 뒤의 의존 명사 ‘수’는 띄어 씁니다.");
 }
 // Formatting around a copied sentence is not a linguistic token.
 let wrapped=sentence;
 if(wrapped.startsWith("**")&&wrapped.endsWith("**"))wrapped=wrapped.slice(2,-2).trim();
 if((wrapped.startsWith('"')&&wrapped.endsWith('"'))||(wrapped.startsWith('“')&&wrapped.endsWith('”')))wrapped=wrapped.slice(1,-1).trim();
 if(wrapped!==sentence){corrections.push({before:sentence,after:wrapped,reason:"문장 둘레의 인용·강조 표시 제거"});sentence=wrapped;}
 return {original,sentence,corrections,correctSpelling,spellingScope:"공백 및 등록된 맞춤법 규칙 검사"};
}

/** Generate actual present declaratives as lexical evidence, not suffix guessing. */
export function presentDeclarative(root,pos=rules.predicates[root]){
 if(!root||!["VV","VX","VA","VCN"].includes(pos))return null;
 if(!["VV","VX"].includes(pos))return {form:root+"다",acceptsNda:false,pos,
  reason:"상태를 나타내는 이 용언은 현재 평서형에서 ‘-다’를 취합니다. ‘있다·없다’의 ‘-는’ 관형형은 예외입니다."};
 const h=syllable(root);
 const form=!h||h.final===0?withFinal(root,4)+"다":h.final===8?withFinal(root,4)+"다":root+"는다";
 return {form,acceptsNda:true,pos,reason:"현재 동작을 나타내는 ‘"+form+"’처럼 ‘-ㄴ다/-는다’와 결합하는 동사입니다."};
}

function predicateCandidate(word,additional={}){
 const lexemes={...additional,...rules.predicates};
 const candidates=[];
 const add=(root,ending,rule)=>{
  const pos=lexemes[root],ep=[];
  if(!pos)return;
  let rest=ending;
  while(/^(았|었|였|겠|시)/u.test(rest)){ep.push(rest[0]);rest=rest.slice(1);}
  const tag=rules.endings[rest];if(!tag)return;
  if(["ㄴ다","는다","는구먼","는구만"].includes(rest)&&!["VV","VX"].includes(pos))return;
  if(rest==="는"&&!["VV","VX"].includes(pos)&&!["있","없"].includes(root))return;
  candidates.push([token(root,pos,rule,{lemma:root+"다",present:presentDeclarative(root,pos)}),
   ...ep.map(e=>token(e,"EP",rule)),token(rest,tag,rule)]);
 };
 for(const [surface,[root,vowel,rule]] of Object.entries(rules.restorations)){
  if(word===surface)add(root,vowel,rule);
  if(word.startsWith(surface)){
   const tail=word.slice(surface.length);
   if(tail){
    // 써도 = 쓰+어도; 썼다 = 쓰+었+다 is handled separately below.
    add(root,vowel+tail,rule);
   }
  }
  if(syllable(surface)?.final===0){
   const past=withFinal(surface,20);
   if(word.startsWith(past))add(root,(vowel==="아"?"았":"었")+word.slice(past.length),rule+"·과거");
  }
 }
 for(const [root,pos] of Object.entries(lexemes)){
  if(word.startsWith(root))add(root,word.slice(root.length),"어간·어미 사전 결합");
  const h=syllable(root);
  if(!h)continue;
  // A consonantal ending is written as a final consonant on the last syllable.
  if(h.final===0||h.final===8){
   for(const [jong,ending] of [[4,"ㄴ"],[8,"ㄹ"],[16,"ㅁ"],[17,"ㅂ"]]){
    const fused=withFinal(root,jong);
    if(word.startsWith(fused))add(root,ending+word.slice(fused.length),"받침형 어미 분리");
   }
  }
  if(h.final===8){
   const dropped=withFinal(root,0);
   if(word.startsWith(dropped))add(root,word.slice(dropped.length),"ㄹ 탈락");
  }
  if(pos==="VV"&&word===presentDeclarative(root,pos).form)add(root,h.final&&h.final!==8?"는다":"ㄴ다","현재 평서형 검사");
  // Compound 하다 predicates share the same 해/했 restoration.
  if(root.endsWith("하"))for(const [suffix,ending] of [["해","여"],["했","였"]]){
   const fused=root.slice(0,-1)+suffix;
   if(word.startsWith(fused))add(root,ending+word.slice(fused.length),"하다 활용·축약 복원");
  }
 }
 return candidates.sort((a,b)=>b[0].text.length-a[0].text.length)[0];
}

function lexicalTag(base,previous,model){
 const modelNoun=model.find(t=>t.text===base&&/^(NNG|NNP|NNB|NP|NR)$/.test(t.pos));
 if(dependent.has(base)&&previous?.some(t=>t.pos==="ETM"))return "NNB";
 if(rules.counters.includes(base)&&previous?.some(quantity))return "NNB";
 if(["내","네","제"].includes(base))return "NP";
 if(proper.has(base))return "NNP";
 if(rules.lexicon[base])return rules.lexicon[base];
 if(nouns.has(base))return "NNG";
 return modelNoun?.pos||"NNG";
}

function modelNominalBase(model){
 const split=model.findIndex(t=>/^J/.test(t.pos));
 const head=split<0?model:model.slice(0,split),tail=split<0?[]:model.slice(split);
 return head.length&&head.every(t=>/^NN/.test(t.pos))&&tail.every(t=>/^J/.test(t.pos))?head.map(t=>t.text).join(""):"";
}

function nominalCandidate(word,previous,model,{fallback=false}={}){
 if(rules.lexicon[word])return [token(word,lexicalTag(word,previous,model),"기능어 사전",{confidence:"rule"})];
 const copula=word.match(/^(.+?)(이)(구먼|구만|다|고|면|니|었다|었어요|네요|라)$/u)||
  word.match(/^(거|학생|사람|친구|학교|고양이)(이?)(구먼|구만|다|고|면|니)$/u);
 if(copula){
  const [,base,visible,ending]=copula;
  // Consonant-final nouns cannot freely omit 이-. Don't manufacture 것이다 -> 것다.
  if(!visible&&syllable(base)?.final)return null;
  const dep=dependent.has(base),rule=base==="거"?"것→거 축약·서술격 조사 이- 복원":"체언·서술격 조사 분리";
  if(!nouns.has(base)&&!dep&&!model.some(t=>t.pos==="VCP")&&!fallback)return null;
  const past=ending.startsWith("었");
  return [token(base==="거"?"것":base,dep?"NNB":lexicalTag(base,previous,model),rule,{surface:base}),
   token("이","VCP",rule,{lemma:"이다",surface:visible}),...(past?[token("었","EP",rule)]:[]),
   token(past?ending.slice(1):ending,rules.endings[past?ending.slice(1):ending]||"EF",rule)];
 }
 let base=word,particles=[];
 const suffixes=Object.keys(rules.particles).sort((a,b)=>b.length-a.length);
 const compound=modelNominalBase(model);
 const knownBase=b=>nouns.has(b)||dependent.has(b)||rules.lexicon[b]||b===compound||model.some(t=>t.text===b&&/^(NN|NP|NR)/.test(t.pos));
 while(base&&!knownBase(base)){
  const suffix=suffixes.find(s=>base.length>s.length&&base.endsWith(s));
  if(!suffix)break;
  const fromModel=model.find(t=>t.text===suffix&&/^J/.test(t.pos));
  particles.unshift(token(suffix,fromModel?.pos||rules.particles[suffix],"체언·조사 경계"));base=base.slice(0,-suffix.length);
 }
 const known=knownBase(base);
 if(!known&&!fallback)return null;
 for(let i=1;i<particles.length;i++)if(particles[i].text==="만큼"&&particles.slice(0,i).some(t=>/^JK/.test(t.pos)))particles[i].pos="JX";
 // One case relation may be followed by focus particles. A second case or
 // vocative inside a chain signals a word boundary, not another suffix.
 const caseCount=particles.filter(t=>/^JK/.test(t.pos)||t.pos==="JC").length;
 const baseTag=lexicalTag(base,previous,model);
 if(caseCount>1||particles.some(t=>t.pos==="JKV")&&particles.length>1)return null;
 if(particles.length&&!/^(NN|NP|NR|SN)/.test(baseTag)&&!(baseTag==="MAG"&&particles.every(t=>t.pos==="JX")))return null;
 const modified=previous?.some(t=>t.pos==="ETM");
 // A modifier raises a dependent-noun candidate only within this lexical set.
 const isDep=dependent.has(base)&&modified;
 return [token(base,isDep?"NNB":lexicalTag(base,previous,model),
  isDep?"관형사형+띄어쓰기+의존 명사 후보":known?"체언·기능어 사전":"조사 경계·체언 위치로 미등록 명사 추정",
  {confidence:known?"rule":"context"}),...particles];
}

function fallbackCandidate(word,previous,model){
 if(/^\d+(?:[.,]\d+)?$/.test(word))return [token(word,"SN","숫자 표기")];
 // A productive 하다 suffix is stronger evidence than a noun-shaped remainder.
 const derived=word.match(/^(.+?)(하|해|했)(.+)$/u);
 if(derived){
  const [,base,form,tail]=derived,ending=(form==="해"?"여":form==="했"?"였":"")+tail;
  let rest=ending,ep=[];
  while(/^(았|었|였|겠|시)/u.test(rest)){ep.push(token(rest[0],"EP","생산적 하다 파생"));rest=rest.slice(1);}
  if(rules.endings[rest])return [token(base+"하","VV","생산적 하다 파생·문맥 추정",{lemma:base+"하다",confidence:"context"}),...ep,token(rest,rules.endings[rest],"어미 사전")];
 }
 return nominalCandidate(word,previous,model,{fallback:true})||[token(word,"NNG","조사 결합 조건에 맞지 않아 원형을 유지한 미등록어",{confidence:"context"})];
}

// Whitespace is a hint, not a token boundary. A small Viterbi beam compares
// lexical/inflection/particle paths; it never inserts or deletes characters.
function splitRun(run,model,nextCore=""){
 if(rules.lexicon[run]||nouns.has(run)||dependent.has(run)||proper.has(run))return [run];
 if(model.length===1&&model[0].text===run&&["MM","MAG","MAJ","IC","NP","NR"].includes(model[0].pos))return [run];
 const extra={};
 for(let i=0;i<model.length;i++){
  const t=model[i];
  if(["VV","VA","VCN","VX"].includes(t.pos))extra[t.text]=t.pos;
  if(["XSV","XSA"].includes(t.pos)&&/^NN/.test(model[i-1]?.pos))extra[model[i-1].text+t.text]=t.pos==="XSV"?"VV":"VA";
 }
 const fullPredicate=predicateCandidate(run,extra),fullNominal=nominalCandidate(run,[],model);
 const suspiciousName=model.some(t=>t.pos==="NNP"&&t.text===run)&&!proper.has(run)&&!nouns.has(run)&&run.length>7&&/(다|요|어요|아요)$/.test(run);
 const registered=t=>t&&(nouns.has(t.text)||dependent.has(t.text)||proper.has(t.text)||rules.lexicon[t.text]);
 const nextNominal=nominalCandidate(nextCore,[],[]);
 const countContext=nextNominal&&rules.counters.includes(nextNominal[0].text)&&run.endsWith("한")&&
  nouns.has(run.slice(0,-1))&&fullPredicate&&!rules.predicates[fullPredicate[0].text];
 if((fullPredicate&&!countContext||fullNominal&&registered(fullNominal[0]))&&!suspiciousName)return [run];
 const cache=new Map(),states=Array.from({length:run.length+1},()=>[]);
 states[0]=[{cost:0,path:[],tokens:[]}];
 const candidates=word=>{
  if(cache.has(word))return cache.get(word);
  const out=[],p=predicateCandidate(word,extra),n=nominalCandidate(word,[],model);
  if(p)out.push({tokens:p,cost:rules.predicates[p[0].text]?1.5:5});
  if(n)out.push({tokens:n,cost:registered(n[0])?(n.length>1?1.4:1.9):5+n[0].text.length*0.5});
  if(!n){
   const inferred=nominalCandidate(word,[],model,{fallback:true});
   if(inferred?.length>1&&/^(NN|NP|NR)/.test(inferred[0].pos)&&inferred[0].text.length>=2&&inferred[0].text.length<=6)
    out.push({tokens:inferred,cost:5+inferred[0].text.length*0.5});
  }
  if(/^\d+$/.test(word))out.push({tokens:[token(word,"SN","숫자")],cost:1.8});
  cache.set(word,out);return out;
 };
 const transition=(prior,next)=>{
  const last=prior.at(-1),first=next[0];let cost=0;
  if(last?.pos==="MM")cost+=/^(NN|NP|NR|SN)/.test(first.pos)?-1:4;
  if(last?.pos==="ETM")cost+=/^(NN|NP|NR)/.test(first.pos)?-0.5:4;
  if(rules.counters.includes(first.text)&&prior.some(quantity))cost-=1.5;
  if(first.pos==="NNB"&&!prior.some(t=>["ETM","MM","NR","SN"].includes(t.pos)))cost+=2;
  if(last?.pos==="EC"&&/^(V|XSV|XSA)/.test(first.pos))cost-=0.5;
  if(last?.pos==="EF")cost+=8;
  return cost;
 };
 for(let i=0;i<run.length;i++){
  const beam=states[i].sort((a,b)=>a.cost-b.cost).slice(0,8);
  if(!beam.length)continue;
  for(let end=i+1;end<=Math.min(run.length,i+24);end++){
   const word=run.slice(i,end),opts=candidates(word);
   if(!opts.length&&word.length<=12)opts.push({tokens:[token(word,"NNG","미등록",{confidence:"context"})],cost:8+word.length*2});
   for(const prev of beam)for(const option of opts){
    const cost=prev.cost+option.cost+transition(prev.tokens,option.tokens);
    states[end].push({cost,path:[...prev.path,word],tokens:option.tokens});
   }
   if(states[end].length>48)states[end]=states[end].sort((a,b)=>a.cost-b.cost).slice(0,16);
  }
 }
 const best=states[run.length].sort((a,b)=>a.cost-b.cost)[0];
 if(!best||best.path.length===1)return [run];
 const fallbackCost=8+run.length*2;
 return best.cost<fallbackCost-2?best.path:[run];
}

export function recoverWordBoundaries(sentence,modelTokens=[]){
 const pieces=[],changes=[];
 const matches=[...sentence.matchAll(/\S+/gu)];
 for(const [index,match] of matches.entries()){
  const surface=match[0],core=clean(surface),prefix=surface.slice(0,surface.indexOf(core)),suffix=surface.slice(surface.indexOf(core)+core.length);
  if(!core){pieces.push(surface);continue;}
  const model=modelTokens.filter(t=>t.start>=match.index&&t.start<match.index+surface.length&&!/^S[FWPSOECL]$/.test(t.pos));
  const split=splitRun(core,model,clean(matches[index+1]?.[0]||""));
  if(split.length>1)changes.push({before:surface,after:prefix+split.join(" ")+suffix,reason:"조사·어미 경계와 앞뒤 품사 후보로 띄어쓰기 복원"});
  pieces.push(prefix+split.join(" ")+suffix);
 }
 return {sentence:pieces.join(" "),changes};
}

/** Merge deterministic candidates with Garu; offsets refer to corrected text. */
export function analyzeHybrid(sentence,modelTokens=[],{recoverSpacing=true}={}){
 const layout=recoverSpacing?recoverWordBoundaries(sentence,modelTokens):{sentence,changes:[]};
 if(layout.sentence!==sentence){sentence=layout.sentence;modelTokens=[];}
 const words=[];
 const matches=[...sentence.matchAll(/\S+/gu)];
 for(const [index,match] of matches.entries()){
  const surface=match[0],word=clean(surface),start=match.index,end=start+surface.length;
  const model=modelTokens.filter(t=>t.start>=start&&t.start<end&&!/^S[FWPSOECL]$/.test(t.pos)).map(t=>({...t}));
  const previous=words.at(-1)?.tokens;
  const nominal=nominalCandidate(word,previous,model),predicate=predicateCandidate(word);
  // Model support for lexical categories guards unknown compounds and particles.
  const dependentContext=nominal?.[0]?.pos==="NNB"&&previous?.some(t=>t.pos==="ETM");
  const completeModel=model.length&&model.some(t=>/^(NN|NP|NR|V|M|IC|SN|SL|SH)/.test(t.pos))&&!model.some(t=>t.pos==="NA");
  const modelVerb=model.find(t=>["VV","VA","VX","VCN"].includes(t.pos));
  const bareModelNoun=completeModel&&model.length===1&&/^(NN|NP|NR|MM|MAG|MAJ|IC)/.test(model[0].pos)&&model[0].text===word&&(!predicate||predicate.at(-1).pos==="ETM");
  let selected=dependentContext?nominal:bareModelNoun?nominal||model:predicate||nominal||(completeModel?model:null)||fallbackCandidate(word,previous,model);
  // Homographs are determined by the next head and clause position.
  const nextWord=clean(matches[index+1]?.[0]||"");
  if(nominal?.[0]?.pos==="NP"&&predicate?.at(-1)?.pos==="ETM"){
   const nextNominal=nominalCandidate(nextWord,[],[]),nextParticle=nextNominal?.at(-1)?.pos;
   const modifiesNoun=nextNominal&&/^(NN|NP|NR)/.test(nextNominal[0].pos)&&(!/^J/.test(nextParticle)||nextParticle==="JKS");
   if(completeModel)selected=modelVerb?predicate:nominal;
   else if(!modifiesNoun)selected=nominal;
  }
  if(["MAG","MAJ","IC"].includes(rules.lexicon[word])&&!modelVerb)
   selected=[token(word,rules.lexicon[word],"부사·감탄사 사전과 문장 문맥")];
  if((["한","두","세","네","이","그","저","새","헌"].includes(word)||/^(첫째|둘째|셋째|넷째|다섯째|여섯째|일곱째|여덟째|아홉째|열째)$/.test(word))&&nextWord&&
     (nouns.has(nextWord)||nominalCandidate(nextWord,[],[])?.[0])&&!predicateCandidate(nextWord)){
   selected=[token(word,"MM","뒤 체언을 수식하는 관형사 문맥")];
  }
  selected=selected.map(t=>({...t,start,end}));
  const nnb=selected.find(t=>["NNG","NNB"].includes(t.pos)&&dependent.has(t.text));
  if(nnb&&previous?.some(t=>t.pos==="ETM")){
   nnb.pos="NNB";nnb.rule="관형사형+띄어쓰기+의존 명사 후보";
  }
  // A real present marker corroborates VV, but do not override VA lexemes or EP+다.
  const verb=selected.find(t=>["VV","VA","VX","VCN"].includes(t.pos));
  if(verb){
   const known=rules.predicates[verb.text];
   if(predicate&&modelVerb?.text===verb.text&&modelVerb.pos!==verb.pos){
    verb.pos=modelVerb.pos;verb.confidence="context";
    verb.rule+="; 동형 어간의 품사는 문장 모델의 문맥 판별을 적용";
   }
   verb.present=presentDeclarative(verb.text,verb.pos||known);
  }
  const last=selected.at(-1);
  if(last?.pos==="EC"&&["아","어"].includes(last.text)&&(/[.!?。？！…]$/u.test(surface)||end===sentence.length))last.pos="EF";
  const restored=selected.some(t=>/탈락|불규칙|축약|받침형|복원/.test(t.rule||""));
  selected.forEach(t=>{delete t.uncertain;t.rule ||= "문장 형태소 모델의 문맥 분석";});
  const gradeable=selected.some(t=>/^(NN|NP|NR|V|M|IC|SN|SL|SH)/.test(t.pos));
  words.push({surface,start,end,tokens:selected,restored,gradeable,
   analysis:selected.map(t=>t.text).join("/"),rules:[...new Set(selected.map(t=>t.rule).filter(Boolean))]});
 }
 for(let i=0;i<words.length;i++){
  const w=words[i],previous=words[i-1]?.tokens||[],following=words[i+1]?.tokens||[];
  const first=w.tokens[0];
  if(first&&rules.counters.includes(first.text)&&previous.some(quantity)){
   first.pos="NNB";first.rule="수량 관형사·수사 뒤의 단위 의존 명사";
  }
  if(clean(w.surface)==="다른"){
   const comparison=previous.some(t=>t.pos==="JKS")&&previous.some(t=>["성격","색깔","의견","모양","종류","크기","방법","생김새"].includes(t.text))||
    previous.some(t=>t.pos==="JKB"&&["과","와","보다"].includes(t.text)||["서로","전혀","매우","아주"].includes(t.text));
   w.tokens=comparison?[token("다르","VA","주격·비교 성분을 갖춘 관형절: 다르-+-ㄴ",{lemma:"다르다",start:w.start,end:w.end}),token("ㄴ","ETM","형용사 관형사형",{start:w.start,end:w.end})]:
    [token("다른","MM","‘딴’으로 바꾸어 뒤 체언을 한정하는 성상 관형사",{start:w.start,end:w.end})];
  }
  for(const t of w.tokens)if(["과","와","랑","이랑","하고"].includes(t.text)&&/^J/.test(t.pos)){
   const shared=following.some(t=>["같이","함께","서로"].includes(t.text));
   const compare=following.some(t=>t.text==="다르"||t.text==="같");
   if(shared||compare){t.pos="JKB";t.rule="함께함·비교를 나타내는 뒤 표현과 결합하는 부사격 조사";}
   else if(following.some(t=>["NNG","NNP","NP","NR"].includes(t.pos))) {t.pos="JC";t.rule="뒤 체언과 같은 자격으로 이어 주는 접속 조사";}
   else if(following.some(t=>/^(VV|VA|VX)/.test(t.pos))){t.pos="JKB";t.rule="뒤 서술어와 동반·비교 관계를 이루는 부사격 조사";}
  }
  for(const t of w.tokens)if(t.text==="만큼"&&/^J/.test(t.pos)&&w.tokens.some(t=>["은","는"].includes(t.text))){
   const earlierSubject=words.slice(0,i).some(x=>x.tokens.some(t=>t.pos==="JKS"||t.pos==="JX"&&["은","는","도"].includes(t.text)));
   const followingClause=words.slice(i+1).slice(0,4);
   const comparative=earlierSubject||followingClause.some(x=>x.tokens.some(t=>["크","작","많","적","빠르"].includes(t.text)||t.pos==="JKS"));
   if(!comparative&&["NP","NNP"].includes(first?.pos)){
    t.pos="JX";t.rule="다른 대상과 견주기보다 ‘적어도 그 대상만은’이라는 한정을 우선한 보조사";
    t.acceptedPos=["JKB"];t.alternativeReason="비슷한 정도·한도의 뜻으로 읽으면 ‘만큼’을 부사격 조사로 분석하는 해석도 가능합니다.";
   }
  }
  const verb=w.tokens.find(t=>["VV","VA","VX"].includes(t.pos));
  if(verb&&rules.auxiliaryEndings[verb.text]&&previous.at(-1)?.pos==="EC"){
   const ending=previous.at(-1).text;
   if(rules.auxiliaryEndings[verb.text].includes(ending)){
    verb.pos=verb.text==="싶"||verb.text==="않"&&previous.some(t=>t.pos==="VA")?"VA":"VX";verb.auxiliary=true;
    verb.rule+="; 앞 용언과 연결된 보조 용언 구성";
    w.auxiliaryOf=i-1;
   }
  }
  const next=words[i+1]?.tokens.find(t=>["VV","VCN"].includes(t.pos));
  const priorSubject=words.slice(0,i).some(w=>w.tokens.some(t=>t.pos==="JKS"));
  if(priorSubject&&next&&["되","아니"].includes(next.text)){
   for(const t of words[i].tokens)if(["이","가"].includes(t.text)&&t.pos==="JKS"){
    t.pos="JKC";t.rule="앞 주어와 ‘되다·아니다’ 문맥으로 보격 판별";
   }
  }
  w.analysis=w.tokens.map(t=>t.text).join("/");
  w.rules=[...new Set(w.tokens.map(t=>t.rule).filter(Boolean))];
  w.restored=w.rules.some(rule=>/탈락|불규칙|축약|받침형|복원/.test(rule));
 }
 return {tokens:words.flatMap(w=>w.tokens),words,sentence,spacingChanges:layout.changes};
}
