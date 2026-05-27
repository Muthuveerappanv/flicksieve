import requests
from bs4 import BeautifulSoup

def inspect_detail_page(url):
    headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
    print(f"Fetching {url}...")
    res = requests.get(url, headers=headers)
    print("Status code:", res.status_code)
    
    soup = BeautifulSoup(res.text, 'html.parser')
    
    # 1. Look for <score-board> element (modern RT detail pages use this)
    scoreboard = soup.find('score-board')
    if scoreboard:
        print("Found scoreboard!")
        print("Scoreboard attributes:", scoreboard.attrs)
        print("tomatometerscore:", scoreboard.get('tomatometerscore'))
        print("audiencescore:", scoreboard.get('audiencescore'))
        return
        
    # 2. Look for score-board-deprecated or scorecard
    scorecard = soup.find('rt-scorecard')
    if scorecard:
        print("Found rt-scorecard!")
        print("rt-scorecard attributes:", scorecard.attrs)
        return
        
    # 3. Look for elements containing score inside script tags
    print("Scanning script tags...")
    for idx, script in enumerate(soup.find_all('script')):
        if script.string and 'criticsScore' in script.string:
            print(f"Script {idx}: type={script.get('type')}, id={script.get('id')}, length={len(script.string)}")
            # Try to print some of the surrounding context or load as JSON if it's pure JSON
            content = script.string.strip()
            print("Prefix:", content[:100])
            print("Suffix:", content[-100:])

if __name__ == "__main__":
    inspect_detail_page("https://www.rottentomatoes.com/tv/widows_bay")
