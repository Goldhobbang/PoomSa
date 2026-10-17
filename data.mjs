import {inferFacets,validateFacets} from "./taxonomy.mjs";
/**
 * 답이 준비된 학습용 예제.
 * parts는 단어의 품사를, role은 어절/구 단위의 문장 성분을 설명합니다.
 * 조사는 단어지만 어미는 품사가 아니므로 활용형 전체의 품사로 제시합니다.
 * needed는 서술어가 요구하는 논항(서술어 자체 제외)입니다.
 */
const part = (t,p,why="") => ({t,p,why});
const chunk = (t,parts,role,needed,why) => ({t,parts,role,needed:!!needed,why});
const ex = (id,level,focus,chunks,slots,morph,overview) => ({
  id,level,focus,chunks,slots,morph,overview,source:"학습용 기본 문제"
});
export const POS = ["명사","대명사","수사","동사","형용사","관형사","부사","감탄사","조사"];
export const SUBTYPES = {
  "조사": ["격조사","보조사","접속 조사"],
  "관형사": ["성상 관형사","지시 관형사","수 관형사"]
};
export const CASE_TYPES = ["주격 조사","목적격 조사","보격 조사","관형격 조사","부사격 조사","호격 조사","서술격 조사"];
export const ROLES = ["주어","서술어","목적어","보어","관형어","부사어","독립어"];
export const TYPES = ["실질·자립","실질·의존","형식·의존"];
export const MODES = [
  {id:"pos",title:"품사 분류",kicker:"01 / PART OF SPEECH",intro:"각 단어가 어떤 품사인지 선택하세요. '이/가', '을/를' 같은 조사는 앞말과 분리해서 표시합니다."},
  {id:"syntax",title:"문장 성분 분석",kicker:"02 / SENTENCE ROLES",intro:"낱말의 품사가 아니라 문장 속 역할을 선택하세요. 구(여러 어절)가 한 성분이 되기도 합니다."},
  {id:"slots",title:"필수 성분과 자릿수",kicker:"03 / PREDICATE ARGUMENTS",intro:"서술어 자체는 제외하고, 서술어가 요구하는 필수 문장 성분을 고른 뒤 서술어 자릿수를 선택하세요."},
  {id:"morph",title:"형태소 나누기",kicker:"04 / MORPHEME BOUNDARIES",intro:"제시된 표현을 형태소 단위로 / 기호를 넣어 구분하세요. 표기상의 발음 변화가 없는 예시로 연습합니다."}
];
export const EXAMPLES = [
  ex("s01","기본","주어·목적어·서술어 / 두 자리",
    [
      chunk("철수가",[part("철수","명사","사람 이름"),part("가","조사","주격 조사")],"주어",true,"동작의 주체"),
      chunk("밥을",[part("밥","명사"),part("을","조사","목적격 조사")],"목적어",true,"먹는 대상"),
      chunk("먹는다.",[part("먹는다","동사","먹다의 활용형")],"서술어",false,"동작을 나타내는 서술어")
    ],2,{word:"철수가",answer:"철수/가",types:["실질·자립","형식·의존"],note:"고유 명사 ‘철수’와 주격 조사 ‘가’가 결합했다."},"'먹다'는 누가 무엇을 먹는지를 요구하는 두 자리 서술어이다."),
  ex("s02","기본","형용사 / 한 자리",
    [
      chunk("하늘이",[part("하늘","명사"),part("이","조사","주격 조사")],"주어",true,"상태의 주체"),
      chunk("맑다.",[part("맑다","형용사","성질·상태 표현")],"서술어",false,"상태를 나타내는 서술어")
    ],1,{word:"하늘이",answer:"하늘/이",types:["실질·자립","형식·의존"],note:"하늘은 자립·실질, 조사는 의존·형식 형태소이다."},"'맑다'는 한 대상의 상태를 설명하므로 한 자리 서술어이다."),
  ex("s03","응용","품사와 문장 성분의 차이",
    [
      chunk("민지는",[part("민지","명사"),part("는","조사","보조사")],"주어",true,"사과를 산 주체"),
      chunk("매우",[part("매우","부사","형용사 ‘예쁜’을 수식")],"부사어",false,"정도를 나타내는 부사어"),
      chunk("예쁜",[part("예쁜","형용사","예쁘다의 관형사형. 관형사가 아님")],"관형어",false,"‘꽃’을 수식하는 관형어"),
      chunk("꽃을",[part("꽃","명사"),part("을","조사")],"목적어",true,"구입한 대상"),
      chunk("샀다.",[part("샀다","동사","사다의 활용형")],"서술어",false,"동작을 나타냄")
    ],2,{word:"꽃을",answer:"꽃/을",types:["실질·자립","형식·의존"],note:"목적격 조사 ‘을’은 독립된 품사 ‘조사’에 속한다."},"‘예쁜’의 품사는 형용사, 문장 성분은 관형어이다. 관형어와 관형사는 같은 말이 아니다."),
  ex("s04","심화","필수적 부사어 / 세 자리",
    [
      chunk("동생이",[part("동생","명사"),part("이","조사")],"주어",true,"전달하는 주체"),
      chunk("선생님께",[part("선생님","명사"),part("께","조사","높임의 부사격 조사")],"부사어",true,"‘드리다’의 상대를 나타내는 필수적 부사어"),
      chunk("편지를",[part("편지","명사"),part("를","조사")],"목적어",true,"전달하는 대상"),
      chunk("드렸다.",[part("드렸다","동사","드리다의 활용형")],"서술어",false,"동작을 나타냄")
    ],3,{word:"선생님께",answer:"선생님/께",types:["실질·자립","형식·의존"],note:"‘께’는 사람을 가리키는 말 뒤에 붙는 부사격 조사이다."},"‘드리다’는 누가, 누구에게, 무엇을 드리는지 요구한다. 부사어 중에도 필수적인 것이 있다."),
  ex("s05","응용","보어 / 되다 / 두 자리",
    [
      chunk("철수는",[part("철수","명사"),part("는","조사","보조사")],"주어",true,"상태가 변하는 대상"),
      chunk("학생이",[part("학생","명사"),part("이","조사","보격 조사")],"보어",true,"‘되다’를 완성하는 보어"),
      chunk("되었다.",[part("되었다","동사","되다의 활용형")],"서술어",false,"변화를 나타내는 서술어")
    ],2,{word:"학생이",answer:"학생/이",types:["실질·자립","형식·의존"],note:"‘학생이’의 ‘이’는 주격이 아니라 보격 조사다."},"‘이/가’가 있다고 모두 주어가 아니다. ‘학생이’는 보어이며 ‘되다’의 필수 성분이다."),
  ex("s06","응용","관형사 vs 관형어",
    [
      chunk("그",[part("그","관형사","‘아이’를 직접 꾸미는 지시 관형사")],"관형어",false,"관형사로 이루어진 관형어"),
      chunk("아이는",[part("아이","명사"),part("는","조사")],"주어",true,"웃는 주체"),
      chunk("조용히",[part("조용히","부사","조용하다에서 파생된 부사")],"부사어",false,"웃는 모습을 수식"),
      chunk("웃었다.",[part("웃었다","동사")],"서술어",false,"동작을 나타냄")
    ],1,{word:"아이는",answer:"아이/는",types:["실질·자립","형식·의존"],note:"보조사 ‘는’은 앞말에 붙여 쓴다."},"‘그’의 품사는 관형사이고 문장 성분은 관형어다. 수식어는 서술어의 필수 성분이 아니다."),
  ex("s07","기본","대명사 / 목적어",
    [
      chunk("나는",[part("나","대명사","사람을 대신 가리킴"),part("는","조사")],"주어",true,"읽는 주체"),
      chunk("책을",[part("책","명사"),part("을","조사")],"목적어",true,"읽는 대상"),
      chunk("빨리",[part("빨리","부사","읽는 모양을 나타냄")],"부사어",false,"동작을 꾸며 줌"),
      chunk("읽었다.",[part("읽었다","동사")],"서술어",false,"동작을 나타냄")
    ],2,{word:"책을",answer:"책/을",types:["실질·자립","형식·의존"],note:"명사 뒤의 목적격 조사를 분리한다."},"‘빨리’는 부사이고 문장 성분은 부사어이다. 없어도 ‘나는 책을 읽었다’가 성립한다."),
  ex("s08","응용","감탄사 / 독립어",
    [
      chunk("어머,",[part("어머","감탄사","놀람을 나타냄")],"독립어",false,"다른 성분과 독립"),
      chunk("그",[part("그","관형사")],"관형어",false,"‘꽃’을 수식"),
      chunk("꽃이",[part("꽃","명사"),part("이","조사")],"주어",true,"상태의 주체"),
      chunk("참",[part("참","부사","‘예쁘다’를 수식")],"부사어",false,"정도 수식"),
      chunk("예쁘다.",[part("예쁘다","형용사")],"서술어",false,"성질 표현")
    ],1,{word:"꽃이",answer:"꽃/이",types:["실질·자립","형식·의존"],note:"주격 조사 ‘이’를 분리한다."},"감탄사는 품사, 독립어는 문장 성분의 이름이다."),
  ex("s09","응용","조사 ‘대로’",
    [
      chunk("우리는",[part("우리","대명사"),part("는","조사")],"주어",true,"행동하는 주체"),
      chunk("계획대로",[part("계획","명사"),part("대로","조사","체언 뒤에 붙는 조사")],"부사어",false,"행동의 방식을 제시"),
      chunk("행동했다.",[part("행동했다","동사")],"서술어",false,"동작 표현")
    ],1,{word:"계획대로",answer:"계획/대로",types:["실질·자립","형식·의존"],note:"여기서 ‘대로’는 조사이므로 앞말에 붙여 쓴다."},"‘계획대로’의 ‘대로’는 조사이지만 ‘아는 대로’의 ‘대로’는 의존 명사다."),
  ex("s10","심화","의존 명사 ‘대로’",
    [
      chunk("학생은",[part("학생","명사"),part("은","조사")],"주어",true,"행동하는 주체"),
      chunk("아는 대로",[part("아는","동사","‘알다’의 활용형"),part("대로","명사","관형어 뒤에 오는 의존 명사")],"부사어",false,"‘아는 대로’ 전체가 서술어를 꾸밈"),
      chunk("행동했다.",[part("행동했다","동사")],"서술어",false,"동작 표현")
    ],1,{word:"학생은",answer:"학생/은",types:["실질·자립","형식·의존"],note:"명사와 보조사를 구분한다."},"‘아는’은 동사 활용형, ‘대로’는 의존 명사. 전체 ‘아는 대로’가 부사어 역할을 한다."),
  ex("s11","기본","부사 / 형용사 구별",
    [
      chunk("비가",[part("비","명사"),part("가","조사")],"주어",true,"내리는 대상"),
      chunk("많이",[part("많이","부사","많다에서 파생된 부사로 다룸")],"부사어",false,"정도를 나타냄"),
      chunk("내린다.",[part("내린다","동사")],"서술어",false,"동작 표현")
    ],1,{word:"비가",answer:"비/가",types:["실질·자립","형식·의존"],note:"체언과 주격 조사를 분리한다."},"‘많이’는 부사이고 문장 성분은 부사어다."),
  ex("s12","응용","관형사 / 부사격 조사",
    [
      chunk("새",[part("새","관형사","‘책’을 꾸미는 성상 관형사")],"관형어",false,"체언 ‘책’을 수식"),
      chunk("책이",[part("책","명사"),part("이","조사")],"주어",true,"존재하는 대상"),
      chunk("책상 위에",[part("책상","명사"),part("위","명사"),part("에","조사","부사격 조사")],"부사어",false,"존재 장소를 나타냄"),
      chunk("있다.",[part("있다","동사","존재를 나타내는 동사")],"서술어",false,"존재 표현")
    ],1,{word:"책이",answer:"책/이",types:["실질·자립","형식·의존"],note:"‘이’는 주격 조사이다."},"‘책상 위에’처럼 여러 어절도 하나의 부사어가 될 수 있다. ‘있다’는 존재의 의미에서 동사다."),
  ex("s13","응용","관형사형과 품사 구별",
    [
      chunk("철수가",[part("철수","명사"),part("가","조사")],"주어",true,"달리는 주체"),
      chunk("빠르게",[part("빠르게","형용사","빠르다의 부사형 활용. 독립된 부사가 아님")],"부사어",false,"문장 속에서는 동사 ‘달린다’를 수식"),
      chunk("달린다.",[part("달린다","동사")],"서술어",false,"동작 표현")
    ],1,{word:"철수가",answer:"철수/가",types:["실질·자립","형식·의존"],note:"어절이 아니라 형태소 단위로 분리한다."},"‘빠르게’는 품사로 형용사의 활용형, 문장 성분으로 부사어이다. ‘빨리’와 비교해 보자."),
  ex("s14","심화","여격 부사어가 필요한 세 자리",
    [
      chunk("할머니께서",[part("할머니","명사"),part("께서","조사","높임의 주격 조사")],"주어",true,"들려주는 주체"),
      chunk("손자에게",[part("손자","명사"),part("에게","조사","부사격 조사")],"부사어",true,"‘들려주다’의 대상이 되는 필수적 부사어"),
      chunk("옛날이야기를",[part("옛날이야기","명사"),part("를","조사")],"목적어",true,"들려주는 내용"),
      chunk("들려주셨다.",[part("들려주셨다","동사")],"서술어",false,"전달하는 동작")
    ],3,{word:"손자에게",answer:"손자/에게",types:["실질·자립","형식·의존"],note:"부사격 조사 ‘에게’는 체언에 붙는다."},"‘들려주다’는 누가 누구에게 무엇을 들려주는지 요구하는 세 자리 서술어다."),
  ex("s15","기본","수사 / 주어",
    [
      chunk("셋이",[part("셋","수사","수량을 직접 나타내는 양수사"),part("이","조사","주격 조사")],"주어",true,"행동하는 주체"),
      chunk("함께",[part("함께","부사","동작의 방식을 나타냄")],"부사어",false,"웃는 방식"),
      chunk("웃는다.",[part("웃는다","동사")],"서술어",false,"동작 표현")
    ],1,{word:"셋이",answer:"셋/이",types:["실질·자립","형식·의존"],note:"수사 ‘셋’에 주격 조사 ‘이’가 결합했다."},"‘셋’은 수사이고 ‘셋이’는 문장에서 주어 역할을 한다."),
  ex("s16","응용","수 관형사 / 수사 대비",
    [
      chunk("우리는",[part("우리","대명사"),part("는","조사")],"주어",true,"만나는 주체"),
      chunk("두",[part("두","관형사","수 관형사. 뒤 명사 ‘사람’을 꾸밈")],"관형어",false,"수량을 명사 앞에서 제한"),
      chunk("사람을",[part("사람","명사"),part("을","조사")],"목적어",true,"만나는 대상"),
      chunk("만났다.",[part("만났다","동사")],"서술어",false,"동작 표현")
    ],2,{word:"사람을",answer:"사람/을",types:["실질·자립","형식·의존"],note:"명사에 목적격 조사 ‘을’이 붙었다."},"‘두’는 관형사, ‘셋이’의 ‘셋’은 수사. 둘 다 수량을 나타내지만 뒤 체언을 꾸미는지에 따라 품사를 구별한다."),
  ex("s17","응용","보조사 ‘만’ / 목적어",
    [
      chunk("철수는",[part("철수","명사"),part("는","조사")],"주어",true,"마시는 주체"),
      chunk("물만",[part("물","명사"),part("만","조사","한정의 의미를 나타내는 보조사")],"목적어",true,"마시는 대상. 목적격 조사 없이도 목적어 역할"),
      chunk("마셨다.",[part("마셨다","동사")],"서술어",false,"동작 표현")
    ],2,{word:"물만",answer:"물/만",types:["실질·자립","형식·의존"],note:"‘만’은 목적격 조사가 아닌 보조사이다."},"‘물만’은 목적격 조사 ‘을’이 없어도 목적어 역할을 한다. 품사와 문장 성분을 구별해야 한다."),
  ex("s18","응용","대명사 / 목적어",
    [
      chunk("너는",[part("너","대명사"),part("는","조사")],"주어",true,"좋아하는 주체"),
      chunk("이것을",[part("이것","대명사","사물을 대신 가리키는 지시 대명사"),part("을","조사")],"목적어",true,"좋아하는 대상"),
      chunk("좋아한다.",[part("좋아한다","동사")],"서술어",false,"동작·감정을 나타내는 동사")
    ],2,{word:"이것을",answer:"이것/을",types:["실질·자립","형식·의존"],note:"지시 대명사 ‘이것’과 목적격 조사 ‘을’을 구분한다."},"‘이것’은 대명사이고 ‘이’가 명사 앞에 올 때와 달리 체언을 대신한다."),
  ex("s19","응용","호격 조사 / 독립어",
    [
      chunk("영희야,",[part("영희","명사"),part("야","조사","호격 조사")],"독립어",false,"부르는 대상. 서술어의 자릿수에 포함하지 않음"),
      chunk("내가",[part("나","대명사"),part("가","조사","주격 조사")],"주어",true,"오는 주체"),
      chunk("왔다.",[part("왔다","동사")],"서술어",false,"움직임을 나타냄")
    ],1,{word:"영희야",answer:"영희/야",types:["실질·자립","형식·의존"],note:"'야'는 부르는 대상에 붙는 호격 조사다."},"호격 조사 '야'는 다른 문장 성분과 문법적 관계를 맺기보다 부름을 나타내며, '영희야'는 독립어이다."),
  ex("s20","응용","관형격 조사 / 관형어",
    [
      chunk("철수의",[part("철수","명사"),part("의","조사","관형격 조사")],"관형어",false,"소유 관계를 나타내며 '가방'을 수식"),
      chunk("가방이",[part("가방","명사"),part("이","조사","주격 조사")],"주어",true,"성질의 주체"),
      chunk("크다.",[part("크다","형용사")],"서술어",false,"상태 표현")
    ],1,{word:"철수의",answer:"철수/의",types:["실질·자립","형식·의존"],note:"'의'는 앞말과 뒤 체언 사이의 관계를 나타내는 관형격 조사다."},"'철수의'의 문장 성분은 관형어지만 조사 '의'의 종류는 관형격 조사다."),
  ex("s21","심화","접속 조사 / 하나의 주어",
    [
      chunk("영희와 철수가",[part("영희","명사"),part("와","조사","접속 조사"),part("철수","명사"),part("가","조사","주격 조사")],"주어",true,"'와'가 두 체언을 대등하게 연결해 복합적인 주어를 형성"),
      chunk("웃었다.",[part("웃었다","동사")],"서술어",false,"동작 표현")
    ],1,{word:"영희와",answer:"영희/와",types:["실질·자립","형식·의존"],note:"'와'는 여기서 두 명사를 잇는 접속 조사다."},"'영희와 철수'에서 '와'는 접속 조사. '영희와 함께'처럼 앞말과 결합해 동반을 나타내는 부사격 조사와 용법이 다르다."),
  ex("s22","심화","서술격 조사 '이다'",
    [
      chunk("철수는",[part("철수","명사"),part("는","조사","보조사")],"주어",true,"서술의 대상"),
      chunk("학생이다.",[part("학생","명사"),part("이다","조사","서술격 조사")],"서술어",false,"명사 뒤에 결합해 서술어를 만드는 '이다'")
    ],1,{word:"학생이다",answer:"학생/이다",types:["실질·자립","형식·의존"],note:"'이다'는 학교 문법에서 서술격 조사이며 활용한다."},"'이다'는 학교 문법상 서술격 조사다. 다른 조사와 달리 활용하여 체언과 함께 서술어를 이룬다.")
];

// 문제은행의 문맥을 검토해 지정한 세부 품사 정답표.
// 입력 문장에 이 규칙을 그대로 일반화하지 않으며, 자유 입력에는 교정 단계를 둔다.
function annotatePart(p,chunk){
  if(p.p==="관형사"){
    const kinds={"그":"지시 관형사","새":"성상 관형사","두":"수 관형사"};
    p.detail=kinds[p.t]?[kinds[p.t]]:[];
    return;
  }
  if(p.p!=="조사")return;
  const particle=p.t;
  if(["은","는","만","대로"].includes(particle)){p.detail=["보조사"];return;}
  if(particle==="와"&&chunk.t==="영희와 철수가"){p.detail=["접속 조사"];return;}
  const cases={
    "가":"주격 조사","께서":"주격 조사",
    "을":"목적격 조사","를":"목적격 조사",
    "의":"관형격 조사","에":"부사격 조사",
    "에게":"부사격 조사","께":"부사격 조사",
    "야":"호격 조사","이다":"서술격 조사"
  };
  if(particle==="이"){p.detail=["격조사",chunk.role==="보어"?"보격 조사":"주격 조사"];return;}
  p.detail=cases[particle]?["격조사",cases[particle]]:[];
}
for(const q of EXAMPLES)for(const c of q.chunks)for(const p of c.parts)annotatePart(p,c);
// Multiple independent classification criteria, e.g. noun proper/common AND independent/dependent.
for(const q of EXAMPLES)for(const c of q.chunks)for(const p of c.parts){p.facets=inferFacets(p);}


export function normalizeSentence(s) {return String(s ?? "").normalize("NFC").replace(/[.,!?。？！]/g,"").replace(/\s+/g," ").trim();}
export function validateExamples(items=EXAMPLES) {
  const errors=[];
  for (const q of items) {
    if(!q.chunks?.length) errors.push(q.id+": empty chunks");
    if(![1,2,3].includes(q.slots)) errors.push(q.id+": invalid slots");
    const wanted=q.chunks.filter(c=>c.needed);
    if(wanted.length!==q.slots) errors.push(q.id+": required units mismatch");
    if(q.chunks.filter(c=>c.role==="서술어").length!==1) errors.push(q.id+": predicate mismatch");
    for(const c of q.chunks){
      if(!ROLES.includes(c.role)) errors.push(q.id+": invalid role "+c.role);
      if(!c.parts?.length) errors.push(q.id+": empty parts");
      for(const p of c.parts){
        if(!validateFacets(p,p.facets))errors.push(q.id+": invalid facet "+p.t);
        if(!POS.includes(p.p)) errors.push(q.id+": invalid POS "+p.p);
        if(["조사","관형사"].includes(p.p)){
          if(!Array.isArray(p.detail)||!SUBTYPES[p.p].includes(p.detail[0]))
            errors.push(q.id+": invalid subtype "+p.t);
          if(p.detail?.[0]==="격조사"&&!CASE_TYPES.includes(p.detail[1]))
            errors.push(q.id+": invalid case kind "+p.t);
          if(p.detail?.[0]!=="격조사"&&p.detail?.length!==1)
            errors.push(q.id+": unexpected nesting "+p.t);
        }
      }
    }
    if(!q.morph || !q.morph.answer.includes("/")) errors.push(q.id+": invalid morph");
    if(q.morph?.types?.length!==q.morph.answer.split("/").length) errors.push(q.id+": morph types count");
  }
  return errors;
}
