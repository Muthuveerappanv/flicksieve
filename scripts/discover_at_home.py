import sys
import json
import base64
import time
import re
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta

import requests

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json',
}

MOVIE_BASE_URL = "https://www.rottentomatoes.com/cnapi/browse/movies_at_home/sort:newest"
TV_BASE_URL = "https://www.rottentomatoes.com/cnapi/browse/tv_series_browse/sort:newest"

PAGE_SIZE = 30
WORKERS = 3
MAX_OFFSET = 3000


def _score_int(score_obj):
    """RT returns {'scorePercent': '94%'} or {'scorePercent': ''} when there is no score."""
    if not isinstance(score_obj, dict):
        return None
    raw = (score_obj.get('scorePercent') or '').strip().rstrip('%')
    if not raw:
        return None
    try:
        return int(raw)
    except ValueError:
        return None


def _parse_streaming_date(text, default_year=2026):
    """'Streaming Aug 18, 2026' or 'Latest Episode: Sep 05' -> datetime, or None if it doesn't parse."""
    if not text:
        return None
    cleaned = re.sub(r'^(Latest Episode:|Streaming|Premiere:)\s*', '', text, flags=re.I).strip()
    try:
        return datetime.strptime(cleaned, "%b %d, %Y")
    except ValueError:
        pass
    try:
        return datetime.strptime(f"{cleaned}, {default_year}", "%b %d, %Y")
    except ValueError:
        pass
    return None


def _fetch_page(session, base_url, offset):
    """Fetch one page by numeric offset."""
    url = base_url
    if offset:
        url += "?after=" + base64.b64encode(str(offset).encode()).decode()
    for attempt in range(2):
        try:
            res = session.get(url, headers=HEADERS, timeout=12)
            res.raise_for_status()
            return res.json().get('grid', {}).get('list', []) or []
        except Exception:
            if attempt == 1:
                return None
            time.sleep(1.0)
    return None


def discover_at_home(days=90, min_audience=70, sort_by='audience', media_type='movie'):
    try:
        is_tv = str(media_type).lower() in ('tv', 'tvseries', 'series')
        base_url = TV_BASE_URL if is_tv else MOVIE_BASE_URL
        
        cutoff = datetime.now() - timedelta(days=days)
        results = []
        seen_urls = set()
        pages = 0
        failed_pages = 0
        offset = 0
        done = False

        session = requests.Session()
        with ThreadPoolExecutor(max_workers=WORKERS) as pool:
            while offset < MAX_OFFSET and not done:
                batch = [offset + i * PAGE_SIZE for i in range(WORKERS)]
                page_lists = list(pool.map(lambda o: _fetch_page(session, base_url, o), batch))

                if all(p is None for p in page_lists):
                    if pages == 0:
                        return {'error': 'Rotten Tomatoes is rate-limiting requests right now. Try again in a few minutes.'}
                    failed_pages += len(page_lists)
                    break

                for items in page_lists:
                    if items is None:
                        failed_pages += 1
                        continue
                    if not items:
                        done = True
                        continue
                    pages += 1

                    oldest_on_page = None
                    for item in items:
                        dt = _parse_streaming_date(item.get('releaseDateText'))
                        if dt is None:
                            continue
                        if oldest_on_page is None or dt < oldest_on_page:
                            oldest_on_page = dt
                        if dt < cutoff:
                            continue

                        item_type = str(item.get('type') or '')
                        if is_tv:
                            if item_type.lower() not in ('tvseries', 'tv', 'series'):
                                continue
                        else:
                            if item_type.lower() != 'movie':
                                continue

                        audience = _score_int(item.get('audienceScore'))
                        if audience is None or audience < min_audience:
                            continue

                        media_url = item.get('mediaUrl') or ''
                        full_url = ("https://www.rottentomatoes.com" + media_url) if media_url.startswith('/') else media_url
                        if full_url in seen_urls:
                            continue
                        seen_urls.add(full_url)

                        results.append({
                            'title': item.get('title'),
                            'type': 'tv' if is_tv else 'movie',
                            'audienceScore': audience,
                            'criticScore': _score_int(item.get('criticsScore')),
                            'streamingDate': dt.strftime('%Y-%m-%d'),
                            'url': full_url,
                            'posterUrl': item.get('posterUri'),
                            'emsId': item.get('emsId'),
                        })

                    if oldest_on_page is not None and oldest_on_page < cutoff:
                        done = True

                offset += WORKERS * PAGE_SIZE
                if not done:
                    time.sleep(0.2)

        if sort_by == 'date':
            results.sort(
                key=lambda m: (m['streamingDate'], m['audienceScore']),
                reverse=True,
            )
        else:
            results.sort(
                key=lambda m: (m['audienceScore'], m['criticScore'] or -1, m['streamingDate']),
                reverse=True,
            )

        return {
            'count': len(results),
            'windowDays': days,
            'minAudience': min_audience,
            'mediaType': 'tv' if is_tv else 'movie',
            'sortBy': 'date' if sort_by == 'date' else 'audience',
            'pagesCrawled': pages,
            'failedPages': failed_pages,
            'movies': results,
            'shows': results,
        }
    except Exception as e:
        return {'error': str(e)}


if __name__ == "__main__":
    days_arg = sys.argv[1] if len(sys.argv) > 1 and sys.argv[1] not in ('', 'None') else None
    min_arg = sys.argv[2] if len(sys.argv) > 2 and sys.argv[2] not in ('', 'None') else None
    sort_arg = sys.argv[3] if len(sys.argv) > 3 and sys.argv[3] not in ('', 'None') else None
    media_arg = sys.argv[4] if len(sys.argv) > 4 and sys.argv[4] not in ('', 'None') else 'movie'

    try:
        days = int(days_arg) if days_arg is not None else 90
        min_audience = int(min_arg) if min_arg is not None else 70
    except ValueError:
        print(json.dumps({'error': 'usage: discover_at_home.py [days] [min_audience] [audience|date] [movie|tv]'}))
        sys.exit(1)

    sort_by = 'date' if (sort_arg or '').lower() == 'date' else 'audience'

    print(json.dumps(discover_at_home(days=days, min_audience=min_audience, sort_by=sort_by, media_type=media_arg)))
