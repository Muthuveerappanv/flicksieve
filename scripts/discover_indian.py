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


# Qualifiers that sit between the film name and the word "review".
_QUALIFIER = r"(?:Malayalam\s+|Tamil\s+|Telugu\s+|Hindi\s+|Kannada\s+)?(?:Version\s+)?(?:Movie\s+|Film\s+|Web\s+Series\s+|Series\s+)?"


def film_title_from_review(video_title):
    """'IMMORTAL Review - GV Prakash' -> 'IMMORTAL'. None if not a review."""
    if not video_title or not REVIEW_WORD.search(video_title):
        return None
    head = re.split(rf"\s*{_QUALIFIER}Review\b", video_title, maxsplit=1, flags=re.I)[0]
    head = head.strip(" -|:\u2013\u2014")
    return head or None


def normalize_title(title):
    """Join key: casing, punctuation and '&'/'and' differences collapse."""
    if not title:
        return ""
    text = title.lower().replace("&", " and ")
    return re.sub(r"[^a-z0-9]", "", text)


_UNIT_DAYS = {"day": 1, "week": 7, "month": 30, "year": 365, "hour": 0, "minute": 0, "second": 0}


def parse_view_count(text):
    """'416K views' -> 416000."""
    if not text:
        return None
    m = re.search(r"([\d.]+)\s*([KMB])?\s*views", text, re.I)
    if not m:
        return None
    value = float(m.group(1))
    suffix = (m.group(2) or "").upper()
    return int(value * {"K": 1_000, "M": 1_000_000, "B": 1_000_000_000}.get(suffix, 1))


def parse_relative_date(text):
    """'2 weeks ago' -> 14 (days)."""
    if not text:
        return None
    m = re.search(r"(\d+)\s*(second|minute|hour|day|week|month|year)s?\s+ago", text, re.I)
    if not m:
        return None
    return int(m.group(1)) * _UNIT_DAYS[m.group(2).lower()]
