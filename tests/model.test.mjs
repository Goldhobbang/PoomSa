import test from "node:test";
import assert from "node:assert/strict";
import {createSentenceAnalyzer,ANALYSIS_VERSION} from "../model.mjs";

test("complete pipeline passes corrected text to the engine and exposes restoration",async()=>{
 let received="";
 const analyze=createSentenceAnalyzer(async()=>({analyze(s){received=s;return {tokens:[]};}}));
 const q=await analyze("썸네일만 보아도 소리지르는 거구만.");
 assert.equal(received,"썸네일만 보아도 소리지르는 거구먼.");
 assert.equal(q.morph.answer,"것/이/구먼");
 assert.equal(q.morph.gradeable,true);
 assert.equal(q.morph.types[0],"의존·실질");
 assert.equal(q.morphology.length,4);
 assert.equal(q.chunks[3].parts[1].detail.at(-1),"서술격 조사");
 assert.equal(q.analysisVersion,ANALYSIS_VERSION);
});

test("engine failure uses contextual fallback with transparent noun inference",async()=>{
 const analyze=createSentenceAnalyzer(async()=>{throw Error("network unavailable");});
 const q=await analyze("미등록표현 몰라.");
 assert.ok(q.modelWarning);
 assert.equal(q.chunks[0].parts[0].gradeable,true);
 assert.equal(q.chunks[0].parts[0].confidence,"context");
 assert.match(q.chunks[0].parts[0].why,/推定|추정/);
 assert.equal(q.morph.answer,"모르/아");
 assert.equal(q.morph.gradeable,true);
});

test("concurrent analysis shares engine load; failed load can retry",async()=>{
 let calls=0;
 const analyze=createSentenceAnalyzer(async()=>{calls++;return {analyze(){return {tokens:[]};}};});
 await Promise.all([analyze("써."),analyze("몰라.")]);
 assert.equal(calls,1);
 let retries=0;
 const retry=createSentenceAnalyzer(async()=>{if(++retries===1)throw Error("offline");return {analyze(){return {tokens:[]};}};});
 await retry("써.");await retry("써.");
 assert.equal(retries,2);
});

test("original spelling option and validation precede model loading",async()=>{
 let calls=0;
 const analyze=createSentenceAnalyzer(async()=>{calls++;return {analyze(){return {tokens:[]};}};});
 await assert.rejects(analyze(" "));
 assert.equal(calls,0);
 const q=await analyze("하는 거구만.",{correctSpelling:false});
 assert.equal(q.morphology.at(-1).analysis,"것/이/구만");
 assert.equal(q.preprocessing.corrections.length,0);
});
