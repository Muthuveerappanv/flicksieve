import requests
from bs4 import BeautifulSoup
import urllib.parse
import json

def fetch_rottentomatoes_score(query, year=None, is_tv=False):
    headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
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
    
    # Try to find matching row
    best_row = None
    for row in rows:
        a_tag = row.find('a', slot='title')
        if not a_tag:
            continue
        row_title = a_tag.text.strip().lower()
        
        # Get year
        row_year = None
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
        # Fallback to first row if exact match not found
        best_row = rows[0]
        
    if not best_row:
        return {"error": "No matching row found"}
        
    # Extract score
    score_attr = best_row.get('tomatometer-score') or best_row.get('tomatometerscore')
    a_tag = best_row.find('a', slot='title')
    title = a_tag.text.strip() if a_tag else query
    href = a_tag.get('href') if a_tag else ''
    
    # Get year
    row_year = None
    if is_tv:
        row_year = best_row.get('startyear') or best_row.get('start-year')
    else:
        row_year = best_row.get('release-year') or best_row.get('releaseyear')
        
    return {
        "title": title,
        "year": row_year,
        "score": int(score_attr) if score_attr and score_attr.strip() else None,
        "url": href
    }

if __name__ == "__main__":
    print("Top Gun:", fetch_rottentomatoes_score("Top Gun", 1986))
    print("Top Gun Maverick:", fetch_rottentomatoes_score("Top Gun: Maverick", 2022))
    print("Ustaad Bhagat Singh:", fetch_rottentomatoes_score("Ustaad Bhagat Singh", 2026))
