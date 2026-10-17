import {inferSchoolAnalysis} from "./auto-analyzer.mjs";

let loading=null,instance=null;
export async function analyzeUserSentence(sentence) {
  if(!instance){
    if(!loading)loading=import("garu-ko/browser").then(async ({Garu})=>{
      const engine=await Garu.load();
      instance=engine;
      return engine;
    }).catch(err=>{loading=null;throw err;});
    await loading;
  }
  const result=instance.analyze(sentence);
  if(!result?.tokens?.length)throw new Error("형태소 분석 결과가 없습니다. 짧고 완결된 문장을 입력해 보세요.");
  return inferSchoolAnalysis(sentence,result.tokens);
}
