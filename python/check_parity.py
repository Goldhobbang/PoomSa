"""Compare the shared JS and Python rule pipelines. Requires Node.js 22+."""
import json
from pathlib import Path
import subprocess
from poomsa_pipeline import analyze_sentence

FIXTURES = [
    "썸네일만 보아도 소리지르는 거구만.", "써 몰라 썼다 몰랐다",
    "예쁜 사람이 볼 수 있다.", "고양이가 친구가 되었다.", "할수 있다.",
    "읽을 책을 본다.", "모르는 것", "살면 웃는다.", "미등록표현", "고양이",
    "학생이다.", "예쁜다", "써도 몰라도 빨라도 커도", "학생이 아니다.",
    "할 줄 안다.", "예쁜 사람이 읽을 책을 볼 수 있는 것",
]
root = Path(__file__).resolve().parents[1]
FIXTURES += [f["input"] for f in json.loads((root / "tests/context-cases.json").read_text(encoding="utf-8"))]
FIXTURES += [f["input"].replace(" ", "") for f in json.loads((root / "tests/context-cases.json").read_text(encoding="utf-8"))]
FIXTURES += [
    "너만큼은 아는 대로 말하고 친구와 같이 가야 한다.",
    "너만큼은아는대로말하고친구와같이가야한다.",
    "너만큼은아는 대로말하고 친구와같이가야한다.",
    "첫째 딸이 사과 한 개를 다른 사람에게 주었다.",
    "첫째딸이사과한개를다른사람에게주었다.",
    "첫째딸이 사과한 개를 다른사람에게주었다.",
    "**첫째 딸이 사과 한 개를 다른 사람에게 주었다.**  ",
]
code = '''
import fs from "node:fs";
import {preprocessSentence,analyzeHybrid} from "./hybrid-analyzer.mjs";
const input=JSON.parse(fs.readFileSync(0,"utf8"));
console.log(JSON.stringify(input.map(s=>analyzeHybrid(preprocessSentence(s).sentence))));
'''
result = subprocess.run(["node", "--input-type=module", "-e", code],
                        input=json.dumps(FIXTURES), capture_output=True,
                        encoding="utf-8", check=True, cwd=root)


def shape(q):
    return [dict(analysis=w["analysis"], pos=[t["pos"] for t in w["tokens"]],
                 gradeable=w["gradeable"], restored=w["restored"]) for w in q["words"]]


for sentence, js in zip(FIXTURES, json.loads(result.stdout)):
    assert shape(js) == shape(analyze_sentence(sentence)), sentence
print(f"JavaScript/Python parity: {len(FIXTURES)} fixtures passed.")
