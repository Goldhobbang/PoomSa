import test from 'node:test';
import assert from 'node:assert/strict';
import raw from './garu-reported-fixtures.json' with {type:'json'};
import cases from './context-cases.json' with {type:'json'};
import {createSentenceAnalyzer} from '../model.mjs';
import {analyzeHybrid} from '../hybrid-analyzer.mjs';
import {reportedCases,verifyQuestion} from './reported-cases.mjs';

test('reported sentences preserve expected tags and subtypes with normal, missing and partial spacing',async()=>{
 for(const available of [true,false]){
  const analyze=createSentenceAnalyzer(async()=>{
   if(!available)throw Error('offline regression');
   return {analyze(input){return {tokens:raw.records.find(r=>r.input===input)?.tokens||[]};}};
  });
  for(const f of reportedCases)for(const input of [f.input,...f.variants])verifyQuestion(await analyze(input),f,input);
 }
});

test('24 previous grammar cases have identical analyses with whitespace removed',async()=>{
 const analyze=createSentenceAnalyzer(async()=>{throw Error('offline');});
 const shape=q=>q.morphology.map(w=>[w.analysis,w.tokens.map(t=>t.pos)]);
 for(const f of cases)assert.deepEqual(shape(await analyze(f.input.replace(/\s/gu,''))),shape(await analyze(f.input)),f.input);
});

test('proper noun hints cannot swallow functional words or ordinary nouns',()=>{
 const input='첫째 딸이 같이 가야 한다.';
 const model=[{text:'첫째',pos:'NNP',start:0,end:2},{text:'딸',pos:'NNP',start:3,end:5},
  {text:'이',pos:'JKS',start:3,end:5},{text:'같이',pos:'NNP',start:6,end:8},
  {text:'가야',pos:'NNP',start:9,end:11},{text:'하',pos:'VX',start:12,end:15},{text:'ㄴ다',pos:'EF',start:12,end:15}];
 const q=analyzeHybrid(input,model);
 assert.deepEqual(q.words.map(w=>w.tokens[0].pos),['MM','NNG','MAG','VV','VX']);
 assert.equal(analyzeHybrid('가야는 나라 이름이다.').words[0].tokens[0].pos,'NNP');
 assert.equal(analyzeHybrid('김하늘은 같이 가야 한다.').words[0].tokens[0].text,'김하늘');
});

test('coordination, comitative, count nouns and 다른 are resolved by their local clause',()=>{
 assert.equal(analyzeHybrid('친구와 철수가 웃는다.').words[0].tokens.at(-1).pos,'JC');
 assert.equal(analyzeHybrid('친구와 같이 간다.').words[0].tokens.at(-1).pos,'JKB');
 assert.equal(analyzeHybrid('친구와 가야 한다.').words[0].tokens.at(-1).pos,'JKB');
 assert.equal(analyzeHybrid('개가 웃는다.').words[0].tokens[0].pos,'NNG');
 assert.equal(analyzeHybrid('한 개를 준다.').words[1].tokens[0].pos,'NNB');
 assert.equal(analyzeHybrid('새 개가 웃는다.').words[1].tokens[0].pos,'NNG');
 assert.equal(analyzeHybrid('다른 사람이 웃는다.').words[0].tokens[0].pos,'MM');
 assert.equal(analyzeHybrid('성격이 다른 사람이 웃는다.').words[1].tokens[0].pos,'VA');
 assert.equal(analyzeHybrid('그가 다른 사람을 만난다.').words[1].tokens[0].pos,'MM');
 assert.equal(analyzeHybrid('나는 너만큼은 안다.').words[1].tokens[1].pos,'JKB');
 assert.equal(analyzeHybrid('먹지 않는다.').words[1].tokens[0].pos,'VX');
 assert.equal(analyzeHybrid('아프지 않다.').words[1].tokens[0].pos,'VA');
 assert.equal(analyzeHybrid('먹고 주었다.').words[1].tokens[0].pos,'VV');
});
