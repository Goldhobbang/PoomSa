/**
 * Print-aligned Korean school grammar taxonomies.
 * An orthogonal facet (noun name/status, verb conjugation) is NOT a child POS.
 * Model tags, lexical stems and clause context complete the subtype axes.
 */
import rules from "./grammar-rules.json" with {type:"json"};
export const POS_FACETS = {
 "명사":[
  {id:"nounKind",label:"이름의 범위",choices:["고유 명사","보통 명사"]},
  {id:"nounIndependence",label:"자립성",choices:["자립 명사","의존 명사"]}
 ],
 "대명사":[{id:"pronounKind",label:"대명사 종류",choices:["인칭 대명사","지시 대명사","미지칭 대명사","부정칭 대명사","재귀칭 대명사"],
  next:{ "인칭 대명사":{id:"person",label:"인칭",choices:["1인칭","2인칭","3인칭"]},
         "지시 대명사":{id:"demonstrative",label:"지시 대상",choices:["사물 지시","장소 지시"]} }}],
 "수사":[{id:"numeralKind",label:"수사 종류",choices:["양수사","서수사"]}],
 "동사":[
  {id:"verbArguments",label:"서술어의 목적어 요구",choices:["자동사","타동사"],annotation:"보충 분류: 목적어 필요 여부"},
  {id:"conjugation",label:"활용 방식 (품사와 별개)",choices:["규칙 활용","불규칙 활용"],next:{
   "규칙 활용":{id:"regularKind",label:"규칙 활용 현상",choices:["일반 규칙","ㅡ 탈락","ㄹ 탈락"]},
   "불규칙 활용":{id:"irregularKind",label:"불규칙 유형",choices:["ㄷ 불규칙","ㅂ 불규칙","ㅅ 불규칙","르 불규칙","우 불규칙","여 불규칙","러 불규칙","너라 불규칙","거라 불규칙","ㅎ 불규칙"]}
  }}
 ],
 "형용사":[
  {id:"adjectiveKind",label:"형용사의 뜻",choices:["성상 형용사","지시 형용사"]},
  {id:"conjugation",label:"활용 방식 (품사와 별개)",choices:["규칙 활용","불규칙 활용"],next:{
    "규칙 활용":{id:"regularKind",label:"규칙 활용 현상",choices:["일반 규칙","ㅡ 탈락","ㄹ 탈락"]},
    "불규칙 활용":{id:"irregularKind",label:"불규칙 유형",choices:["ㄷ 불규칙","ㅂ 불규칙","ㅅ 불규칙","르 불규칙","우 불규칙","여 불규칙","러 불규칙","너라 불규칙","거라 불규칙","ㅎ 불규칙"]}
  }}
 ],
 "관형사":[{id:"determinerKind",label:"관형사 종류",choices:["성상 관형사","지시 관형사","수 관형사"]}],
 "부사":[{id:"adverbKind",label:"부사 종류",choices:["성분 부사","문장 부사"],next:{
   "성분 부사":{id:"adverbComponent",label:"성분 부사의 기능",choices:["성상 부사","지시 부사","부정 부사"]},
   "문장 부사":{id:"adverbSentence",label:"문장 부사의 기능",choices:["화자 태도·양태","접속 기능"]}
 }}],
 "감탄사":[{id:"interjectionKind",label:"감탄사 기능",choices:["감정","의지","호응","구습·입버릇"]}],
 "조사":[{id:"particleKind",label:"조사 종류",choices:["격조사","보조사","접속 조사"],next:{
   "격조사":{id:"caseKind",label:"격조사 종류",choices:["주격 조사","목적격 조사","보격 조사","관형격 조사","부사격 조사","호격 조사","서술격 조사"]}
 }}]
};
export function facetGroups(pos,answers={}){
 const output=[];
 for(const group of POS_FACETS[pos]||[]){
  output.push(group);
  const nested=group.next?.[answers[group.id]];
  if(nested)output.push(nested);
 }
 return output;
}
const dictionary = {
 "명사":{
  nounKind:{
   "윤현경":"고유 명사","철수":"고유 명사","영희":"고유 명사","민지":"고유 명사","남대문":"고유 명사","서울":"고유 명사","한국":"고유 명사",
  },
  nounIndependence:{"것":"의존 명사","수":"의존 명사","리":"의존 명사","줄":"의존 명사","뿐":"의존 명사","만큼":"의존 명사","대로":"의존 명사","분":"의존 명사","바":"의존 명사","듯":"의존 명사","양":"의존 명사","그루":"의존 명사","마리":"의존 명사","자루":"의존 명사","이":"의존 명사"}
 },
 "대명사":{
  pronounKind:{
   "나":"인칭 대명사","내":"인칭 대명사","저":"인칭 대명사","우리":"인칭 대명사","저희":"인칭 대명사","너":"인칭 대명사","너희":"인칭 대명사","당신":"인칭 대명사","그대":"인칭 대명사","여러분":"인칭 대명사","그녀":"인칭 대명사","그":"인칭 대명사","이이":"인칭 대명사","이분":"인칭 대명사","그분":"인칭 대명사","저분":"인칭 대명사",
   "이것":"지시 대명사","그것":"지시 대명사","저것":"지시 대명사","여기":"지시 대명사","거기":"지시 대명사","저기":"지시 대명사","어디":"미지칭 대명사","무엇":"미지칭 대명사","자기":"재귀칭 대명사","저마다":"부정칭 대명사"
  },
  person:{"나":"1인칭","내":"1인칭","저":"1인칭","우리":"1인칭","저희":"1인칭","너":"2인칭","너희":"2인칭","당신":"2인칭","그대":"2인칭","여러분":"2인칭","그녀":"3인칭","그":"3인칭","이이":"3인칭","이분":"3인칭","그분":"3인칭","저분":"3인칭"},
  demonstrative:{"이것":"사물 지시","그것":"사물 지시","저것":"사물 지시","여기":"장소 지시","거기":"장소 지시","저기":"장소 지시"}
 },
 "수사":{numeralKind:{"하나":"양수사","둘":"양수사","셋":"양수사","넷":"양수사","백":"양수사","천":"양수사","일":"양수사","삼":"양수사","첫째":"서수사","둘째":"서수사","셋째":"서수사","제일":"서수사","제이":"서수사"}},
 "부사":{
  adverbKind:{"천천히":"성분 부사","너무":"성분 부사","이리":"성분 부사","안":"성분 부사","못":"성분 부사","매우":"성분 부사","빨리":"성분 부사","조용히":"성분 부사","많이":"성분 부사","참":"성분 부사","함께":"성분 부사","과연":"문장 부사","설마":"문장 부사","제발":"문장 부사","결코":"문장 부사","모름지기":"문장 부사","응당":"문장 부사","아마":"문장 부사","정녕":"문장 부사","아무쪼록":"문장 부사","하물며":"문장 부사","그러나":"문장 부사","그런데":"문장 부사","그러므로":"문장 부사","왜냐하면":"문장 부사"},
  adverbComponent:{"천천히":"성상 부사","너무":"성상 부사","매우":"성상 부사","빨리":"성상 부사","조용히":"성상 부사","많이":"성상 부사","참":"성상 부사","함께":"성상 부사","이리":"지시 부사","그리":"지시 부사","저리":"지시 부사","안":"부정 부사","못":"부정 부사"},
  adverbSentence:{"과연":"화자 태도·양태","설마":"화자 태도·양태","제발":"화자 태도·양태","결코":"화자 태도·양태","아마":"화자 태도·양태","모름지기":"화자 태도·양태","정녕":"화자 태도·양태","그러나":"접속 기능","그런데":"접속 기능","그러므로":"접속 기능","왜냐하면":"접속 기능"}
 },
 "감탄사":{interjectionKind:{"아":"감정","아차":"감정","어머":"감정","어머나":"감정","아이고":"감정","아이구머니나":"감정","쉬":"의지","자":"의지","에라":"의지","글쎄":"의지","옳지":"의지","천만에":"의지","그래":"호응","예":"호응","응":"호응","오냐":"호응","머":"구습·입버릇","저":"구습·입버릇","음":"구습·입버릇"}},
 "형용사":{
  adjectiveKind:{"그렇다":"지시 형용사","이렇다":"지시 형용사","저렇다":"지시 형용사","아무렇다":"지시 형용사","그러하다":"지시 형용사","이러하다":"지시 형용사","저러하다":"지시 형용사"}
 }
};
const specialIrregular=new Map([
 ["걷","ㄷ 불규칙"],["듣","ㄷ 불규칙"],["깨닫","ㄷ 불규칙"],["묻","ㄷ 불규칙"],["돕","ㅂ 불규칙"],["덥","ㅂ 불규칙"],["춥","ㅂ 불규칙"],["아름답","ㅂ 불규칙"],["낫","ㅅ 불규칙"],["짓","ㅅ 불규칙"],["붓","ㅅ 불규칙"],["모르","르 불규칙"],["흐르","르 불규칙"],["가르","르 불규칙"],["찌르","르 불규칙"],["푸","우 불규칙"],["하","여 불규칙"],["이르","러 불규칙"],["푸르","러 불규칙"],["오","너라 불규칙"],["가","거라 불규칙"],["파랗","ㅎ 불규칙"],["하얗","ㅎ 불규칙"],["그렇","ㅎ 불규칙"]
]);
const regularRoots=new Set(["먹","자","보","읽","사","웃","달리","맑","예쁘","빠르","작","있","없","열","닫","만나","행동하","좋아하","마시","가","오","쓰","크","살","놀","치르","배우","주","드리","건네","듣","기다리"]);
const transitiveRoots=new Set(["먹","보","읽","사","만나","좋아하","마시","열","닫","배우","드리","주","건네","주","보내","짓","쓰","돕","듣"]);
const intransitiveRoots=new Set(["웃","자","달리","가","오","있","살","놀","걷","내리","울","서"]);
function verbStem(word) {
 const cleaned=String(word||"").replace(/[.,!?]+$/,"");
 // Only infer on a limited, verified list; unknown verbs must stay ungraded.
 if(specialIrregular.has(cleaned.replace(/다$/,"")))return cleaned.replace(/다$/,"");
 for(const k of [...new Set([...transitiveRoots,...intransitiveRoots,...regularRoots,...specialIrregular.keys()])].sort((a,b)=>b.length-a.length)){
  if(cleaned===k+"다"||cleaned.startsWith(k+"어")||cleaned.startsWith(k+"았")||cleaned.startsWith(k+"었")||cleaned.startsWith(k+"는")||cleaned.startsWith(k+"고")||cleaned===k+"는다")return k;
 }
 return "";
}
export function inferFacets(part,{tag="",root="",argumentRoot="",context="",hasObject=false,complete=true}={}) {
 const pos=part?.p,token=String(part?.t||"").replace(/[.,!?]+$/,"");
 const out={};
 if(pos==="조사" && Array.isArray(part.detail)){
   out.particleKind=part.detail[0];
   if(part.detail[0]==="격조사")out.caseKind=part.detail[1];
 }
 if(pos==="관형사" && Array.isArray(part.detail))out.determinerKind=part.detail[0];
 const map=dictionary[pos]||{};
 for(const [id,known] of Object.entries(map)){
   if(known[token])out[id]=known[token];
 }
 if(pos==="명사"){
   if(!out.nounKind && ["NNG","NNB","SL","SH"].includes(tag))out.nounKind="보통 명사";
   if(!out.nounKind && tag==="NNP")out.nounKind="고유 명사";
   if(tag==="NNB")out.nounIndependence="의존 명사";
   if(["NNG","NNP"].includes(tag))out.nounIndependence="자립 명사";
   // Surface-form only independent nouns not context-free predictable if proper and common share spellings.
   if(!out.nounIndependence && ["NNG","NNP"].includes(tag))out.nounIndependence="자립 명사";
   if(!out.nounIndependence && out.nounKind && !["것","수","리","줄","뿐","만큼","대로","분","바","듯","양","그루","마리","자루","이"].includes(token))out.nounIndependence="자립 명사";
   if(!out.nounKind && out.nounIndependence==="자립 명사" && ["밥","꽃","하늘","책","선생님","아이","동생","비","학교","연필","가방","학생","사람","우유","사랑","옛날이야기","친구","음악","상황","수업","시간","공부","여름","날씨","목소리","운동"].includes(token))out.nounKind="보통 명사";
 }
 if(pos==="관형사"&&!out.determinerKind){
   if(/^(그|이|저|무슨|어느|이런|그런|저런)$/.test(token))out.determinerKind="지시 관형사";
   if(/^(두|세|한|네|첫|모든|첫째|둘째|셋째|넷째|다섯째|여섯째|일곱째|여덟째|아홉째|열째)$/.test(token))out.determinerKind="수 관형사";
   if(/^(새|헌)$/.test(token))out.determinerKind="성상 관형사";
 }
 if(pos==="동사"||pos==="형용사"){
   const stem=root||part.lemma?.replace(/다$/,"")||verbStem(token);
   if(pos==="형용사"&&!out.adjectiveKind && stem && !["그렇","이렇","저렇","아무렇","그러하","이러하"].includes(stem))out.adjectiveKind="성상 형용사";
   if(pos==="형용사"&&!out.adjectiveKind && /^(맑|예쁘|빠르|크|작|춥|덥|없|하얗|파랗)/.test(token))out.adjectiveKind="성상 형용사";
   // A few lexemes change class or conjugation by sense/form. Avoid grading those from bare surface.
   const conjugation=stem&&(specialIrregular.get(stem)||
    (stem.endsWith("하")?"여 불규칙":stem.endsWith("르")&&!["따르","치르"].includes(stem)?"르 불규칙":null));
   if(conjugation){
     // 너라/거라 are imperative ending patterns, NOT general lexeme conjugation;
     // require the actual imperative surface before grading.
     const imperative=(conjugation==="너라 불규칙"||conjugation==="거라 불규칙");
     if(!imperative || /(?:너라|거라)$/.test(token)){
       out.conjugation="불규칙 활용";out.irregularKind=conjugation;
     }
   }else if(stem && (regularRoots.has(stem)||complete)){
     out.conjugation="규칙 활용";
     if(Math.floor((stem.charCodeAt(stem.length-1)-0xac00)/28)%21===18&&(stem.charCodeAt(stem.length-1)-0xac00)%28===0)out.regularKind="ㅡ 탈락";
     else if((stem.charCodeAt(stem.length-1)-0xac00)%28===8)out.regularKind="ㄹ 탈락";
     else out.regularKind="일반 규칙";
   }
   if(pos==="동사"){
     const arg=argumentRoot||stem;
     if(arg&&transitiveRoots.has(arg))out.verbArguments="타동사";
     if(arg&&intransitiveRoots.has(arg))out.verbArguments="자동사";
     if(arg&&["찾","사랑하","만들","알","모르","기억하","입","신","잡","던지","기르","기다리","가르치","말하","생각하","닮"].includes(arg))out.verbArguments="타동사";
     if(arg&&["소리지르","소리치","행동하","도착하","일어나","떠나","뛰","되"].includes(arg))out.verbArguments="자동사";
     if(hasObject||rules.frames[arg]?.object)out.verbArguments="타동사";
   }
 }
 // The known POS restricts valid subtype candidates. Context supplies the
 // missing lexical axes; these are learning predictions, not a confidence score.
 if(complete){
  if(pos==="명사"){
   out.nounKind ||= "보통 명사";
   out.nounIndependence ||= "자립 명사";
  }
  if(pos==="대명사"){
   out.pronounKind ||= /^(누구|뉘|누|무엇|뭐|어디|언제)/.test(token)?"미지칭 대명사":/^(아무|누구나|무엇이든)/.test(token)?"부정칭 대명사":/[거것곳기]$/.test(token)?"지시 대명사":"인칭 대명사";
   if(out.pronounKind==="인칭 대명사")out.person ||= "3인칭";
   if(out.pronounKind==="지시 대명사")out.demonstrative ||= /[곳기]$/.test(token)?"장소 지시":"사물 지시";
  }
  if(pos==="수사")out.numeralKind ||= /^(제|첫)|째$/.test(token)?"서수사":"양수사";
  if(pos==="관형사")out.determinerKind ||= /^(몇|여러|모든|온갖|온|전|각)$/.test(token)?"수 관형사":"성상 관형사";
  if(pos==="부사"){
   out.adverbKind ||= tag==="MAJ"||/^(그리고|그래서|따라서|즉|또는|혹은|게다가|하지만|다만|아무튼|물론|분명히|다행히|혹시|아무래도)$/.test(token)?"문장 부사":"성분 부사";
   if(out.adverbKind==="문장 부사")out.adverbSentence ||= tag==="MAJ"||/^(그리고|그래서|따라서|즉|또는|혹은|게다가|하지만|다만)$/.test(token)?"접속 기능":"화자 태도·양태";
   else out.adverbComponent ||= /^(이리|그리|저리|이렇게|그렇게|저렇게)$/.test(token)?"지시 부사":/^(안|못)$/.test(token)?"부정 부사":"성상 부사";
  }
  if(pos==="감탄사")out.interjectionKind ||= /^(네|예|응|아니요|아니|그래|오냐)$/.test(token)?"호응":"감정";
  if(pos==="형용사")out.adjectiveKind ||= /^(이렇|그렇|저렇|아무렇|이러하|그러하|저러하)/.test(root||token)?"지시 형용사":"성상 형용사";
  if(["동사","형용사"].includes(pos)){
   out.conjugation ||= "규칙 활용";
   if(out.conjugation==="규칙 활용")out.regularKind ||= "일반 규칙";
   if(pos==="동사")out.verbArguments ||= "자동사";
  }
 }
 return out;
}
export function facetAnswersFor(part,ctx){
 return {...inferFacets(part,ctx),...(part.facets||{})};
}
export function validateFacets(part,facets=facetAnswersFor(part)){
 const valid=facetGroups(part.p,facets);
 return Object.entries(facets).every(([k,v])=> valid.some(g=>g.id===k && g.choices.includes(v)));
}

