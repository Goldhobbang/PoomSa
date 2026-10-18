import {inferSchoolAnalysis} from "./auto-analyzer.mjs";
import {preprocessSentence,analyzeHybrid,recoverWordBoundaries} from "./hybrid-analyzer.mjs";
export const ANALYSIS_VERSION="hybrid-4";

const loadGaru=async()=>{
  const {Garu}=await import("garu-ko/browser");
  return Garu.load();
};

// Injectable loader tests the complete pipeline without pretending to run WASM.
export function createSentenceAnalyzer(loadEngine=loadGaru){
 let loading=null,instance=null;
 return async function analyze(input,options={}) {
  const prepared=preprocessSentence(input,options);let {sentence}=prepared;
  let modelTokens=[],modelWarning="";
  try {
    if(!instance){
      if(!loading)loading=Promise.resolve().then(loadEngine).then(engine=>{
        instance=engine;return engine;
      }).catch(err=>{loading=null;throw err;});
      await loading;
    }
    modelTokens=instance.analyze(sentence)?.tokens||[];
    if(!modelTokens.length)modelWarning="형태소 모델 결과가 없어 등록된 규칙으로 분석했습니다.";
  }catch{
    modelWarning="형태소 모델을 불러오지 못해 사전·어미·조사·문맥 규칙으로 분석했습니다. 미등록어는 문장 속 쓰임으로 추정합니다.";
  }
  const layout=recoverWordBoundaries(sentence,modelTokens);
  if(layout.sentence!==sentence){
   sentence=layout.sentence;
   prepared.corrections.push(...layout.changes);prepared.sentence=sentence;
   if(instance)try{modelTokens=instance.analyze(sentence)?.tokens||[];}catch{modelTokens=[];}
   else modelTokens=[];
  }
  const hybrid=analyzeHybrid(sentence,modelTokens,{recoverSpacing:false});
  const q=inferSchoolAnalysis(sentence,hybrid.tokens);
  q.preprocessing=prepared;
  q.morphology=hybrid.words;
  q.modelWarning=modelWarning;
  q.analysisVersion=ANALYSIS_VERSION;
  q.overview="맞춤법 검사 후 형태소 모델·사전·복원·절 문맥을 조합한 추정 정답입니다. 활용 변화는 이 문장에 실제로 나타난 형태를 기준으로 판단합니다. 어간과 어미의 분리는 해설 표에서 확인할 수 있습니다. 어미는 독립된 품사가 아니므로 품사 연습에서는 용언과 함께 표시합니다.";
  const restored=hybrid.words.find(w=>w.restored&&w.gradeable);
  if(restored)q.morph={word:restored.surface.replace(/[.!?。？！…]+$/gu,""),answer:restored.analysis,
    types:restored.tokens.map(t=>/^(J|E|X|VCP)/.test(t.pos)?"의존·형식":/^V/.test(t.pos)||t.pos==="NNB"?"의존·실질":"자립·실질"),
    note:"표면형을 그대로 붙이지 않고 기본 형태를 복원합니다. "+restored.rules.join("; "),gradeable:true};
  return q;
 };
}
export const analyzeUserSentence=createSentenceAnalyzer();

