/** Display and describe the morphemes present in this particular word form. */
const labels={NNG:"보통 명사",NNP:"고유 명사",NNB:"의존 명사",NP:"대명사",NR:"수사",SN:"수사",
 VV:"동사 어간",VA:"형용사 어간",VX:"보조 동사 어간",VCN:"형용사 어간",VCP:"서술격 조사 어간",
 XSV:"동사 파생 접미사",XSA:"형용사 파생 접미사",XSN:"명사 파생 접미사",XPN:"접두사",XR:"어근",
 MM:"관형사",MAG:"부사",MAJ:"부사",IC:"감탄사",SL:"외국어",SH:"한자",
 JX:"보조사",JKB:"부사격 조사",JKS:"주격 조사",JKC:"보격 조사",JKO:"목적격 조사",JKG:"관형격 조사",
 JKQ:"인용격 조사",JKV:"호격 조사",JC:"접속 조사",ETM:"관형사형 어미",EC:"연결 어미",EF:"종결 어미",
 EP:"선어말 어미",ETN:"명사형 어미",NA:"미등록 형태소"};
export const morphemeLabel=t=>t.auxiliary&&t.pos==="VA"?"보조 형용사 어간":labels[t.pos]||"형태소";
export const morphemeForm=t=>/^V/.test(t.pos)?t.text+"-":/^E/.test(t.pos)?"-"+t.text+ (t.pos==="EP"?"-":""):t.text;
const lastSyllable=s=>{const n=s.charCodeAt(s.length-1)-0xac00;return n>=0&&n<11172?{n,final:n%28}:null;};

/** Lexical irregularity only licenses a change; the current form must exhibit it. */
export function inferSurfaceInflection(surface,stem,tokens,lexicalKind=""){
 const endings=tokens.filter(t=>/^E/.test(t.pos)),ending=endings.map(t=>t.text).join("");
 const form=surface.replace(/[,.!?。？！…]+$/gu,"");
 const rules=[...new Set(tokens.map(t=>t.rule).filter(Boolean))].join("; ");
 const h=lastSyllable(stem),changed=!!stem&&!form.startsWith(stem);
 const analysis=tokens.map(morphemeForm).join(" + ");
 let irregular="";
 // -고/-ㄴ다 never trigger 하여/해. The ending and actual surface both matter.
 if(stem.endsWith("하")&&(/^(여|였)/u.test(ending)||
   /^(아|어|았|었)/u.test(ending)&&form.startsWith(stem.slice(0,-1)+"해")||
   /^(았|었)/u.test(ending)&&form.startsWith(stem.slice(0,-1)+"했")))irregular="여 불규칙";
 const explicit=rules.match(/(ㄷ|ㅂ|ㅅ|르|우|러|ㅎ|너라|거라)\s*불규칙/u)?.[0];
 if(explicit&&(changed||/^(러|너라|거라)/u.test(ending)))irregular=explicit.replace(/\s+/gu," ");
 if(!irregular&&lexicalKind){
  const vowel=/^(아|어|았|었)/u.test(ending);
  if(changed&&vowel&&/^(ㄷ|ㅂ|ㅅ|르|우) 불규칙$/u.test(lexicalKind))irregular=lexicalKind;
  if(changed&&lexicalKind==="ㅎ 불규칙"&&/^(아|어|았|었|ㄴ|ㄹ|니|면)/u.test(ending))irregular=lexicalKind;
  if(lexicalKind==="러 불규칙"&&/^(러|렀)/u.test(ending))irregular=lexicalKind;
  if(lexicalKind==="너라 불규칙"&&ending==="너라"||lexicalKind==="거라 불규칙"&&ending==="거라")irregular=lexicalKind;
 }
 let regularKind="일반 규칙";
 if(!irregular){
  if(h?.final===8&&changed)regularKind="ㄹ 탈락";
  else if(changed&&/ㅡ\s*탈락/u.test(rules))regularKind="ㅡ 탈락";
  else if(/동일 모음 탈락/u.test(rules))regularKind="동일 모음 탈락";
  else if(/모음 축약/u.test(rules))regularKind="모음 축약";
 }
 const reason=irregular?"분리: "+analysis+". 이 형태에서 "+irregular+"이 나타납니다.":
  regularKind==="ㄹ 탈락"?"‘"+stem+"-’의 받침 ‘ㄹ’이 ‘-"+ending+"’ 앞에서 탈락합니다. 복원: "+analysis+". ㄹ 탈락은 규칙적인 변화입니다.":
  regularKind==="일반 규칙"?"분리: "+analysis+". 이 형태에서는 어간·어미의 불규칙 교체가 나타나지 않습니다.":
  "‘"+analysis+"’ → ‘"+form+"’: "+regularKind+"이 나타납니다.";
 return {scope:"surface",analysis,conjugation:irregular?"불규칙 활용":"규칙 활용",
  ...(irregular?{irregularKind:irregular}:{regularKind}),reason};
}
