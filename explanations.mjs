/**
 * PoomSa 공통 오답 해설 규칙.
 * 샘플/커스텀 문장 모두 같은 규칙을 사용하되, 커스텀 정답표는 자동 검증되지 않는다.
 */
const POS_RULE = {
  "명사": ["사람·사물·개념 등의 이름을 나타내는 말입니다. 의존 명사도 명사에 속합니다.","이름으로 쓰이며 조사와 결합하거나 관형어의 수식을 받는지 확인하세요."],
  "대명사": ["사람·사물·장소 등을 이름 대신 가리키는 체언입니다.","‘나·너·우리·이것’처럼 대상을 대신 지시하는지 확인하세요."],
  "수사": ["수량이나 순서를 그 자체로 나타내는 체언입니다.","‘셋이’처럼 스스로 체언 역할을 하면 수사, ‘세 사람’처럼 뒤 체언을 꾸미면 수 관형사입니다."],
  "동사": ["동작·작용·상태의 변화 등을 나타내며 활용하는 용언입니다.","기본형과 활용을 확인하세요. 대표적으로 현재 관형사형 ‘-는’ 또는 명령·청유 표현이 판별 단서가 됩니다(예외는 문맥 확인)."],
  "형용사": ["성질이나 상태를 나타내며 활용하는 용언입니다.","‘예쁜·빠르게’처럼 어미가 붙어 관형어·부사어로 쓰여도 기본형이 ‘예쁘다·빠르다’이면 형용사입니다."],
  "관형사": ["활용하지 않고 체언 바로 앞에서 체언을 꾸미는 수식언입니다.","체언을 꾸미는 말의 기본형을 확인하세요. ‘예쁜’은 형용사 활용형이지만 ‘새·그·두’는 관형사입니다."],
  "부사": ["주로 용언이나 문장 전체를 꾸미는 수식언입니다.","‘빨리’처럼 부사 자체인지, ‘빠르게’처럼 용언의 활용형인지 기본형을 먼저 확인하세요."],
  "감탄사": ["감정·부름·대답 등을 독립적으로 나타내는 말입니다.","다른 말과 필수적인 문법 관계를 맺지 않고 독립적으로 쓰였는지 보세요."],
  "조사": ["체언 등 뒤에 붙어 문법적 관계를 표시하거나 특별한 뜻을 더하는 단어입니다.","앞말에 붙어 쓰이는 조사인지, 용언의 활용형에 붙는 어미인지 먼저 구별하세요."]
};
const SUB_RULE = {
  "격조사": ["앞말이 문장 안에서 맡는 격 관계를 나타냅니다.","주어·목적어·보어·관형어·부사어 역할이나 부름·서술 기능을 확인하고 격의 종류를 선택하세요."],
  "보조사": ["앞말에 화제·대조·한정·첨가 등의 특별한 뜻을 더합니다.","‘은/는·도·만’처럼 격을 직접 표시하기보다 추가 의미를 더하는지 보세요."],
  "접속 조사": ["체언 등을 대등하게 연결하는 조사입니다.","‘영희와 철수’의 ‘와’처럼 둘을 이어 주는지 확인하세요. ‘영희와 함께’의 ‘와’와는 기능이 다를 수 있습니다."],
  "성상 관형사": ["뒤에 오는 체언의 성질이나 상태를 꾸밉니다.","‘새 책·헌 옷’처럼 어떤 종류·상태의 사물인지 제한하는지 보세요."],
  "지시 관형사": ["대상을 지시하거나 가리키며 체언을 꾸밉니다.","‘이 책·그 학생·저 건물’처럼 지시하는 대상을 한정하는지 보세요."],
  "수 관형사": ["체언 앞에서 수량이나 순서를 제한합니다.","‘두 사람’의 ‘두’와 ‘둘이 왔다’의 ‘둘’을 비교해 보세요."]
};
const CASE_RULE = {
  "주격 조사": ["앞말이 주어임을 나타냅니다.","‘누가/무엇이?’에 해당하는 주어인지 확인하세요. ‘이/가’가 항상 주격은 아닙니다."],
  "목적격 조사": ["앞말이 동작·작용의 대상인 목적어임을 나타냅니다.","‘누구를/무엇을?’에 해당하는지 확인하세요. ‘을/를’이 대표적입니다."],
  "보격 조사": ["주로 ‘되다·아니다’ 앞의 보어에 붙는 조사입니다.","‘학생이 되었다’의 ‘학생이’처럼 ‘이/가’가 붙어도 ‘되다/아니다’를 보충한다면 보격입니다."],
  "관형격 조사": ["체언 사이의 소유·소속·관계 등을 나타내며 관형어를 이룹니다.","‘철수의 가방’처럼 뒤 체언을 꾸미는 ‘의’인지 확인하세요."],
  "부사격 조사": ["처소·방향·상대·수단 등 부사어의 관계를 나타냅니다.","‘학교에서·친구에게·도구로’처럼 서술어와 맺는 관계를 확인하세요. 부사격 조사 뒤의 부사어가 필수적일 수도 있습니다."],
  "호격 조사": ["부르는 대상을 나타내는 조사입니다.","‘영희야!’처럼 부름의 기능이 있는지 확인하세요. 해당 표현은 문장 성분상 독립어입니다."],
  "서술격 조사": ["체언 뒤에 붙어 그 말이 서술어가 되게 하는 ‘이다’입니다.","‘학생이다’에서 ‘이다’는 활용하는 서술격 조사입니다. ‘학생이 되었다’의 ‘이’와 구별하세요."]
};
const ROLE_RULE = {
  "주어": ["서술어가 설명하는 대상 또는 동작·상태의 주체입니다.","‘누가/무엇이?’에 해당하는지 보세요. 보조사 ‘은/는’이 붙어도 주어가 될 수 있습니다."],
  "서술어": ["주어의 동작·상태·성질·정체 등을 설명하는 문장의 중심 성분입니다.","문장을 끝맺는 서술 표현과 용언·‘이다’의 역할을 확인하세요."],
  "목적어": ["타동사가 나타내는 동작·작용의 대상입니다.","‘무엇을/누구를?’에 해당하는지 보세요. 목적격 조사 없이 보조사가 붙은 목적어도 가능합니다."],
  "보어": ["‘되다·아니다’가 요구하는 의미를 채워 주는 성분입니다.","‘학생이 되었다’의 ‘학생이’는 주어가 아니라 보어입니다."],
  "관형어": ["뒤에 오는 체언을 꾸미는 문장 성분입니다.","품사 ‘관형사’와 구별하세요. 형용사의 관형사형도 관형어가 될 수 있습니다."],
  "부사어": ["서술어 등 다른 성분을 꾸미거나 관계를 보충하는 성분입니다.","부사 자체뿐 아니라 체언+부사격 조사, 용언의 부사형, 구·절도 부사어가 될 수 있습니다."],
  "독립어": ["문장의 다른 성분과 직접적인 문법 관계 없이 독립적으로 쓰입니다.","부름이나 감탄·대답 표현처럼 문장 구조 바깥에서 기능하는지 보세요."]
};
export const normalizeMorph = value=>String(value??"").replace(/\s+/g,"").replace(/[|｜]/g,"/").replace(/\/+/g,"/").replace(/^\/|\/$/g,"");
export const isCustomAnswer = question=>String(question?.id??"").startsWith("custom-");
const sourceNote = question=>isCustomAnswer(question)
 ? "이 해설은 사용자가 저장한 정답표에 일반적인 학교 문법 규칙을 적용한 것입니다. 해당 정답표의 문법적 정확성은 자동 검증되지 않았습니다."
 : "";
const rule = value=>POS_RULE[value]||SUB_RULE[value]||CASE_RULE[value]||ROLE_RULE[value]||[
 "등록된 정답표에서 지정한 문법 범주입니다.","해당 문장 안에서 맡는 기능을 확인하세요."
];
const reply=(diagnosis,principle,check,source)=>({diagnosis,principle,check,source});
const name=value=>String(value??"").trim()||"미선택";
/** Positive evidence for the final label, shared by correct and wrong answers. */
export function explainFinalClassification(q,part){
 const final=part.detail?.at(-1)||part.p;
 const noun=part.facets?.nounIndependence;
 const specific=noun==="의존 명사"?
  "앞 관형어의 수식을 받아 쓰이는 의존 명사로, 혼자 대상을 지칭하기 어렵습니다.":"";
 const evidence=part.why?" 이 문장의 단서: "+part.why:"";
 return "‘"+part.t+"’의 최종 분류는 ‘"+final+"’입니다. "+rule(final)[0]+
  (specific?" "+specific:"")+evidence;
}
export function explainPartOfSpeech(q,part,chosen=[]){
 const expected=[part.p,...(Array.isArray(part.detail)?part.detail:[])];
 const mismatch=expected.findIndex((value,i)=>value!==chosen[i]);
 if(mismatch===-1)return reply("선택한 분류가 정답표와 일치합니다.",explainFinalClassification(q,part),rule(expected[expected.length-1])[1],sourceNote(q));
 const layer=["품사","세부 분류","격조사 종류"][Math.min(mismatch,2)];
 const right=expected[mismatch],wrong=name(chosen[mismatch]);
 const explanation=rule(right);
 const alternative=chosen[mismatch]&&chosen[mismatch]!==right?" ‘"+wrong+"’의 판별 기준: "+rule(chosen[mismatch])[0]:"";
 const diagnosis=layer+" 선택은 ‘"+wrong+"’이고, 정답표의 분류는 ‘"+right+"’입니다."+alternative;
 let check=explanation[1];
 if(part.p==="조사"&&["이","가"].includes(part.t)&&right==="보격 조사")
  check="‘이/가’라는 글자만으로 주격이라 단정하지 마세요. ‘되다/아니다’를 보충하는 보어의 조사이면 보격입니다.";
 else if(part.p==="형용사"&&chosen[0]==="부사")
  check="‘-게’로 끝나서 부사어로 쓰여도, ‘빠르게’처럼 기본형이 ‘빠르다’이면 품사는 형용사입니다. 품사와 문장 성분을 분리하세요.";
 else if(part.p==="형용사"&&chosen[0]==="관형사")
  check="체언을 꾸민다는 것은 관형어라는 문장 성분의 기준입니다. ‘예쁜’은 활용하는 형용사, ‘새’는 활용하지 않는 관형사입니다.";
 else if(part.p==="조사"&&expected[1]==="접속 조사")
  check="두 체언을 대등하게 이어 주는지 보세요. 형태가 ‘와/과’라고 언제나 같은 종류의 조사는 아닙니다.";
 return reply(diagnosis,explainFinalClassification(q,part),check,sourceNote(q));
}
export function explainSentenceRole(q,chunk,chosen){
 const explanation=rule(chunk.role);
 const alternative=chosen&&chosen!==chunk.role?" 반면 ‘"+chosen+"’은(는) "+rule(chosen)[0]:"";
 return reply("‘"+chunk.t+"’을(를) ‘"+name(chosen)+"’으로 분류했지만 정답표의 문장 성분은 ‘"+chunk.role+"’입니다."+alternative,"‘"+chunk.role+"’는 "+explanation[0],explanation[1]+(!isCustomAnswer(q)&&chunk.why?" 이 예문에서의 근거: "+chunk.why+".":""),sourceNote(q));
}
const predicate=q=>q.chunks?.find(c=>c.role==="서술어")?.t||"이 문장의 서술어";
const required=q=>(q.chunks||[]).filter(c=>c.needed).map(c=>c.t+"("+c.role+")");
export function explainValency(q,chosen){
 const pred=predicate(q);
 return reply(
  "‘"+pred+"’의 자릿수를 ‘"+name(chosen)+"자리’로 선택했지만 정답표에서는 ‘"+q.slots+"자리’입니다.",
  "서술어 자릿수는 서술어가 의미상 요구하는 필수 성분의 수입니다. 서술어 자체는 세지 않습니다. 정답표의 필수 성분: "+(required(q).join(", ")||"미지정")+".",
  "‘누가?’, ‘무엇을?’, ‘누구에게?’ 등으로 반드시 필요한 참여자를 찾으세요. 생략 가능한 부사어는 세지 않지만 필수적 부사어는 셉니다.",
  sourceNote(q)
 );
}
export function explainRequired(q,chunk,picked){
 const pred=predicate(q);
 const diagnosis=chunk.needed
 ? "‘"+chunk.t+"’을(를) 필수 성분에서 제외했지만, 정답표에서는 ‘"+pred+"’가 요구하는 필수 성분입니다."
 : "‘"+chunk.t+"’을(를) 필수 성분으로 선택했지만, 정답표에서는 생략 가능한 성분입니다.";
 const principle=chunk.needed
 ? "주어·목적어·보어뿐 아니라 서술어가 요구하는 부사어도 필수 성분에 포함될 수 있습니다."
 : "해당 성분을 제거하더라도 서술어의 핵심 논항 관계가 성립한다면 수의적 성분으로 봅니다.";
 return reply(diagnosis,principle,"‘"+pred+"’를 기준으로 이 성분이 빠지면 문장의 의미적 핵심 참여자가 없어지는지 확인하세요.",sourceNote(q));
}
export function explainMorphology(q,answer){
 const expected=normalizeMorph(q.morph?.answer),chosen=normalizeMorph(answer);
 const expectedParts=expected.split("/").filter(Boolean),givenParts=chosen.split("/").filter(Boolean);
 let diagnosis;
 if(!chosen)diagnosis="형태소 분리 답안을 입력하지 않았습니다.";
 else if(expectedParts.join("")!==givenParts.join(""))diagnosis="입력한 부분들을 이어 붙여도 정답표의 원래 표현과 일치하지 않습니다. 빠뜨린 글자나 바꾼 글자가 있는지 확인하세요.";
 else if(expectedParts.length!==givenParts.length)diagnosis="형태소를 "+givenParts.length+"개로 나눴지만 정답표에서는 "+expectedParts.length+"개입니다.";
 else diagnosis="형태소 개수는 같지만 경계 위치가 정답표와 다릅니다.";
 return reply(diagnosis,
  "정답표의 분리는 ‘"+expected+"’입니다. 형태소는 뜻을 가진 가장 작은 말의 단위이므로 음절이나 글자 하나와 항상 대응하지 않습니다.",
  "체언+조사, 용언의 어간+어미, 어근+접사 등의 경계를 확인하세요. 조사는 단어이지만 어미는 별도의 품사가 아닙니다.",sourceNote(q));
}


// Diagnostic explanation for the print's independent POS classification axes.
const FACET_RULES = {
 nounKind:{
  "고유 명사":"한 사람·장소·기관 등에 붙은 특정한 이름을 가리키는 명사입니다. 예: 윤현경, 남대문.",
  "보통 명사":"같은 범주의 대상에 두루 쓰는 일반 명칭입니다. 예: 선생님, 연필, 사랑."
 },
 nounIndependence:{
  "자립 명사":"다른 말의 관형어 수식 없이도 독립적으로 쓰일 수 있는 명사입니다.",
  "의존 명사":"관형어가 앞에서 꾸며 주어야 자연스럽게 사용되는 명사입니다. 예: 할 수, 본 대로."
 },
 pronounKind:{
  "인칭 대명사":"말하는 이, 듣는 이 또는 이야기 속 제삼자를 가리킵니다.",
  "지시 대명사":"사물이나 장소를 이름 대신 지시합니다. 예: 이것, 여기.",
  "미지칭 대명사":"누구인지·무엇인지 모르는 대상을 의문으로 나타냅니다. 예: 누가 왔니?",
  "부정칭 대명사":"대상을 특정하지 않고 아무나·누구나처럼 가리킵니다.",
  "재귀칭 대명사":"앞에 나온 주체 자신을 다시 가리킵니다. 예: 자기."
 },
 person:{"1인칭":"말하는 사람을 가리킵니다. 예: 나, 저, 우리.",
 "2인칭":"듣는 사람을 가리킵니다. 예: 너, 당신, 그대.",
 "3인칭":"말하는 이도 듣는 이도 아닌 제삼자를 가리킵니다. 예: 그, 그녀."},
 demonstrative:{"사물 지시":"물건·사물을 가리키는 대명사입니다. 예: 이것, 그것.",
 "장소 지시":"위치를 가리키는 대명사입니다. 예: 여기, 저기."},
 numeralKind:{"양수사":"수량이나 개수를 직접 나타냅니다. 예: 하나, 둘, 셋.",
 "서수사":"차례나 순서를 직접 나타냅니다. 예: 첫째, 둘째, 셋째."},
 verbArguments:{"자동사":"목적어를 요구하지 않는 동사입니다. 다만 다른 필수 부사어는 필요할 수도 있습니다.",
 "타동사":"동작의 대상인 목적어를 요구하는 동사입니다."},
 adjectiveKind:{"성상 형용사":"대상의 성질이나 상태를 나타냅니다. 예: 예쁘다, 맑다.",
 "지시 형용사":"앞에서 언급하거나 지시하는 모양·상태를 나타냅니다. 예: 그렇다, 이렇다."},
 conjugation:{"규칙 활용":"어간과 어미의 결합이 일정한 규칙으로 설명됩니다. ‘ㅡ 탈락’과 ‘ㄹ 탈락’도 규칙 활용입니다.",
 "불규칙 활용":"일반적인 어간·어미 결합으로 예측하기 어려운 특수한 변화가 생깁니다."},
 regularKind:{"일반 규칙":"특수한 교체 없이 규칙적으로 활용합니다.",
 "ㅡ 탈락":"어간 끝의 ‘ㅡ’가 모음 어미 앞에서 규칙적으로 탈락합니다. 예: 쓰다→써, 크다→커.",
 "ㄹ 탈락":"어간 끝의 ‘ㄹ’이 일정한 어미 앞에서 규칙적으로 탈락합니다. 예: 살다→사니."},
 irregularKind:{"ㄷ 불규칙":"모음 어미 앞에서 ㄷ이 ㄹ로 바뀝니다. 예: 듣다→들어.",
 "ㅂ 불규칙":"일부 ㅂ 받침이 모음 어미 앞에서 오/우로 변합니다. 예: 돕다→도와.",
 "ㅅ 불규칙":"일부 어간의 ㅅ이 모음 어미 앞에서 탈락합니다. 예: 짓다→지어.",
 "르 불규칙":"‘르’ 앞에 ㄹ이 덧나며 어미가 라/러 계열이 됩니다. 예: 모르다→몰라.",
 "우 불규칙":"푸다→퍼와 같이 어간의 우가 탈락합니다.",
 "여 불규칙":"하다→하여/해처럼 여 계열 어미가 나타납니다.",
 "러 불규칙":"이르다→이르러, 푸르다→푸르러와 같은 유형입니다.",
 "너라 불규칙":"오다→오너라처럼 명령형에서 특수한 어미가 나타납니다.",
 "거라 불규칙":"가다→가거라처럼 명령형에서 특수한 어미가 나타납니다.",
 "ㅎ 불규칙":"파랗다→파래, 그렇다→그래처럼 어간과 어미가 함께 달라집니다."},
 adverbKind:{"성분 부사":"특정 문장 성분, 주로 용언을 꾸밉니다. 예: 천천히, 이리, 안.",
 "문장 부사":"문장 전체에 화자의 태도나 접속 관계를 더합니다. 예: 아마, 그러나."},
 adverbComponent:{"성상 부사":"동작이나 상태의 방식·정도를 표현합니다. 예: 빨리, 천천히.",
 "지시 부사":"방향·때·장소 등을 가리키며 꾸밉니다. 예: 이리, 그리.",
 "부정 부사":"동작·상태를 부정하는 의미를 더합니다. 예: 안, 못."},
 adverbSentence:{"화자 태도·양태":"문장 전체의 태도·추측·판단을 드러냅니다. 예: 아마, 과연.",
 "접속 기능":"앞뒤 문장 사이의 논리적 관계를 연결합니다. 예: 그러나, 그러므로."},
 interjectionKind:{"감정":"놀람·기쁨·슬픔 등 감정을 독립적으로 표현합니다. 예: 아, 어머.",
 "의지":"의도·제지·권유 등을 나타냅니다. 예: 쉬, 자.",
 "호응":"대답·수긍을 나타냅니다. 예: 예, 그래, 응.",
 "구습·입버릇":"말을 머뭇거리거나 습관적으로 내는 소리입니다. 예: 음, 저."}
};
export function explainFacet(q,p,group,chosen,expected){
 const principle=FACET_RULES[group.id]?.[expected]||
  "학교 문법에서 ‘"+group.label+"’로 나누는 기준에 따라 단어의 실제 쓰임을 판단합니다.";
 const alternative=FACET_RULES[group.id]?.[chosen];
 const diagnosis="‘"+p.t+"’의 "+group.label+"을(를) ‘"+(chosen||"미선택")+"’으로 골랐지만 정답표에서는 ‘"+expected+"’입니다."+
  (alternative?" 선택한 분류의 의미: "+alternative:"");
 const check=group.id==="nounIndependence"?"관형어 없이도 독립적으로 쓰이는지 확인하세요.":
  group.id==="nounKind"?"특정 대상의 이름인지, 같은 범주의 대상에 두루 쓰는 일반 명칭인지 확인하세요.":
  group.id==="conjugation"||group.id==="irregularKind"||group.id==="regularKind"?
    "기본형 어간과 활용형을 나란히 비교하세요. 모양이 달라졌다는 사실만으로 불규칙이라고 판단하지 마세요.":
  group.id==="pronounKind"||group.id==="person"?"문장 속에서 누구를 가리키는지 먼저 파악하세요.":
    "해당 단어가 문장에서 수행하는 기능을 확인하세요. 같은 표기라도 쓰임에 따라 달라질 수 있습니다.";
 return {diagnosis,principle,check,source:isCustomAnswer(q)?
 "자동 분석 문장은 모형·규칙으로 추정한 답입니다. 이 부분에 확실한 근거가 없는 경우 채점을 보류해야 합니다.":""};
}

