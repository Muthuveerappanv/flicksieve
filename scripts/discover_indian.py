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


def _fetch(url, timeout=30, retries=3):
    for attempt in range(retries):
        try:
            r = creq.get(url, impersonate=IMPERSONATE, timeout=timeout, headers=REQUEST_HEADERS)
            if r.status_code == 200:
                return r.text
        except Exception:
            pass
        if attempt < retries - 1:
            time.sleep(0.8 * (attempt + 1))
    return None


def extract_initial_data(html):
    """Pull ytInitialData out of the page.

    It is NOT in <script id="yt-initial-data"> and NOT in `var ytInitialData =`.
    YouTube assigns it inside an anonymous nonce script, so locate the
    assignment and brace-match to the closing bracket. Regex-to-`;</script>`
    returns nothing.
    """
    if not html:
        return None
    for m in re.finditer(r"ytInitialData['\"]?\]?\s*=\s*(\{)", html):
        start = m.start(1)
        depth, i, in_str, esc = 0, start, False, False
        while i < len(html):
            c = html[i]
            if in_str:
                if esc:
                    esc = False
                elif c == "\\":
                    esc = True
                elif c == '"':
                    in_str = False
            else:
                if c == '"':
                    in_str = True
                elif c == "{":
                    depth += 1
                elif c == "}":
                    depth -= 1
                    if depth == 0:
                        try:
                            return json.loads(html[start:i + 1])
                        except Exception:
                            break
            i += 1
    return None


def harvest_videos(node, out=None):
    """Collect videos from BOTH renderer formats.

    Channel pages now use `lockupViewModel`; `videoRenderer` is the legacy
    shape still seen elsewhere. Handle both or you get zero results.
    """
    if out is None:
        out = []
    if isinstance(node, dict):
        lockup = node.get("lockupViewModel")
        if isinstance(lockup, dict):
            video_id = lockup.get("contentId")
            meta = (lockup.get("metadata") or {}).get("lockupMetadataViewModel") or {}
            title = (meta.get("title") or {}).get("content")
            rows = []
            content_meta = (meta.get("metadata") or {}).get("contentMetadataViewModel") or {}
            for row in content_meta.get("metadataRows", []):
                for part in row.get("metadataParts", []):
                    text = (part.get("text") or {}).get("content")
                    if text:
                        rows.append(text)
            if video_id and title:
                out.append({"videoId": video_id, "title": title, "meta": rows})

        legacy = node.get("videoRenderer")
        if isinstance(legacy, dict):
            video_id = legacy.get("videoId")
            title_obj = legacy.get("title") or {}
            title = "".join(r.get("text", "") for r in title_obj.get("runs", [])) or title_obj.get("simpleText")
            if video_id and title:
                rows = [
                    (legacy.get("viewCountText") or {}).get("simpleText"),
                    (legacy.get("publishedTimeText") or {}).get("simpleText"),
                ]
                out.append({"videoId": video_id, "title": title, "meta": [r for r in rows if r]})

        for value in node.values():
            harvest_videos(value, out)
    elif isinstance(node, list):
        for value in node:
            harvest_videos(value, out)
    return out


def scrape_channel(handle, max_age_days=60):
    """Return review videos for one channel. Never raises."""
    html = _fetch(f"https://www.youtube.com/{handle}/videos")
    data = extract_initial_data(html)
    if not data:
        return []

    reviews, seen = [], set()
    for video in harvest_videos(data):
        if video["videoId"] in seen:
            continue
        seen.add(video["videoId"])

        film = film_title_from_review(video["title"])
        if not film:
            continue

        meta_text = " | ".join(video["meta"])
        age_days = parse_relative_date(meta_text)
        if age_days is not None and age_days > max_age_days:
            continue

        reviews.append({
            "reviewer": handle,
            "film": film,
            "filmKey": normalize_title(film),
            "videoId": video["videoId"],
            "videoTitle": video["title"],
            "url": f"https://www.youtube.com/watch?v={video['videoId']}",
            "views": parse_view_count(meta_text),
            "ageDays": age_days,
        })
    return reviews
