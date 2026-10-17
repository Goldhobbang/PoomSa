import rules from "./grammar-rules.json" with {type:"json"};

const nouns=new Set(rules.nouns),dependent=new Set(rules.dependentNouns),proper=new Set(rules.properNouns);
const clean=s=>s.replace(/^[“‘"'([{]+|[,.!?。？！…;:”’"')\]}]+$/gu,"");
const syllable=s=>{const n=s.charCodeAt(s.length-1)-0xac00;return n>=0&&n<11172?{n,final:n%28}:null;};
const withFinal=(s,n)=>{const h=syllable(s);return h?s.slice(0,-1)+String.fromCharCode(0xac00+h.n-h.final+n):s;};
const token=(text,pos,rule,extra={})=>({text,pos,rule,...extra});

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
 return {original,sentence,corrections,correctSpelling,spellingScope:"공백 및 등록된 맞춤법 규칙 검사"};
}

/** Generate actual present declaratives as lexical evidence, not suffix guessing. */
export function presentDeclarative(root,pos=rules.predicates[root]){
 if(!root||!["VV","VA","VCN"].includes(pos))return null;
 if(pos!=="VV")return {form:root+"다",acceptsNda:false,pos,
  reason:"상태를 나타내는 이 용언은 현재 평서형에서 ‘-다’를 취합니다. ‘있다·없다’의 ‘-는’ 관형형은 예외입니다."};
 const h=syllable(root);
 const form=!h||h.final===0?withFinal(root,4)+"다":h.final===8?withFinal(root,4)+"다":root+"는다";
 return {form,acceptsNda:true,pos,reason:"현재 동작을 나타내는 ‘"+form+"’처럼 ‘-ㄴ다/-는다’와 결합하는 동사입니다."};
}

function predicateCandidate(word){
 const candidates=[];
 const add=(root,ending,rule)=>{
  const pos=rules.predicates[root],ep=[];
  if(!pos)return;
  let rest=ending;
  while(/^(았|었|였|겠|시)/u.test(rest)){ep.push(rest[0]);rest=rest.slice(1);}
  const tag=rules.endings[rest];if(!tag)return;
  if(["ㄴ다","는다","는구먼","는구만"].includes(rest)&&pos!=="VV")return;
  if(rest==="는"&&pos!=="VV"&&!["있","없"].includes(root))return;
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
 for(const [root,pos] of Object.entries(rules.predicates)){
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
 if(modelNoun)return modelNoun.pos;
 if(["내","네","제"].includes(base))return "NP";
 if(proper.has(base))return "NNP";
 return rules.lexicon[base]||"NNG";
}

function nominalCandidate(word,previous,model,{fallback=false}={}){
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
 const knownBase=b=>nouns.has(b)||dependent.has(b)||rules.lexicon[b]||model.some(t=>t.text===b&&/^(NN|NP|NR)/.test(t.pos));
 while(base&&!knownBase(base)){
  const suffix=suffixes.find(s=>base.length>s.length&&base.endsWith(s));
  if(!suffix)break;
  particles.unshift(token(suffix,rules.particles[suffix],"체언·조사 경계"));base=base.slice(0,-suffix.length);
 }
 const known=knownBase(base);
 if(!known&&!fallback)return null;
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
 return nominalCandidate(word,previous,model,{fallback:true});
}

/** Merge deterministic candidates with Garu; offsets refer to corrected text. */
export function analyzeHybrid(sentence,modelTokens=[]){
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
  const bareModelNoun=completeModel&&model.length===1&&/^(NN|NP|NR|MM|MAG|MAJ|IC)/.test(model[0].pos)&&model[0].text===word;
  let selected=dependentContext?nominal:bareModelNoun?model:predicate||nominal||(completeModel?model:null)||fallbackCandidate(word,previous,model);
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
  if(["한","두","세","네","이","그","저","새","헌"].includes(word)&&nextWord&&
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
  const next=words[i+1]?.tokens.find(t=>["VV","VCN"].includes(t.pos));
  const priorSubject=words.slice(0,i).some(w=>w.tokens.some(t=>t.pos==="JKS"));
  if(priorSubject&&next&&["되","아니"].includes(next.text)){
   for(const t of words[i].tokens)if(["이","가"].includes(t.text)&&t.pos==="JKS"){
    t.pos="JKC";t.rule="앞 주어와 ‘되다·아니다’ 문맥으로 보격 판별";
   }
   words[i].rules=[...new Set(words[i].tokens.map(t=>t.rule).filter(Boolean))];
  }
 }
 return {tokens:words.flatMap(w=>w.tokens),words};
}
