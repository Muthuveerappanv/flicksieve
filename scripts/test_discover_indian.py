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


class TestFilmTitleFromReview(unittest.TestCase):
    def test_strips_review_suffix_and_cast(self):
        self.assertEqual(
            di.film_title_from_review("IMMORTAL Review - GV Prakash Kumar, Kayadu Lohar - Tamil Talkies"),
            "IMMORTAL",
        )

    def test_handles_movie_review_phrasing(self):
        self.assertEqual(
            di.film_title_from_review("Bethlehem Kudumba Unit Malayalam Movie Review - Nivin Pauly"),
            "Bethlehem Kudumba Unit",
        )

    def test_handles_version_qualifier(self):
        self.assertEqual(
            di.film_title_from_review("IRUMUDI Tamil Version Review - Ravi Teja, GV Prakash"),
            "IRUMUDI",
        )

    def test_handles_apostrophes(self):
        self.assertEqual(
            di.film_title_from_review("I'M GAME Review - Dulquer Salmaan, Kayadu Lohar"),
            "I'M GAME",
        )

    def test_returns_none_for_non_reviews(self):
        self.assertIsNone(di.film_title_from_review("MOONWALK This Diwali! AR Rahman x Prabhudeva"))

    def test_normalize_matches_across_casing_and_punctuation(self):
        self.assertEqual(di.normalize_title("I'M GAME"), di.normalize_title("i'm game"))
        self.assertEqual(di.normalize_title("Vishwanath & Sons"), di.normalize_title("Vishwanath and Sons"))


class TestMetadataParsing(unittest.TestCase):
    def test_view_counts(self):
        self.assertEqual(di.parse_view_count("416K views"), 416000)
        self.assertEqual(di.parse_view_count("1.5M views"), 1500000)
        self.assertEqual(di.parse_view_count("973 views"), 973)
        self.assertIsNone(di.parse_view_count("no views here"))

    def test_relative_dates(self):
        self.assertEqual(di.parse_relative_date("1 day ago"), 1)
        self.assertEqual(di.parse_relative_date("2 weeks ago"), 14)
        self.assertEqual(di.parse_relative_date("3 months ago"), 90)
        self.assertEqual(di.parse_relative_date("2 years ago"), 730)
        self.assertIsNone(di.parse_relative_date("416K views"))
