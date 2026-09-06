import unittest

import discover_indian as di


class TestConstants(unittest.TestCase):
    def test_critic_feeds_present(self):
        self.assertIn("The Hindu", di.CRITIC_FEEDS)
        self.assertEqual(len(di.CRITIC_FEEDS), 4)

    def test_reviewer_weight_dominates(self):
        self.assertGreater(di.W_REVIEWER, di.W_REACH)
        self.assertGreater(di.W_REVIEWER, di.W_CRITIC)


if __name__ == "__main__":
    unittest.main()
