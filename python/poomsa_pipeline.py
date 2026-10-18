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
    if not root or pos not in ("VV", "VX", "VA", "VCN"):
        return None
    if pos not in ("VV", "VX"):
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
    wrapped = sentence
    if wrapped.startswith("**") and wrapped.endswith("**"):
        wrapped = wrapped[2:-2].strip()
    if (wrapped.startswith('"') and wrapped.endswith('"')) or (wrapped.startswith('“') and wrapped.endswith('”')):
        wrapped = wrapped[1:-1].strip()
    if wrapped != sentence:
        corrections.append(dict(before=sentence, after=wrapped, reason="문장 둘레의 인용·강조 표시 제거"))
        sentence = wrapped
    return {"original": text, "sentence": sentence, "corrections": corrections, "correctSpelling": correct_spelling}


def token(text, pos, rule, **extra):
    return dict(text=text, pos=pos, rule=rule, **extra)


def quantity(t):
    return t["pos"] in ("NR", "SN") or t["pos"] == "MM" and t["text"] in RULES["quantityDeterminers"]


def predicate_candidate(word, additional=None):
    lexemes = {**(additional or {}), **RULES["predicates"]}
    candidates = []

    def add(root, ending, rule):
        pos = lexemes.get(root)
        if not pos:
            return
        ep = []
        while ending and ending[0] in ("았", "었", "였", "겠", "시"):
            ep.append(ending[0])
            ending = ending[1:]
        tag = RULES["endings"].get(ending)
        if not tag:
            return
        if ending in ("ㄴ다", "는다", "는구먼", "는구만") and pos not in ("VV", "VX"):
            return
        if ending == "는" and pos not in ("VV", "VX") and root not in ("있", "없"):
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
    for root, pos in lexemes.items():
        if word.startswith(root):
            add(root, word[len(root):], "어간·어미 사전 결합")
        h = syllable(root)
        if not h:
            continue
        if h[1] in (0, 8):
            for jong, ending in ((4, "ㄴ"), (8, "ㄹ"), (16, "ㅁ"), (17, "ㅂ")):
                fused = with_final(root, jong)
                if word.startswith(fused):
                    add(root, ending + word[len(fused):], "받침형 어미 분리")
        if h[1] == 8:
            dropped = with_final(root, 0)
            if word.startswith(dropped):
                add(root, word[len(dropped):], "ㄹ 탈락")
        if pos == "VV" and word == present_declarative(root, pos)["form"]:
            add(root, "는다" if h[1] not in (0, 8) else "ㄴ다", "현재 평서형 검사")
        if root.endswith("하"):
            for suffix, ending in (("해", "여"), ("했", "였")):
                fused = root[:-1] + suffix
                if word.startswith(fused):
                    add(root, ending + word[len(fused):], "하다 활용·축약 복원")
    candidates.sort(key=lambda ts: -len(ts[0]["text"]))
    return candidates[0] if candidates else None


def lexical_tag(base, previous, model):
    if base in DEPENDENT and any(t["pos"] == "ETM" for t in previous):
        return "NNB"
    tagged = next((t["pos"] for t in model if t["text"] == base and t["pos"] in ("NNG", "NNP", "NNB", "NP", "NR")), None)
    if base in RULES["counters"] and any(quantity(t) for t in previous):
        return "NNB"
    if base in ("내", "네", "제"):
        return "NP"
    if base in RULES["properNouns"]:
        return "NNP"
    return RULES["lexicon"].get(base) or ("NNG" if base in NOUNS else tagged or "NNG")


def nominal_candidate(word, previous, model, fallback=False):
    if word in RULES["lexicon"]:
        return [token(word, lexical_tag(word, previous, model), "기능어 사전", confidence="rule")]
    copula = re.fullmatch(r"(.+?)(이)(구먼|구만|다|고|면|니|었다|었어요|네요|라)", word) or re.fullmatch(r"(거|학생|사람|친구|학교|고양이)(이?)(구먼|구만|다|고|면|니)", word)
    if copula:
        base, visible, ending = copula.groups()
        if not visible and syllable(base) and syllable(base)[1]:
            return None
        rule = "것→거 축약·서술격 조사 이- 복원" if base == "거" else "체언·서술격 조사 분리"
        if base not in NOUNS | DEPENDENT and not fallback and not any(t["pos"] == "VCP" for t in model):
            return None
        past = ending.startswith("었")
        return [token("것" if base == "거" else base, "NNB" if base in DEPENDENT else lexical_tag(base, previous, model), rule, surface=base),
                token("이", "VCP", rule, lemma="이다", surface=visible),
                *([token("었", "EP", rule)] if past else []),
                token(ending[1:] if past else ending, RULES["endings"].get(ending[1:] if past else ending, "EF"), rule)]
    base, particles = word, []
    suffixes = sorted(RULES["particles"], key=lambda s: -len(s))
    split = next((i for i, t in enumerate(model) if t["pos"].startswith("J")), len(model))
    head, tail = model[:split], model[split:]
    compound = "".join(t["text"] for t in head) if head and all(t["pos"].startswith("NN") for t in head) and all(t["pos"].startswith("J") for t in tail) else ""
    def known_base(b):
        return b in NOUNS | DEPENDENT or b in RULES["lexicon"] or b == compound or any(t["text"] == b and re.match(r"NN|NP|NR", t["pos"]) for t in model)
    while base and not known_base(base):
        suffix = next((s for s in suffixes if len(base) > len(s) and base.endswith(s)), None)
        if not suffix:
            break
        tagged = next((t["pos"] for t in model if t["text"] == suffix and t["pos"].startswith("J")), None)
        particles.insert(0, token(suffix, tagged or RULES["particles"][suffix], "체언·조사 경계"))
        base = base[:-len(suffix)]
    known = known_base(base)
    if not known and not fallback:
        return None
    for i, part in enumerate(particles):
        if i and part["text"] == "만큼" and any(t["pos"].startswith("JK") for t in particles[:i]):
            part["pos"] = "JX"
    cases = sum(t["pos"].startswith("JK") or t["pos"] == "JC" for t in particles)
    base_tag = lexical_tag(base, previous, model)
    if cases > 1 or any(t["pos"] == "JKV" for t in particles) and len(particles) > 1:
        return None
    if particles and not re.match(r"NN|NP|NR|SN", base_tag) and not (base_tag == "MAG" and all(t["pos"] == "JX" for t in particles)):
        return None
    modified = any(t["pos"] == "ETM" for t in previous)
    dep = base in DEPENDENT and modified
    return [token(base, "NNB" if dep else lexical_tag(base, previous, model),
                  "관형사형+띄어쓰기+의존 명사 후보" if dep else "체언·기능어 사전" if known else "조사 경계·체언 위치로 미등록 명사 추정",
                  confidence="rule" if known else "context"), *particles]


def fallback_candidate(word, previous, model):
    if re.fullmatch(r"\d+(?:[.,]\d+)?", word):
        return [token(word, "SN", "숫자 표기")]
    derived = re.fullmatch(r"(.+?)(하|해|했)(.+)", word)
    if derived:
        base, form, tail = derived.groups()
        rest = ("여" if form == "해" else "였" if form == "했" else "") + tail
        ep = []
        while rest and rest[0] in ("았", "었", "였", "겠", "시"):
            ep.append(token(rest[0], "EP", "생산적 하다 파생"))
            rest = rest[1:]
        if rest in RULES["endings"]:
            return [token(base + "하", "VV", "생산적 하다 파생·문맥 추정", lemma=base + "하다", confidence="context"), *ep, token(rest, RULES["endings"][rest], "어미 사전")]
    return nominal_candidate(word, previous, model, fallback=True) or [token(word, "NNG", "조사 결합 조건에 맞지 않아 원형을 유지한 미등록어", confidence="context")]


def split_run(run, model, next_core=""):
    if run in NOUNS | DEPENDENT or run in RULES["lexicon"] or run in RULES["properNouns"]:
        return [run]
    if len(model) == 1 and model[0]["text"] == run and model[0]["pos"] in ("MM", "MAG", "MAJ", "IC", "NP", "NR"):
        return [run]
    extra = {}
    for i, t in enumerate(model):
        if t["pos"] in ("VV", "VA", "VCN", "VX"):
            extra[t["text"]] = t["pos"]
        if i and t["pos"] in ("XSV", "XSA") and model[i-1]["pos"].startswith("NN"):
            extra[model[i-1]["text"] + t["text"]] = "VV" if t["pos"] == "XSV" else "VA"
    suspicious = any(t["pos"] == "NNP" and t["text"] == run for t in model) and len(run) > 7 and re.search(r"(다|요|어요|아요)$", run)
    registered = lambda t: t and (t["text"] in NOUNS | DEPENDENT or t["text"] in RULES["properNouns"] or t["text"] in RULES["lexicon"])
    full_nominal = nominal_candidate(run, [], model)
    full_predicate = predicate_candidate(run, extra)
    next_nominal = nominal_candidate(next_core, [], [])
    count_context = next_nominal and next_nominal[0]["text"] in RULES["counters"] and run.endswith("한") and run[:-1] in NOUNS and full_predicate and full_predicate[0]["text"] not in RULES["predicates"]
    if (full_predicate and not count_context or full_nominal and registered(full_nominal[0])) and not suspicious:
        return [run]
    cache, states = {}, [[] for _ in range(len(run) + 1)]
    states[0] = [(0, [], [])]

    def candidates(word):
        if word in cache:
            return cache[word]
        out = []
        p, n = predicate_candidate(word, extra), nominal_candidate(word, [], model)
        if p:
            out.append((p, 1.5 if p[0]["text"] in RULES["predicates"] else 5))
        if n:
            out.append((n, (1.4 if len(n) > 1 else 1.9) if registered(n[0]) else 5+len(n[0]["text"])*.5))
        if not n:
            inferred = nominal_candidate(word, [], model, True)
            if inferred and len(inferred) > 1 and re.match(r"NN|NP|NR", inferred[0]["pos"]) and 2 <= len(inferred[0]["text"]) <= 6:
                out.append((inferred, 5 + len(inferred[0]["text"]) * .5))
        if re.fullmatch(r"\d+", word):
            out.append(([token(word, "SN", "숫자")], 1.8))
        cache[word] = out
        return out

    def transition(prior, following):
        last = prior[-1] if prior else {}
        first, cost = following[0], 0
        if last.get("pos") == "MM":
            cost += -1 if re.match(r"NN|NP|NR|SN", first["pos"]) else 4
        if last.get("pos") == "ETM":
            cost += -.5 if re.match(r"NN|NP|NR", first["pos"]) else 4
        if first["text"] in RULES["counters"] and any(quantity(t) for t in prior):
            cost -= 1.5
        if first["pos"] == "NNB" and not any(t["pos"] in ("ETM", "MM", "NR", "SN") for t in prior):
            cost += 2
        if last.get("pos") == "EC" and re.match(r"V|XSV|XSA", first["pos"]):
            cost -= .5
        if last.get("pos") == "EF":
            cost += 8
        return cost

    for i in range(len(run)):
        beam = sorted(states[i], key=lambda item: item[0])[:8]
        if not beam:
            continue
        for end in range(i+1, min(len(run), i+24)+1):
            word = run[i:end]
            options = candidates(word)
            if not options and len(word) <= 12:
                options.append(([token(word, "NNG", "미등록", confidence="context")], 8+len(word)*2))
            for cost, path, prior in beam:
                for ts, local_cost in options:
                    states[end].append((cost + local_cost + transition(prior, ts), path+[word], ts))
            if len(states[end]) > 48:
                states[end] = sorted(states[end], key=lambda item: item[0])[:16]
    best = min(states[-1], key=lambda item: item[0]) if states[-1] else None
    return best[1] if best and len(best[1]) > 1 and best[0] < 8 + len(run)*2 - 2 else [run]


def recover_word_boundaries(sentence, model_tokens=None):
    pieces, changes = [], []
    matches = list(re.finditer(r"\S+", sentence))
    for index, m in enumerate(matches):
        surface = m[0]
        core = re.sub(r'''^[“‘"'([{]+|[,.!?。？！…;:”’"')\]}]+$''', "", surface)
        if not core:
            pieces.append(surface)
            continue
        prefix, suffix = surface[:surface.index(core)], surface[surface.index(core)+len(core):]
        model = [t for t in model_tokens or [] if m.start() <= t.get("start", -1) < m.end() and not re.fullmatch(r"S[FWPSOECL]", t["pos"])]
        next_core = re.sub(r'''^[“‘"'([{]+|[,.!?。？！…;:”’"')\]}]+$''', "", matches[index+1][0]) if index+1 < len(matches) else ""
        parts = split_run(core, model, next_core)
        after = prefix + " ".join(parts) + suffix
        pieces.append(after)
        if len(parts) > 1:
            changes.append(dict(before=surface, after=after, reason="조사·어미 경계와 앞뒤 품사 후보로 띄어쓰기 복원"))
    return dict(sentence=" ".join(pieces), changes=changes)


def analyze_hybrid(sentence, model_tokens=None):
    """Optional tokens use corrected-text offsets: text, pos, start, end.

    JavaScript uses UTF-16 offsets; Python emits code-point offsets. The browser
    and this reference must each use the offsets native to their own runtime.
    """
    model_tokens = model_tokens or []
    layout = recover_word_boundaries(sentence, model_tokens)
    if layout["sentence"] != sentence:
        sentence, model_tokens = layout["sentence"], []
    words = []
    matches = list(re.finditer(r"\S+", sentence))
    for index, match in enumerate(matches):
        surface = match[0]
        word = re.sub(r'''^[“‘"'([{]+|[,.!?。？！…;:”’"')\]}]+$''', "", surface)
        start, end = match.span()
        model = [dict(t) for t in model_tokens if start <= t.get("start", -1) < end
                 and not re.fullmatch(r"S[FWPSOECL]", t["pos"])]
        previous = words[-1]["tokens"] if words else []
        nominal = nominal_candidate(word, previous, model)
        predicate = predicate_candidate(word)
        dependent_context = nominal and nominal[0]["pos"] == "NNB" and any(t["pos"] == "ETM" for t in previous)
        complete = model and any(re.match(r"NN|NP|NR|V|M|IC|SN|SL|SH", t["pos"]) for t in model) and all(t["pos"] != "NA" for t in model)
        model_verb = next((t for t in model if t["pos"] in ("VV", "VA", "VX", "VCN")), None)
        bare_model = complete and len(model) == 1 and re.match(r"NN|NP|NR|MM|MAG|MAJ|IC", model[0]["pos"]) and model[0]["text"] == word and (not predicate or predicate[-1]["pos"] == "ETM")
        selected = nominal if dependent_context else (nominal or model) if bare_model else predicate or nominal or (model if complete else None) or fallback_candidate(word, previous, model)
        next_word = re.sub(r'''^[“‘"'([{]+|[,.!?。？！…;:”’"')\]}]+$''', "", matches[index + 1][0]) if index + 1 < len(matches) else ""
        if nominal and nominal[0]["pos"] == "NP" and predicate and predicate[-1]["pos"] == "ETM":
            following = nominal_candidate(next_word, [], [])
            modifies = following and re.match(r"NN|NP|NR", following[0]["pos"]) and (not following[-1]["pos"].startswith("J") or following[-1]["pos"] == "JKS")
            if complete:
                selected = predicate if model_verb else nominal
            elif not modifies:
                selected = nominal
        if RULES["lexicon"].get(word) in ("MAG", "MAJ", "IC") and not model_verb:
            selected = [token(word, RULES["lexicon"][word], "부사·감탄사 사전과 문장 문맥")]
        if (word in ("한", "두", "세", "네", "이", "그", "저", "새", "헌") or re.fullmatch(r"첫째|둘째|셋째|넷째|다섯째|여섯째|일곱째|여덟째|아홉째|열째", word)) and next_word and (next_word in NOUNS or nominal_candidate(next_word, [], [])) and not predicate_candidate(next_word):
            selected = [token(word, "MM", "뒤 체언을 수식하는 관형사 문맥")]
        selected = [dict(t, start=start, end=end) for t in selected]
        for t in selected:
            if t["pos"] in ("NNG", "NNB") and t["text"] in DEPENDENT and any(p["pos"] == "ETM" for p in previous):
                t.update(pos="NNB", rule="관형사형+띄어쓰기+의존 명사 후보")
        verb = next((t for t in selected if t["pos"] in ("VV", "VA", "VX", "VCN")), None)
        if verb:
            model_verb = next((t for t in model if t["text"] == verb["text"] and t["pos"] in ("VV", "VA", "VX", "VCN")), None)
            if predicate and model_verb and model_verb["pos"] != verb["pos"]:
                verb.update(pos=model_verb["pos"], confidence="context")
                verb["rule"] += "; 동형 어간의 품사는 문장 모델의 문맥 판별을 적용"
            verb["present"] = present_declarative(verb["text"], verb["pos"])
        last = selected[-1]
        if last["pos"] == "EC" and last["text"] in ("아", "어") and (re.search(r"[.!?。？！…]$", surface) or end == len(sentence)):
            last["pos"] = "EF"
        for t in selected:
            t.pop("uncertain", None)
            t["rule"] = t.get("rule") or "문장 형태소 모델의 문맥 분석"
        used = list(dict.fromkeys(t["rule"] for t in selected if t.get("rule")))
        words.append(dict(surface=surface, start=start, end=end, tokens=selected,
                          restored=any(re.search(r"탈락|불규칙|축약|받침형|복원", r) for r in used),
                          gradeable=any(re.match(r"NN|NP|NR|V|M|IC|SN|SL|SH", t["pos"]) for t in selected),
                          analysis="/".join(t["text"] for t in selected), rules=used))
    for i, w in enumerate(words):
        previous = words[i-1]["tokens"] if i else []
        following = words[i+1]["tokens"] if i+1 < len(words) else []
        first = w["tokens"][0] if w["tokens"] else {}
        if first.get("text") in RULES["counters"] and any(quantity(t) for t in previous):
            first.update(pos="NNB", rule="수량 관형사·수사 뒤의 단위 의존 명사")
        if re.sub(r"[.!?]+$", "", w["surface"]) == "다른":
            comparison = (any(t["pos"] == "JKS" for t in previous) and any(t["text"] in ("성격", "색깔", "의견", "모양", "종류", "크기", "방법", "생김새") for t in previous)) or any(t["pos"] == "JKB" and t["text"] in ("과", "와", "보다") or t["text"] in ("서로", "전혀", "매우", "아주") for t in previous)
            if comparison:
                w["tokens"] = [token("다르", "VA", "주격·비교 성분을 갖춘 관형절: 다르-+-ㄴ", lemma="다르다", start=w["start"], end=w["end"]), token("ㄴ", "ETM", "형용사 관형사형", start=w["start"], end=w["end"])]
            else:
                w["tokens"] = [token("다른", "MM", "‘딴’으로 바꾸어 뒤 체언을 한정하는 성상 관형사", start=w["start"], end=w["end"])]
        for t in w["tokens"]:
            if t["text"] in ("과", "와", "랑", "이랑", "하고") and t["pos"].startswith("J"):
                shared = any(t["text"] in ("같이", "함께", "서로", "다르", "같") for t in following)
                if shared:
                    t.update(pos="JKB", rule="함께함·비교를 나타내는 뒤 표현과 결합하는 부사격 조사")
                elif any(t["pos"] in ("NNG", "NNP", "NP", "NR") for t in following):
                    t.update(pos="JC", rule="뒤 체언과 같은 자격으로 이어 주는 접속 조사")
                elif any(t["pos"] in ("VV", "VA", "VX") for t in following):
                    t.update(pos="JKB", rule="뒤 서술어와 동반·비교 관계를 이루는 부사격 조사")
            if t["text"] == "만큼" and t["pos"].startswith("J") and any(t["text"] in ("은", "는") for t in w["tokens"]):
                earlier = any(t["pos"] == "JKS" or t["pos"] == "JX" and t["text"] in ("은", "는", "도") for prior in words[:i] for t in prior["tokens"])
                comparative = earlier or any(t["text"] in ("크", "작", "많", "적", "빠르") or t["pos"] == "JKS" for nxt in words[i+1:i+5] for t in nxt["tokens"])
                if not comparative and first.get("pos") in ("NP", "NNP"):
                    t.update(pos="JX", rule="다른 대상과 견주기보다 ‘적어도 그 대상만은’이라는 한정을 우선한 보조사", acceptedPos=["JKB"], alternativeReason="비슷한 정도·한도의 뜻으로 읽으면 ‘만큼’을 부사격 조사로 분석하는 해석도 가능합니다.")
        verb = next((t for t in w["tokens"] if t["pos"] in ("VV", "VA", "VX")), None)
        if verb and verb["text"] in RULES["auxiliaryEndings"] and previous and previous[-1]["pos"] == "EC":
            ending = previous[-1]["text"]
            if ending in RULES["auxiliaryEndings"][verb["text"]]:
                verb.update(pos="VA" if verb["text"] == "싶" or verb["text"] == "않" and any(t["pos"] == "VA" for t in previous) else "VX", auxiliary=True)
                verb["rule"] += "; 앞 용언과 연결된 보조 용언 구성"
                w["auxiliaryOf"] = i-1
        next_pred = next((t for t in words[i + 1]["tokens"] if t["pos"] in ("VV", "VCN")), None) if i + 1 < len(words) else None
        prior_subject = any(t["pos"] == "JKS" for prior in words[:i] for t in prior["tokens"])
        if prior_subject and next_pred and next_pred["text"] in ("되", "아니"):
            for t in w["tokens"]:
                if t["text"] in ("이", "가") and t["pos"] == "JKS":
                    t.update(pos="JKC", rule="앞 주어와 ‘되다·아니다’ 문맥으로 보격 판별")
        w["analysis"] = "/".join(t["text"] for t in w["tokens"])
        w["rules"] = list(dict.fromkeys(t["rule"] for t in w["tokens"] if t.get("rule")))
        w["restored"] = any(re.search(r"탈락|불규칙|축약|받침형|복원", r) for r in w["rules"])
    return {"tokens": [t for w in words for t in w["tokens"]], "words": words, "sentence": sentence, "spacingChanges": layout["changes"]}


def analyze_sentence(text, correct_spelling=True, model_tokens=None):
    prepared = preprocess_sentence(text, correct_spelling)
    hybrid = analyze_hybrid(prepared["sentence"], model_tokens)
    prepared["sentence"] = hybrid["sentence"]
    prepared["corrections"].extend(hybrid["spacingChanges"])
    return {"preprocessing": prepared, **hybrid}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("sentence", nargs="?", default="썸네일만 보아도 소리지르는 거구만.")
    parser.add_argument("--no-correct", action="store_true", help="표기 교정 없이 원문 분석")
    args = parser.parse_args()
    print(json.dumps(analyze_sentence(args.sentence, not args.no_correct), ensure_ascii=False, indent=2))
