import sys
import json
from letterboxdpy.search import Search, SearchFilter
from letterboxdpy.movie import Movie

def fetch_letterboxd(query, year=None, imdb_id=None, is_tv=False):
    try:
        # Search for the film
        search_results = Search(query, SearchFilter.FILMS)
        results = search_results.results.get('results', [])
        
        best_slug = None
        
        if not results:
            return {"error": "No results found on Letterboxd"}
        
        # If this is a TV show, Letterboxd generally does not track multi-season shows.
        # Only accept a match if the IMDb ID explicitly matches (e.g. miniseries) or title+year exact match.
        if is_tv:
            matched_slug = None
            if imdb_id:
                for r in results[:5]:
                    slug = r.get('slug')
                    if slug:
                        try:
                            m = Movie(slug)
                            if getattr(m, 'imdb_id', None) == imdb_id:
                                matched_slug = slug
                                break
                        except Exception:
                            pass
            if not matched_slug:
                # Check strict title and year equality
                for r in results[:3]:
                    r_title = r.get('title', '').strip().lower()
                    r_year = r.get('year')
                    if r_title == query.strip().lower() and (not year or str(r_year) == str(year)):
                        matched_slug = r.get('slug')
                        break

            if not matched_slug:
                return {"error": "Letterboxd does not track multi-season TV shows"}
            best_slug = matched_slug
        else:
            # Movie matching logic:
            # 1. Try to find title & year match
            for r in results[:5]:
                r_title = r.get('title', '').strip().lower()
                r_year = r.get('year')
                
                # Check if title matches and year matches (if year is provided)
                if r_title == query.strip().lower():
                    if not year or str(r_year) == str(year):
                        best_slug = r.get('slug')
                        break
            
            # If no exact title+year match, check if any of the top 3 matches the IMDb ID (if provided)
            if not best_slug and imdb_id:
                for r in results[:3]:
                    slug = r.get('slug')
                    if slug:
                        try:
                            m = Movie(slug)
                            if m.imdb_id == imdb_id:
                                best_slug = slug
                                break
                        except Exception:
                            pass
            
            # Fallback to the first result slug only for movies
            if not best_slug:
                best_slug = results[0].get('slug')
            
        if not best_slug:
            return {"error": "Could not find a valid film slug"}
            
        # Fetch the movie details
        m = Movie(best_slug)
        
        res = {
            "title": m.title,
            "year": m.year,
            "rating": m.rating,
            "slug": m.slug,
            "url": m.url,
            "imdb_id": getattr(m, 'imdb_id', None),
            "tmdb_id": getattr(m, 'tmdb_id', None),
            "poster": getattr(m, 'poster', None),
            "banner": getattr(m, 'banner', None),
            "description": getattr(m, 'description', None),
            "genres": getattr(m, 'genres', [])
        }
        return res
        
    except Exception as e:
        return {"error": str(e)}

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: fetch_letterboxd.py <query> [year] [imdb_id] [is_tv]"}))
        sys.exit(1)
        
    q = sys.argv[1]
    y = sys.argv[2] if len(sys.argv) > 2 and sys.argv[2] not in ('', 'None') else None
    i_id = sys.argv[3] if len(sys.argv) > 3 and sys.argv[3] not in ('', 'None') else None
    tv_flag = sys.argv[4].lower() in ('true', '1', 'tv') if len(sys.argv) > 4 else False
    
    output = fetch_letterboxd(q, y, i_id, tv_flag)
    print(json.dumps(output))
