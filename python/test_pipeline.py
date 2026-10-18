import unittest
from poomsa_pipeline import analyze_sentence, present_declarative


class PipelineTest(unittest.TestCase):
    def test_example(self):
        q = analyze_sentence("썸네일만 보아도 소리지르는 거구만.")
        self.assertEqual(q["preprocessing"]["sentence"], "썸네일만 보아도 소리지르는 거구먼.")
        self.assertEqual([w["analysis"] for w in q["words"]], ["썸네일/만", "보/아도", "소리지르/는", "것/이/구먼"])

    def test_original_and_restorations(self):
        self.assertEqual(analyze_sentence("하는 거구만.", False)["words"][-1]["analysis"], "것/이/구만")
        self.assertEqual([w["analysis"] for w in analyze_sentence("써 몰라 썼다 몰랐다")["words"]], ["쓰/어", "모르/아", "쓰/었/다", "모르/았/다"])

    def test_context(self):
        q = analyze_sentence("예쁜 사람이 볼 수 있다.")
        self.assertEqual(q["words"][1]["tokens"][0]["pos"], "NNG")
        self.assertEqual(q["words"][3]["tokens"][0]["pos"], "NNB")

    def test_present(self):
        self.assertEqual(present_declarative("살")["form"], "산다")
        self.assertFalse(present_declarative("있")["acceptsNda"])

    def test_unknown(self):
        word = analyze_sentence("미등록표현")["words"][0]
        self.assertTrue(word["gradeable"])
        self.assertEqual(word["tokens"][0]["confidence"], "context")

    def test_unspaced_reported_sentence(self):
        q = analyze_sentence("너만큼은아는대로말하고친구와같이가야한다.")
        self.assertEqual(q["preprocessing"]["sentence"], "너만큼은 아는 대로 말하고 친구와 같이 가야 한다.")
        self.assertEqual([w["analysis"] for w in q["words"]], ["너/만큼/은", "알/는", "대로", "말하/고", "친구/와", "같이", "가/아야", "하/ㄴ다"])
        self.assertEqual(q["words"][-1]["tokens"][0]["pos"], "VX")

    def test_count_noun_and_ordinal(self):
        q = analyze_sentence("첫째딸이사과한개를다른사람에게주었다.")
        self.assertEqual(q["words"][0]["tokens"][0]["pos"], "MM")
        self.assertEqual(q["words"][4]["tokens"][0]["pos"], "NNB")
        self.assertEqual(q["words"][5]["tokens"][0]["pos"], "MM")

    def test_names_and_common_functional_words(self):
        self.assertEqual(analyze_sentence("가야는 나라 이름이다.")["words"][0]["tokens"][0]["pos"], "NNP")
        self.assertEqual(analyze_sentence("김하늘은같이가야한다.")["words"][0]["tokens"][0]["text"], "김하늘")

    def test_copied_markdown(self):
        q = analyze_sentence("**첫째 딸이 사과 한 개를 주었다.**  ")
        self.assertEqual(q["preprocessing"]["sentence"], "첫째 딸이 사과 한 개를 주었다.")


if __name__ == "__main__":
    unittest.main()
