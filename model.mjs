import {inferSchoolAnalysis} from "./auto-analyzer.mjs";
import {preprocessSentence,analyzeHybrid} from "./hybrid-analyzer.mjs";

const loadGaru=async()=>{
  const {Garu}=await import("garu-ko/browser");
  return Garu.load();
};

// Injectable loader tests the complete pipeline without pretending to run WASM.
export function createSentenceAnalyzer(loadEngine=loadGaru){
 let loading=null,instance=null;
 return async function analyze(input,options={}) {
  const prepared=preprocessSentence(input,options),{sentence}=prepared;
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
    modelWarning="형태소 모델을 불러오지 못해 등록된 규칙으로 분석했습니다. 미등록어는 채점을 보류합니다.";
  }
  const hybrid=analyzeHybrid(sentence,modelTokens);
  const q=inferSchoolAnalysis(sentence,hybrid.tokens);
  q.preprocessing=prepared;
  q.morphology=hybrid.words;
  q.modelWarning=modelWarning;
  q.analysisVersion="hybrid-1";
  q.overview="맞춤법 규칙 검사 후 형태소 모델과 사전·복원·문맥 규칙을 함께 적용했습니다. 어미는 독립된 품사가 아니므로 품사 연습에서는 용언과 함께 표시합니다.";
  const restored=hybrid.words.find(w=>w.restored&&w.gradeable);
  if(restored)q.morph={word:restored.surface.replace(/[.!?。？！…]+$/gu,""),answer:restored.analysis,
    types:restored.tokens.map(t=>/^(J|E|X|VCP)/.test(t.pos)?"의존·형식":/^V/.test(t.pos)||t.pos==="NNB"?"의존·실질":"자립·실질"),
    note:"표면형을 그대로 붙이지 않고 기본 형태를 복원합니다. "+restored.rules.join("; "),gradeable:true};
  return q;
 };
}
export const analyzeUserSentence=createSentenceAnalyzer();

