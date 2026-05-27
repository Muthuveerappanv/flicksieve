import re
import sys
import json
from bs4 import BeautifulSoup
from curl_cffi import requests

def scrape_91mobiles():
    try:
        url = "https://www.91mobiles.com/entertainment/ott-release-this-week"
        r = requests.get(url, impersonate="chrome")
        if r.status_code != 200:
            return {"error": f"Failed to fetch page, status: {r.status_code}"}
            
        soup = BeautifulSoup(r.text, "html.parser")
        h3s = soup.find_all("h3")
        
        months = {
            "jan": "01", "feb": "02", "mar": "03", "apr": "04", "may": "05", "jun": "06",
            "jul": "07", "aug": "08", "sep": "09", "oct": "10", "nov": "11", "dec": "12"
        }

        def parse_date(date_str):
            match = re.search(r"(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})", date_str)
            if match:
                day, month, year = match.groups()
                month_num = months.get(month.lower()[:3], "01")
                return f"{year}-{month_num}-{int(day):02d}"
            return None

        shows = []
        for h3 in h3s:
            title_raw = h3.get_text(strip=True)
            title = re.sub(r"\([A-Z0-9-+\s\/]+\)$", "", title_raw).strip()
            
            # Skip empty or non-movie headings
            if not title:
                continue
                
            sibling1 = h3.find_next_sibling("div")
            if not sibling1:
                continue
            
            sib1_text = sibling1.get_text(strip=True)
            if "|" not in sib1_text and "May" not in sib1_text and "June" not in sib1_text and "July" not in sib1_text:
                continue
                
            sibling2 = sibling1.find_next_sibling("div")
            sib2_text = sibling2.get_text(strip=True) if sibling2 else ""
            
            # Parse Sibling 1
            imdb_rating = None
            imdb_match = re.search(r"IMDb\s*(\d+(\.\d+)?)", sib1_text)
            if imdb_match:
                imdb_rating = float(imdb_match.group(1))
                
            parts = sib1_text.split("|")
            lang_part = parts[0]
            if imdb_match:
                lang_part = lang_part.replace(imdb_match.group(0), "")
            lang = lang_part.strip()
            
            release_date = None
            if len(parts) > 1:
                release_date = parse_date(parts[1])
            else:
                release_date = parse_date(parts[0])
                
            # Parse Sibling 2
            genres = ["Drama"]
            genres_match = re.search(r"Genres\s*(.*?)(Where To Stream|$)", sib2_text)
            if genres_match:
                genres_str = genres_match.group(1)
                genres = [g.strip() for g in genres_str.split(",") if g.strip()]
                
            platform = "Other"
            platform_match = re.search(r"Where To Stream\s*(.*)$", sib2_text)
            if platform_match:
                plat_str = platform_match.group(1)
                plats = [p.strip() for p in plat_str.split(",") if p.strip()]
                if plats:
                    platform = plats[0]
                    if "JioHotstar" in platform:
                        platform = "JioCinema"
                    elif "Google Play" in platform or "YouTube" in platform:
                        platform = "Rent"
            
            # Type detection
            show_type = "movie"
            if "season" in title.lower() or "series" in title.lower() or "tv-" in title_raw.lower():
                show_type = "tv"
                
            shows.append({
                "title": title,
                "type": show_type,
                "language": lang,
                "releaseDate": release_date,
                "genres": genres,
                "platform": platform,
                "ratings": {
                    "imdb": imdb_rating,
                    "rottenTomatoes": None,
                    "letterboxd": None
                }
            })
            
        return {"shows": shows}
        
    except Exception as e:
        return {"error": str(e)}

if __name__ == "__main__":
    result = scrape_91mobiles()
    print(json.dumps(result))
