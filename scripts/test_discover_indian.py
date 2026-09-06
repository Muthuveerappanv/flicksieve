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


LOCKUP_FIXTURE = {
    "contents": [{
        "lockupViewModel": {
            "contentId": "WDyUmuUxo8o",
            "metadata": {"lockupMetadataViewModel": {
                "title": {"content": "IMMORTAL Review - GV Prakash Kumar"},
                "metadata": {"contentMetadataViewModel": {"metadataRows": [
                    {"metadataParts": [{"text": {"content": "416K views"}},
                                       {"text": {"content": "1 day ago"}}]}
                ]}},
            }},
        }
    }]
}


class TestHarvest(unittest.TestCase):
    def test_reads_lockup_view_model(self):
        got = di.harvest_videos(LOCKUP_FIXTURE)
        self.assertEqual(len(got), 1)
        self.assertEqual(got[0]["videoId"], "WDyUmuUxo8o")
        self.assertIn("416K views", got[0]["meta"])

    def test_reads_legacy_video_renderer(self):
        legacy = {"videoRenderer": {
            "videoId": "abc12345678",
            "title": {"runs": [{"text": "TOXIC Review"}]},
            "viewCountText": {"simpleText": "1.5M views"},
            "publishedTimeText": {"simpleText": "10 days ago"},
        }}
        got = di.harvest_videos(legacy)
        self.assertEqual(got[0]["videoId"], "abc12345678")

    def test_extract_initial_data_handles_nonce_script(self):
        html = '<script nonce="x">window["ytInitialData"] = {"a":{"b":1}};</script>'
        self.assertEqual(di.extract_initial_data(html), {"a": {"b": 1}})

    def test_extract_initial_data_ignores_braces_inside_strings(self):
        html = '<script>ytInitialData = {"t":"a}b","n":2};</script>'
        self.assertEqual(di.extract_initial_data(html), {"t": "a}b", "n": 2})


class TestCriticParsing(unittest.TestCase):
    def test_json_ld_rating(self):
        html = '<script type="application/ld+json">{"reviewRating":{"ratingValue":"2.5"}}</script>'
        self.assertEqual(di.extract_star_rating(html), 2.5)

    def test_rejects_out_of_range_values(self):
        html = '<script type="application/ld+json">{"ratingValue":"7"}</script>'
        self.assertIsNone(di.extract_star_rating(html))

    def test_text_fallback(self):
        self.assertEqual(di.extract_star_rating("<p>We give it 3.5 out of 5 stars</p>"), 3.5)

    def test_feed_item_parsing(self):
        xml = "<item><title><![CDATA[Gandhari movie review: solid]]></title><link>https://x/1</link></item>"
        self.assertEqual(di._feed_items(xml), [("Gandhari movie review: solid", "https://x/1")])


class TestReviewerScore(unittest.TestCase):
    def test_more_reviewers_always_wins(self):
        three = di.reviewer_score(reviewer_count=3, total_views=100_000, critic_stars=[], age_days=5)
        one = di.reviewer_score(reviewer_count=1, total_views=5_000_000, critic_stars=[], age_days=5)
        self.assertGreater(three, one)

    def test_reach_breaks_ties(self):
        big = di.reviewer_score(reviewer_count=2, total_views=1_000_000, critic_stars=[], age_days=5)
        small = di.reviewer_score(reviewer_count=2, total_views=10_000, critic_stars=[], age_days=5)
        self.assertGreater(big, small)

    def test_critic_stars_add_signal(self):
        with_stars = di.reviewer_score(reviewer_count=2, total_views=100_000, critic_stars=[4.0], age_days=5)
        without = di.reviewer_score(reviewer_count=2, total_views=100_000, critic_stars=[], age_days=5)
        self.assertGreater(with_stars, without)

    def test_older_reviews_decay(self):
        fresh = di.reviewer_score(reviewer_count=2, total_views=100_000, critic_stars=[], age_days=1)
        stale = di.reviewer_score(reviewer_count=2, total_views=100_000, critic_stars=[], age_days=180)
        self.assertGreater(fresh, stale)

    def test_zero_views_does_not_crash(self):
        self.assertIsInstance(di.reviewer_score(1, 0, [], 1), float)


class TestAggregate(unittest.TestCase):
    def test_groups_by_normalised_title_and_counts_distinct_reviewers(self):
        reviews = [
            {"reviewer": "@a", "film": "I'M GAME", "filmKey": di.normalize_title("I'M GAME"),
             "views": 100, "ageDays": 1, "url": "u1"},
            {"reviewer": "@b", "film": "i'm game", "filmKey": di.normalize_title("i'm game"),
             "views": 200, "ageDays": 2, "url": "u2"},
            {"reviewer": "@a", "film": "I'M GAME", "filmKey": di.normalize_title("I'M GAME"),
             "views": 50, "ageDays": 3, "url": "u3"},
        ]
        films = di.aggregate(reviews, [])
        self.assertEqual(len(films), 1)
        self.assertEqual(films[0]["reviewerCount"], 2)   # distinct reviewers, not review count
        self.assertEqual(films[0]["totalViews"], 350)

    def test_sorted_by_score_descending(self):
        reviews = [
            {"reviewer": "@a", "film": "Solo", "filmKey": "solo", "views": 10, "ageDays": 1, "url": "u"},
            {"reviewer": "@a", "film": "Popular", "filmKey": "popular", "views": 10, "ageDays": 1, "url": "u"},
            {"reviewer": "@b", "film": "Popular", "filmKey": "popular", "views": 10, "ageDays": 1, "url": "u"},
        ]
        films = di.aggregate(reviews, [])
        self.assertEqual(films[0]["film"], "Popular")

    def test_min_reviewers_filter(self):
        reviews = [{"reviewer": "@a", "film": "Solo", "filmKey": "solo",
                    "views": 10, "ageDays": 1, "url": "u"}]
        self.assertEqual(len(di.aggregate(reviews, [], min_reviewers=2)), 0)


class TestEnrichmentIsOptional(unittest.TestCase):
    def test_film_survives_total_enrichment_failure(self):
        original_post = di._imdb_post
        di._imdb_post = lambda payload: None
        try:
            film = di.enrich_film({"film": "Ghost Title", "filmKey": "ghosttitle"})
        finally:
            di._imdb_post = original_post
        self.assertEqual(film["film"], "Ghost Title")   # still returned
        self.assertIsNone(film["imdbId"])
        self.assertIsNone(film["letterboxdRating"])
        self.assertEqual(film["platform"], "Other")


class TestCriticSites(unittest.TestCase):
    def test_all_four_languages_are_servable(self):
        for lang in ("Tamil", "Telugu", "Malayalam", "Hindi"):
            self.assertIn(lang, di.LANGUAGE_KEYWORDS)

    def test_telugu_and_hindi_have_dedicated_outlets(self):
        defaults = {c["default_language"] for c in di.CRITIC_SITES.values()}
        self.assertIn("Telugu", defaults)
        self.assertIn("Hindi", defaults)

    def test_every_site_declares_required_keys(self):
        for name, cfg in di.CRITIC_SITES.items():
            for key in ("template", "link_pattern", "max_pages", "tier", "rating"):
                self.assertIn(key, cfg, f"{name} missing {key}")

    def test_window_presets(self):
        self.assertEqual(di.WINDOW_PRESETS["3m"], 90)
        self.assertEqual(di.WINDOW_PRESETS["6m"], 180)


class TestReviewRating(unittest.TestCase):
    def test_jsonld_review_rating(self):
        html = '<script type="application/ld+json">{"@type":"Review","reviewRating":{"ratingValue":"3.5"}}</script>'
        self.assertEqual(di.extract_review_rating(html), 3.5)

    def test_json_rating_key(self):
        self.assertEqual(di.extract_review_rating('{"rating": 4.0, "x": 1}'), 4.0)

    def test_text_rating_near_the_word_rating(self):
        self.assertEqual(di.extract_review_rating("<p>Rating: 2.75/5</p>"), 2.75)

    def test_ignores_css_false_positive(self):
        # THE bug that reported 1.0 for every Cinema Express article.
        css = "<style>.hero{grid-column:1/5}.x{grid-row:2/5}</style>"
        self.assertIsNone(di.extract_review_rating(css))

    def test_rejects_out_of_range(self):
        self.assertIsNone(di.extract_review_rating('{"rating": 7.5}'))

    def test_returns_none_when_absent(self):
        self.assertIsNone(di.extract_review_rating("<p>No score here at all.</p>"))


class TestLanguageDetection(unittest.TestCase):
    def test_from_url_path(self):
        self.assertEqual(
            di.detect_language("https://www.cinemaexpress.com/tamil/review/2026/Aug/07/dc-movie-review", "", None),
            "Tamil",
        )

    def test_from_headline(self):
        self.assertEqual(di.detect_language("https://x/y", "Telugu movie review: Ramba", None), "Telugu")

    def test_outlet_default_is_the_fallback(self):
        self.assertEqual(di.detect_language("https://x/y", "Some Film Review", "Hindi"), "Hindi")

    def test_url_beats_outlet_default(self):
        self.assertEqual(
            di.detect_language("https://www.cinemaexpress.com/malayalam/review/x", "", "Hindi"),
            "Malayalam",
        )

    def test_unknown_is_none_not_a_guess(self):
        self.assertIsNone(di.detect_language("https://x/y", "A Film Review", None))


class TestScrapeCriticSite(unittest.TestCase):
    def test_stops_when_pagination_repeats(self):
        calls = []
        original = di._fetch
        di._fetch = lambda url, **kw: (calls.append(url), '<a href="https://x/same-review">x</a>')[1]
        try:
            di.scrape_critic_site("T", {
                "template": "https://x/page/{page}/",
                "link_pattern": r'href="(https://x/[^"]+)"',
                "max_pages": 9, "tier": "A", "rating": "jsonld", "default_language": None,
            }, window_days=90)
        finally:
            di._fetch = original
        self.assertLess(len(calls), 9)   # bailed out early

    def test_article_date_from_url_when_metadata_absent(self):
        self.assertEqual(
            di._article_date("", "https://www.cinemaexpress.com/tamil/review/2026/Aug/07/dc-movie-review"),
            "2026-08-07",
        )

    def test_article_date_prefers_metadata(self):
        self.assertEqual(di._article_date('"datePublished":"2026-01-15T10:00"', "https://x/2020/Jan/01/y"), "2026-01-15")


class TestCriticScore(unittest.TestCase):
    def test_higher_stars_rank_higher(self):
        good = di.critic_score(4.5, 2, 0, 10)
        bad = di.critic_score(1.5, 2, 0, 10)
        self.assertGreater(good, bad)

    def test_more_critics_breaks_ties(self):
        many = di.critic_score(3.5, 4, 0, 10)
        few = di.critic_score(3.5, 1, 0, 10)
        self.assertGreater(many, few)

    def test_youtube_is_a_bonus_not_a_requirement(self):
        with_yt = di.critic_score(3.5, 2, 3, 10)
        without = di.critic_score(3.5, 2, 0, 10)
        self.assertGreater(with_yt, without)
        self.assertIsInstance(without, float)

    def test_unrated_film_still_scores_on_coverage(self):
        # Cinema Express has no stars -- such films must not score None.
        self.assertIsInstance(di.critic_score(None, 3, 0, 10), float)

    def test_rated_beats_unrated_at_equal_coverage(self):
        self.assertGreater(di.critic_score(4.0, 2, 0, 5), di.critic_score(None, 2, 0, 5))

    def test_recency_decay(self):
        self.assertGreater(di.critic_score(4.0, 2, 0, 1), di.critic_score(4.0, 2, 0, 200))
