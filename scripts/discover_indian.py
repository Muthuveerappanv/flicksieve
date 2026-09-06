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


def _feed_items(xml):
    items = []
    for block in re.findall(r"<item>(.*?)</item>", xml or "", re.S):
        title = re.search(r"<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?</title>", block, re.S)
        link = re.search(r"<link>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?</link>", block, re.S)
        if title and link:
            items.append((title.group(1).strip(), link.group(1).strip()))
    return items


def extract_star_rating(html):
    """Pull a 0-5 critic rating from an article. JSON-LD first, text second.

    Values above 5 are rejected: a live text-pattern false positive returned
    7 from unrelated copy.
    """
    if not html:
        return None
    for m in re.finditer(r'<script[^>]*type="application/ld\+json"[^>]*>(.*?)</script>', html, re.S):
        for candidate in re.findall(r'"ratingValue"\s*:\s*"?([\d.]+)"?', m.group(1)):
            try:
                value = float(candidate)
            except ValueError:
                continue
            if 0 < value <= 5:
                return value
    m = re.search(r"(\d(?:\.\d)?)\s*(?:out of\s*5|/\s*5)", html, re.I)
    if m:
        value = float(m.group(1))
        if 0 < value <= 5:
            return value
    return None


def scrape_critics(max_articles=12):
    """Return critic reviews across all feeds. Never raises."""
    found = []
    for outlet, url in CRITIC_FEEDS.items():
        xml = _fetch(url)
        if not xml:
            continue
        for headline, link in _feed_items(xml):
            film = film_title_from_review(headline)
            if not film:
                continue
            found.append({"reviewer": outlet, "film": film, "filmKey": normalize_title(film),
                          "url": link, "headline": headline, "stars": None})

    def add_stars(entry):
        entry["stars"] = extract_star_rating(_fetch(entry["url"], timeout=20, retries=1))
        return entry

    subset = found[:max_articles]
    with ThreadPoolExecutor(max_workers=5) as pool:
        subset = list(pool.map(add_stars, subset))
    return subset + found[max_articles:]


def reviewer_score(reviewer_count, total_views, critic_stars, age_days):
    """Rank by trusted-reviewer consensus. Crowd ratings deliberately absent."""
    reach = math.log10(total_views + 1) if total_views else 0.0
    score = W_REVIEWER * reviewer_count + W_REACH * reach
    if critic_stars:
        score += W_CRITIC * (sum(critic_stars) / len(critic_stars)) * 2
    if age_days:
        score -= W_RECENCY * (age_days / 30.0)
    return round(score, 3)


def aggregate(youtube_reviews, critic_reviews, min_reviewers=1):
    """Group reviews by film and rank by reviewer consensus."""
    films = {}
    for review in youtube_reviews:
        key = review["filmKey"]
        if not key:
            continue
        entry = films.setdefault(key, {
            "film": review["film"], "filmKey": key,
            "reviewers": {}, "criticReviews": [], "totalViews": 0, "ages": [],
        })
        entry["reviewers"].setdefault(review["reviewer"], []).append({
            "url": review["url"], "views": review.get("views"),
            "videoTitle": review.get("videoTitle"),
        })
        entry["totalViews"] += review.get("views") or 0
        if review.get("ageDays") is not None:
            entry["ages"].append(review["ageDays"])

    for review in critic_reviews:
        key = review["filmKey"]
        if key in films:
            films[key]["criticReviews"].append(review)

    results = []
    for entry in films.values():
        if len(entry["reviewers"]) < min_reviewers:
            continue
        stars = [c["stars"] for c in entry["criticReviews"] if c.get("stars")]
        age = min(entry["ages"]) if entry["ages"] else None
        results.append({
            "film": entry["film"],
            "filmKey": entry["filmKey"],
            "reviewerCount": len(entry["reviewers"]),
            "reviewers": [
                {"handle": handle, "reviews": items}
                for handle, items in entry["reviewers"].items()
            ],
            "criticReviews": entry["criticReviews"],
            "criticStars": round(sum(stars) / len(stars), 2) if stars else None,
            "totalViews": entry["totalViews"],
            "ageDays": age,
            "score": reviewer_score(len(entry["reviewers"]), entry["totalViews"], stars, age),
        })

    results.sort(key=lambda r: -r["score"])
    return results


IMDB_GQL_URL = "https://caching.graphql.imdb.com/"
IMDB_HEADERS = {
    "content-type": "application/json",
    "x-imdb-client-name": "imdb-web-next-localized",
}

IMDB_SEARCH = """
query Find($q:String!){
  mainSearch(first:3, options:{searchTerm:$q, type:TITLE}){
    edges{ node{ entity{ ... on Title {
      id titleText{text} releaseYear{year}
      titleType{id}
      primaryImage{url}
      plot{plotText{plainText}}
      ratingsSummary{aggregateRating voteCount}
      titleGenres{genres{genre{text}}}
      spokenLanguages{spokenLanguages{id text}}
    } } } }
  }
}
"""


def _imdb_post(payload):
    try:
        r = creq.post(IMDB_GQL_URL, json=payload, headers=IMDB_HEADERS,
                      impersonate=IMPERSONATE, timeout=25)
        data = r.json()
        return None if "errors" in data else data.get("data")
    except Exception:
        return None


def enrich_film(film):
    """Attach IMDb/Letterboxd/JustWatch metadata. Always returns the film."""
    film.setdefault("imdbId", None)
    film.setdefault("year", None)
    film.setdefault("posterUrl", None)
    film.setdefault("genres", [])
    film.setdefault("language", None)
    film.setdefault("overview", "")
    film.setdefault("imdbRating", None)
    film.setdefault("letterboxdRating", None)
    film.setdefault("platform", "Other")
    film.setdefault("providers", [])

    data = _imdb_post({"query": IMDB_SEARCH, "variables": {"q": film["film"]}})
    if data:
        for edge in (data.get("mainSearch") or {}).get("edges", []):
            entity = (edge.get("node") or {}).get("entity") or {}
            if not entity.get("id"):
                continue
            if normalize_title((entity.get("titleText") or {}).get("text")) != film["filmKey"]:
                continue
            film["imdbId"] = entity["id"]
            film["year"] = (entity.get("releaseYear") or {}).get("year")
            film["posterUrl"] = (entity.get("primaryImage") or {}).get("url")
            film["overview"] = ((entity.get("plot") or {}).get("plotText") or {}).get("plainText") or ""
            film["imdbRating"] = (entity.get("ratingsSummary") or {}).get("aggregateRating")
            film["genres"] = [g["genre"]["text"] for g in (entity.get("titleGenres") or {}).get("genres", [])]
            langs = (entity.get("spokenLanguages") or {}).get("spokenLanguages") or []
            film["language"] = langs[0]["text"] if langs else None
            break

    try:
        from letterboxdpy.movie import Movie
        from letterboxdpy.search import Search, SearchFilter
        for result in Search(film["film"], SearchFilter.FILMS).results.get("results", [])[:3]:
            if normalize_title(result.get("title")) == film["filmKey"]:
                film["letterboxdRating"] = getattr(Movie(result["slug"]), "rating", None)
                break
    except Exception:
        pass

    return film


def enrich_all(films, workers=5):
    with ThreadPoolExecutor(max_workers=workers) as pool:
        return list(pool.map(enrich_film, films))


def load_handles():
    """Read trusted YouTube handles from the user's reviewers.json."""
    import os
    path = os.path.join(os.path.dirname(__file__), "..", "src", "data", "reviewers.json")
    try:
        with open(path, encoding="utf-8") as fh:
            return [r["youtubeHandle"] for r in json.load(fh)
                    if r.get("youtubeHandle") and r.get("trusted", True)]
    except Exception:
        return ["@TamilTalkies", "@Filmicraft", "@unnivlogs"]


def discover(handles=None, max_age_days=60, min_reviewers=1, enrich=True):
    handles = handles or load_handles()
    youtube_reviews, failed = [], []

    with ThreadPoolExecutor(max_workers=4) as pool:
        for handle, reviews in zip(handles, pool.map(
                lambda h: scrape_channel(h, max_age_days), handles)):
            if reviews:
                youtube_reviews.extend(reviews)
            else:
                failed.append(handle)

    try:
        critic_reviews = scrape_critics()
    except Exception:
        critic_reviews = []

    films = aggregate(youtube_reviews, critic_reviews, min_reviewers=min_reviewers)
    if enrich:
        films = enrich_all(films)

    return {
        "count": len(films),
        "reviewersUsed": handles,
        "failedReviewers": failed,
        "youtubeReviewCount": len(youtube_reviews),
        "criticReviewCount": len(critic_reviews),
        "maxAgeDays": max_age_days,
        "films": films,
    }


def _arg(index, default):
    if len(sys.argv) > index and sys.argv[index] not in ("", "None"):
        return sys.argv[index]
    return default


if __name__ == "__main__":
    try:
        raw = _arg(1, "")
        payload = discover(
            handles=[h.strip() for h in raw.split(",") if h.strip()] or None,
            max_age_days=int(_arg(2, "60")),
            min_reviewers=int(_arg(3, "1")),
        )
        print(json.dumps(payload))
    except Exception as exc:  # noqa: BLE001 - always emit JSON
        print(json.dumps({"error": str(exc)}))
        sys.exit(1)
