import rules from "./grammar-rules.json" with {type:"json"};

const nouns=new Set(rules.nouns),dependent=new Set(rules.dependentNouns);
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
  while(/^(았|었|겠|시)/u.test(rest)){ep.push(rest[0]);rest=rest.slice(1);}
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
   for(const [jong,ending] of [[4,"ㄴ"],[8,"ㄹ"],[16,"ㅁ"]]){
    const fused=withFinal(root,jong);
    if(word.startsWith(fused))add(root,ending+word.slice(fused.length),"받침형 어미 분리");
   }
  }
  if(h.final===8){
   const dropped=withFinal(root,0);
   if(word.startsWith(dropped))add(root,word.slice(dropped.length),"ㄹ 탈락");
  }
  if(pos==="VV"&&word===presentDeclarative(root,pos).form)add(root,h.final&&h.final!==8?"는다":"ㄴ다","현재 평서형 검사");
 }
 return candidates.sort((a,b)=>b[0].text.length-a[0].text.length)[0];
}

function nominalCandidate(word,previous,model){
 const copula=word.match(/^(거|것|학생|사람|친구|학교|고양이)(이?)(구먼|구만|다|고|면|니)$/u);
 if(copula){
  const [,base,visible,ending]=copula;
  // Consonant-final nouns cannot freely omit 이-. Don't manufacture 것이다 -> 것다.
  if(!visible&&syllable(base)?.final)return null;
  const dep=dependent.has(base),rule=base==="거"?"것→거 축약·서술격 조사 이- 복원":"체언·서술격 조사 분리";
  return [token(base==="거"?"것":base,dep?"NNB":"NNG",rule,{surface:base}),
   token("이","VCP",rule,{lemma:"이다",surface:visible}),token(ending,rules.endings[ending],rule)];
 }
 let base=word,particles=[];
 const suffixes=Object.keys(rules.particles).sort((a,b)=>b.length-a.length);
 while(base&&!nouns.has(base)&&!dependent.has(base)){
  const suffix=suffixes.find(s=>base.length>s.length&&base.endsWith(s));
  if(!suffix)break;
  particles.unshift(token(suffix,rules.particles[suffix],"체언·조사 경계"));base=base.slice(0,-suffix.length);
 }
 const known=nouns.has(base)||dependent.has(base);
 if(!known)return null;
 const modified=previous?.some(t=>t.pos==="ETM");
 // A modifier raises a dependent-noun candidate only within this lexical set.
 const isDep=dependent.has(base)&&modified;
 if(dependent.has(base)&&!modified&&!model.some(t=>t.pos==="NNB"))return null;
 return [token(base,isDep?"NNB":model.find(t=>/^(NNG|NNP|NNB)$/.test(t.pos))?.pos||"NNG",
  isDep?"관형사형+띄어쓰기+의존 명사 후보":"명사 사전",{uncertain:!isDep&&dependent.has(base)}),...particles];
}

/** Merge deterministic candidates with Garu; offsets refer to corrected text. */
export function analyzeHybrid(sentence,modelTokens=[]){
 const words=[];
 for(const match of sentence.matchAll(/\S+/gu)){
  const surface=match[0],word=clean(surface),start=match.index,end=start+surface.length;
  const model=modelTokens.filter(t=>t.start>=start&&t.start<end&&!/^S[FWPSOECL]$/.test(t.pos)).map(t=>({...t}));
  const previous=words.at(-1)?.tokens;
  const nominal=nominalCandidate(word,previous,model),predicate=predicateCandidate(word);
  // Model support for lexical categories guards unknown compounds and particles.
  const dependentContext=nominal?.[0]?.pos==="NNB"&&previous?.some(t=>t.pos==="ETM");
  let selected=dependentContext?nominal:predicate||nominal||model;
  if(!selected.length)selected=[token(word,"NA","미등록어: 품사 판정 보류")];
  selected=selected.map(t=>({...t,start,end}));
  const nnb=selected.find(t=>["NNG","NNB"].includes(t.pos)&&dependent.has(t.text));
  if(nnb&&previous?.some(t=>t.pos==="ETM")){
   nnb.pos="NNB";nnb.rule="관형사형+띄어쓰기+의존 명사 후보";
  }
  // A real present marker corroborates VV, but do not override VA lexemes or EP+다.
  const verb=selected.find(t=>["VV","VA","VX","VCN"].includes(t.pos));
  if(verb){
   const known=rules.predicates[verb.text];
   const modelVerb=model.find(t=>t.text===verb.text&&["VV","VA","VX","VCN"].includes(t.pos));
   if(predicate&&modelVerb&&modelVerb.pos!==verb.pos){
    verb.pos=modelVerb.pos;verb.uncertain=true;
    verb.rule+="; 사전·모델의 품사 충돌로 채점 보류";
   }
   if(predicate&&!modelVerb&&model.some(t=>/^(NNG|NNP|NNB|NP|NR)$/.test(t.pos))){
    verb.uncertain=true;verb.rule+="; 체언·용언 후보 충돌로 채점 보류";
   }
   verb.present=presentDeclarative(verb.text,verb.uncertain?verb.pos:known||verb.pos);
  }
  const last=selected.at(-1);
  if(last?.pos==="EC"&&["아","어"].includes(last.text)&&(/[.!?。？！…]$/u.test(surface)||end===sentence.length))last.pos="EF";
  const restored=selected.some(t=>/탈락|불규칙|축약|받침형|복원/.test(t.rule||""));
  const gradeable=selected.every(t=>t.pos!=="NA"&&!t.uncertain)&&!!(predicate||nominal);
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
