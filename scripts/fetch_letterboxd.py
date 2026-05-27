import sys
import json
from letterboxdpy.search import Search, SearchFilter
from letterboxdpy.movie import Movie

def fetch_letterboxd(query, year=None, imdb_id=None):
    try:
        # Search for the film
        search_results = Search(query, SearchFilter.FILMS)
        results = search_results.results.get('results', [])
        
        best_slug = None
        
        # 1. Try to find a match by comparing imdb_id (requires fetching each candidate, so we limit to top 3)
        # 2. Try to find a match by comparing title + year
        # 3. Fallback to the first result
        
        if not results:
            return {"error": "No results found on Letterboxd"}
        
        # Try to find title & year match
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
        
        # Fallback to the first result slug
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
        print(json.dumps({"error": "Usage: fetch_letterboxd.py <query> [year] [imdb_id]"}))
        sys.exit(1)
        
    q = sys.argv[1]
    y = sys.argv[2] if len(sys.argv) > 2 and sys.argv[2] not in ('', 'None') else None
    i_id = sys.argv[3] if len(sys.argv) > 3 and sys.argv[3] not in ('', 'None') else None
    
    output = fetch_letterboxd(q, y, i_id)
    print(json.dumps(output))
