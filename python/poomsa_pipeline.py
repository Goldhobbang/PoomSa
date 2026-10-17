"""PoomSa reference hybrid pipeline, Python 3.10+, standard library only.

The web app runs the matching JavaScript rules plus Garu/WASM. This module
accepts optional Sejong-tagged model_tokens; it never starts an LLM or server.
Run: python python/poomsa_pipeline.py '썸네일만 보아도 소리지르는 거구만.'
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import re
import unicodedata

RULES = json.loads((Path(__file__).resolve().parents[1] / "grammar-rules.json").read_text(encoding="utf-8"))
NOUNS = set(RULES["nouns"])
DEPENDENT = set(RULES["dependentNouns"])


def syllable(text):
    n = ord(text[-1]) - 0xAC00 if text else -1
    return (n, n % 28) if 0 <= n < 11172 else None


def with_final(text, jong):
    h = syllable(text)
    return text[:-1] + chr(0xAC00 + h[0] - h[1] + jong) if h else text


def present_declarative(root, pos=None):
    pos = pos or RULES["predicates"].get(root)
    if not root or pos not in ("VV", "VA", "VCN"):
        return None
    if pos != "VV":
        return {"form": root + "다", "acceptsNda": False, "pos": pos}
    h = syllable(root)
    form = with_final(root, 4) + "다" if not h or h[1] in (0, 8) else root + "는다"
    return {"form": form, "acceptsNda": True, "pos": pos}


def preprocess_sentence(text, correct_spelling=True):
    if not text.strip() or len(text.encode("utf-16-le")) // 2 > 180:
        raise ValueError("문장은 1자 이상 180자 이하로 입력하세요.")
    sentence = re.sub(r"\s+", " ", unicodedata.normalize("NFC", text).strip())
    corrections = []
    if sentence != text:
        corrections.append({"before": text, "after": sentence, "reason": "유니코드·공백 정규화"})
    if correct_spelling:
        for pattern, replacement, reason in [
            (r"(거|이|는|었|았|겠|좋|없|있|크)구만(?=[.!?。？！…]|$)",
             lambda m: m[1] + "구먼", "종결 어미 ‘-구만’의 표준 표기는 ‘-구먼’입니다."),
            (r"(할|갈|볼|먹을|읽을)수(?=\s|[.!?]|$)",
             lambda m: m[1] + " 수", "관형사형 뒤의 의존 명사 ‘수’는 띄어 씁니다."),
        ]:
            def apply(match):
                after = replacement(match)
                corrections.append({"before": match[0], "after": after, "reason": reason})
                return after
            sentence = re.sub(pattern, apply, sentence)
    return {"original": text, "sentence": sentence, "corrections": corrections, "correctSpelling": correct_spelling}


def token(text, pos, rule, **extra):
    return dict(text=text, pos=pos, rule=rule, **extra)


def predicate_candidate(word):
    candidates = []

    def add(root, ending, rule):
        pos = RULES["predicates"].get(root)
        if not pos:
            return
        ep = []
        while ending and ending[0] in ("았", "었", "겠", "시"):
            ep.append(ending[0])
            ending = ending[1:]
        tag = RULES["endings"].get(ending)
        if not tag:
            return
        if ending in ("ㄴ다", "는다", "는구먼", "는구만") and pos != "VV":
            return
        if ending == "는" and pos != "VV" and root not in ("있", "없"):
            return
        candidates.append([
            token(root, pos, rule, lemma=root + "다", present=present_declarative(root, pos)),
            *[token(e, "EP", rule) for e in ep], token(ending, tag, rule),
        ])

    for surface, (root, vowel, rule) in RULES["restorations"].items():
        if word.startswith(surface):
            add(root, vowel + word[len(surface):], rule)
        if syllable(surface) and syllable(surface)[1] == 0:
            past = with_final(surface, 20)
            if word.startswith(past):
                add(root, ("았" if vowel == "아" else "었") + word[len(past):], rule + "·과거")
    for root, pos in RULES["predicates"].items():
        if word.startswith(root):
            add(root, word[len(root):], "어간·어미 사전 결합")
        h = syllable(root)
        if not h:
            continue
        if h[1] in (0, 8):
            for jong, ending in ((4, "ㄴ"), (8, "ㄹ"), (16, "ㅁ")):
                fused = with_final(root, jong)
                if word.startswith(fused):
                    add(root, ending + word[len(fused):], "받침형 어미 분리")
        if h[1] == 8:
            dropped = with_final(root, 0)
            if word.startswith(dropped):
                add(root, word[len(dropped):], "ㄹ 탈락")
        if pos == "VV" and word == present_declarative(root, pos)["form"]:
            add(root, "는다" if h[1] not in (0, 8) else "ㄴ다", "현재 평서형 검사")
    candidates.sort(key=lambda ts: -len(ts[0]["text"]))
    return candidates[0] if candidates else None


def nominal_candidate(word, previous, model):
    copula = re.fullmatch(r"(거|것|학생|사람|친구|학교|고양이)(이?)(구먼|구만|다|고|면|니)", word)
    if copula:
        base, visible, ending = copula.groups()
        if not visible and syllable(base) and syllable(base)[1]:
            return None
        rule = "것→거 축약·서술격 조사 이- 복원" if base == "거" else "체언·서술격 조사 분리"
        return [token("것" if base == "거" else base, "NNB" if base in DEPENDENT else "NNG", rule, surface=base),
                token("이", "VCP", rule, lemma="이다", surface=visible),
                token(ending, RULES["endings"][ending], rule)]
    base, particles = word, []
    suffixes = sorted(RULES["particles"], key=lambda s: -len(s))
    while base and base not in NOUNS and base not in DEPENDENT:
        suffix = next((s for s in suffixes if len(base) > len(s) and base.endswith(s)), None)
        if not suffix:
            break
        particles.insert(0, token(suffix, RULES["particles"][suffix], "체언·조사 경계"))
        base = base[:-len(suffix)]
    if base not in NOUNS | DEPENDENT:
        return None
    modified = any(t["pos"] == "ETM" for t in previous)
    dep = base in DEPENDENT and modified
    if base in DEPENDENT and not modified and not any(t["pos"] == "NNB" for t in model):
        return None
    model_pos = next((t["pos"] for t in model if t["pos"] in ("NNG", "NNP", "NNB")), "NNG")
    return [token(base, "NNB" if dep else model_pos,
                  "관형사형+띄어쓰기+의존 명사 후보" if dep else "명사 사전",
                  uncertain=not dep and base in DEPENDENT), *particles]


def analyze_hybrid(sentence, model_tokens=None):
    """Optional tokens use corrected-text offsets: text, pos, start, end.

    JavaScript uses UTF-16 offsets; Python emits code-point offsets. The browser
    and this reference must each use the offsets native to their own runtime.
    """
    model_tokens = model_tokens or []
    words = []
    for match in re.finditer(r"\S+", sentence):
        surface = match[0]
        word = re.sub(r'''^[“‘"'([{]+|[,.!?。？！…;:”’"')\]}]+$''', "", surface)
        start, end = match.span()
        model = [dict(t) for t in model_tokens if start <= t.get("start", -1) < end
                 and not re.fullmatch(r"S[FWPSOECL]", t["pos"])]
        previous = words[-1]["tokens"] if words else []
        nominal = nominal_candidate(word, previous, model)
        predicate = predicate_candidate(word)
        dependent_context = nominal and nominal[0]["pos"] == "NNB" and any(t["pos"] == "ETM" for t in previous)
        selected = (nominal if dependent_context else predicate or nominal or model) or [token(word, "NA", "미등록어: 품사 판정 보류")]
        selected = [dict(t, start=start, end=end) for t in selected]
        for t in selected:
            if t["pos"] in ("NNG", "NNB") and t["text"] in DEPENDENT and any(p["pos"] == "ETM" for p in previous):
                t.update(pos="NNB", rule="관형사형+띄어쓰기+의존 명사 후보")
        verb = next((t for t in selected if t["pos"] in ("VV", "VA", "VX", "VCN")), None)
        if verb:
            model_verb = next((t for t in model if t["text"] == verb["text"] and t["pos"] in ("VV", "VA", "VX", "VCN")), None)
            if predicate and model_verb and model_verb["pos"] != verb["pos"]:
                verb.update(pos=model_verb["pos"], uncertain=True)
                verb["rule"] += "; 사전·모델의 품사 충돌로 채점 보류"
            if predicate and not model_verb and any(t["pos"] in ("NNG", "NNP", "NNB", "NP", "NR") for t in model):
                verb["uncertain"] = True
                verb["rule"] += "; 체언·용언 후보 충돌로 채점 보류"
            verb["present"] = present_declarative(verb["text"], verb["pos"])
        last = selected[-1]
        if last["pos"] == "EC" and last["text"] in ("아", "어") and (re.search(r"[.!?。？！…]$", surface) or end == len(sentence)):
            last["pos"] = "EF"
        used = list(dict.fromkeys(t["rule"] for t in selected if t.get("rule")))
        words.append(dict(surface=surface, start=start, end=end, tokens=selected,
                          restored=any(re.search(r"탈락|불규칙|축약|받침형|복원", r) for r in used),
                          gradeable=bool(predicate or nominal) and all(t["pos"] != "NA" and not t.get("uncertain") for t in selected),
                          analysis="/".join(t["text"] for t in selected), rules=used))
    for i, w in enumerate(words):
        next_pred = next((t for t in words[i + 1]["tokens"] if t["pos"] in ("VV", "VCN")), None) if i + 1 < len(words) else None
        prior_subject = any(t["pos"] == "JKS" for prior in words[:i] for t in prior["tokens"])
        if prior_subject and next_pred and next_pred["text"] in ("되", "아니"):
            for t in w["tokens"]:
                if t["text"] in ("이", "가") and t["pos"] == "JKS":
                    t.update(pos="JKC", rule="앞 주어와 ‘되다·아니다’ 문맥으로 보격 판별")
            w["rules"] = list(dict.fromkeys(t["rule"] for t in w["tokens"] if t.get("rule")))
    return {"tokens": [t for w in words for t in w["tokens"]], "words": words}


def analyze_sentence(text, correct_spelling=True, model_tokens=None):
    prepared = preprocess_sentence(text, correct_spelling)
    return {"preprocessing": prepared, **analyze_hybrid(prepared["sentence"], model_tokens)}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("sentence", nargs="?", default="썸네일만 보아도 소리지르는 거구만.")
    parser.add_argument("--no-correct", action="store_true", help="표기 교정 없이 원문 분석")
    args = parser.parse_args()
    print(json.dumps(analyze_sentence(args.sentence, not args.no_correct), ensure_ascii=False, indent=2))
