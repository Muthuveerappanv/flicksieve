"""Discover Indian films from the reviewers the user trusts.

Ranking is driven by REVIEWER CONSENSUS -- how many trusted critics chose to
review a film -- not by crowd rating aggregates. IMDb and Letterboxd scores
are fetched for display only and never filter or rank results, because a
measured 38% of films covered by trusted reviewers have no Letterboxd entry
at all.

Usage:
    discover_indian.py [handles] [max_age_days] [min_reviewers]

    handles        comma-separated YouTube handles (default: from reviewers.json)
    max_age_days   only reviews newer than this (default: 60)
    min_reviewers  minimum distinct reviewers per film (default: 1)

Prints a single JSON object on stdout.
"""
import json
import math
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor

from curl_cffi import requests as creq

# Plain urllib FAILS to resolve YouTube handles; browser TLS impersonation is required.
IMPERSONATE = "chrome"
REQUEST_HEADERS = {"Accept-Language": "en-US,en;q=0.9"}

CRITIC_FEEDS = {
    "The Hindu": "https://www.thehindu.com/entertainment/movies/feeder/default.rss",
    "Indian Express": "https://indianexpress.com/section/entertainment/feed/",
    "Hindustan Times": "https://www.hindustantimes.com/feeds/rss/entertainment/rssfeed.xml",
    "NDTV": "https://feeds.feedburner.com/ndtvmovies-latest",
}

REVIEW_WORD = re.compile(r"\breview\b", re.I)

# Weights: reviewer count dominates by design.
W_REVIEWER = 3.0
W_REACH = 1.0
W_CRITIC = 0.5
W_RECENCY = 0.5
