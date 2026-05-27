import requests
from bs4 import BeautifulSoup
import urllib.parse
import json

def fetch_rottentomatoes_both(query, year=None, is_tv=False):
    headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
    
    # 1. Search RT to get the correct detail URL
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
        
    # Get the URL
    a_tag = best_row.find('a', slot='title')
    href = a_tag.get('href') if a_tag else ''
    if not href:
        return {"error": "No URL found for match"}
        
    if href.startswith('/'):
        href = "https://www.rottentomatoes.com" + href
        
    # 2. Fetch the detail page
    detail_res = requests.get(href, headers=headers)
    if detail_res.status_code != 200:
        return {"error": f"Failed to fetch details page (status {detail_res.status_code})"}
        
    detail_soup = BeautifulSoup(detail_res.text, 'html.parser')
    
    # 3. Parse media-scorecard-json script tag
    script_tag = detail_soup.find('script', id='media-scorecard-json', type='application/json')
    critic_score = None
    audience_score = None
    
    if script_tag:
        try:
            data = json.loads(script_tag.string)
            # Extract critic score
            critics_data = data.get('criticsScore', {})
            if critics_data and 'score' in critics_data:
                cs = critics_data['score']
                critic_score = int(cs) if cs and cs.strip() else None
            # Extract audience score
            audience_data = data.get('audienceScore', {})
            if audience_data and 'score' in audience_data:
                ascore = audience_data['score']
                audience_score = int(ascore) if ascore and ascore.strip() else None
        except Exception as e:
            print("Error parsing scorecard JSON:", e)
            
    # Extract year
    row_year = None
    if is_tv:
        row_year = best_row.get('startyear') or best_row.get('start-year')
    else:
        row_year = best_row.get('release-year') or best_row.get('releaseyear')
        
    return {
        "title": a_tag.text.strip() if a_tag else query,
        "year": row_year,
        "criticScore": critic_score,
        "audienceScore": audience_score,
        "url": href
    }

if __name__ == "__main__":
    print("Top Gun Maverick:", fetch_rottentomatoes_both("Top Gun: Maverick", 2022))
    print("Widow's Bay:", fetch_rottentomatoes_both("widow's bay", None, True))
