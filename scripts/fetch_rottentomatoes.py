import sys
import json
import urllib.parse
import requests
from bs4 import BeautifulSoup

def fetch_rottentomatoes_score(query, year=None, is_tv=False):
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
        
        # 1. Search Rotten Tomatoes
        url = f"https://www.rottentomatoes.com/search?search={urllib.parse.quote(query)}"
        res = requests.get(url, headers=headers)
        if res.status_code != 200:
            return {"error": f"Failed to search Rotten Tomatoes (status {res.status_code})"}
            
        soup = BeautifulSoup(res.text, 'html.parser')
        group_type = "tvSeries" if is_tv else "movie"
        group = soup.find('search-page-result', type=group_type)
        if not group:
            return {"error": f"No {group_type} group found in search results"}
            
        rows = group.find_all('search-page-media-row')
        
        best_row = None
        for row in rows:
            a_tag = row.find('a', slot='title')
            if not a_tag:
                continue
            row_title = a_tag.text.strip().lower()
            
            # Get year
            if is_tv:
                row_year = row.get('startyear') or row.get('start-year')
            else:
                row_year = row.get('release-year') or row.get('releaseyear')
                
            # Match title
            if row_title == query.lower():
                if not year or not row_year or str(year) in str(row_year) or str(row_year) in str(year):
                    best_row = row
                    break
                    
        if not best_row and rows:
            best_row = rows[0]
            
        if not best_row:
            return {"error": "No matching row found"}
            
        # Extract initial search data
        score_attr = best_row.get('tomatometer-score') or best_row.get('tomatometerscore')
        critic_score = int(score_attr) if score_attr and score_attr.strip() else None
        audience_score = None
        
        a_tag = best_row.find('a', slot='title')
        title = a_tag.text.strip() if a_tag else query
        href = a_tag.get('href') if a_tag else ''
        
        # Determine year
        if is_tv:
            row_year = best_row.get('startyear') or best_row.get('start-year')
        else:
            row_year = best_row.get('release-year') or best_row.get('releaseyear')
            
        # 2. Try to fetch the detail page to get both critic and audience scores
        if href:
            detail_url = href
            if detail_url.startswith('/'):
                detail_url = "https://www.rottentomatoes.com" + detail_url
                
            try:
                detail_res = requests.get(detail_url, headers=headers, timeout=5)
                if detail_res.status_code == 200:
                    detail_soup = BeautifulSoup(detail_res.text, 'html.parser')
                    script_tag = detail_soup.find('script', id='media-scorecard-json', type='application/json')
                    if script_tag:
                        data = json.loads(script_tag.string)
                        # Extract critic score
                        critics_data = data.get('criticsScore', {})
                        if critics_data and 'score' in critics_data:
                            cs = critics_data['score']
                            if cs and cs.strip():
                                critic_score = int(cs)
                        # Extract audience score
                        audience_data = data.get('audienceScore', {})
                        if audience_data and 'score' in audience_data:
                            ascore = audience_data['score']
                            if ascore and ascore.strip():
                                audience_score = int(ascore)
            except Exception:
                pass # Fall back to search row values if detail fetch fails
                
        return {
            "title": title,
            "year": row_year,
            "criticScore": critic_score,
            "audienceScore": audience_score,
            "url": href
        }
        
    except Exception as e:
        return {"error": str(e)}

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: fetch_rottentomatoes.py <query> [year] [is_tv]"}))
        sys.exit(1)
        
    q = sys.argv[1]
    y = sys.argv[2] if len(sys.argv) > 2 and sys.argv[2] not in ('', 'None') else None
    tv_flag = sys.argv[3].lower() in ('true', '1', 'tv') if len(sys.argv) > 3 else False
    
    output = fetch_rottentomatoes_score(q, y, tv_flag)
    print(json.dumps(output))
