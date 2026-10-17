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
        self.assertFalse(analyze_sentence("미등록표현")["words"][0]["gradeable"])


if __name__ == "__main__":
    unittest.main()
