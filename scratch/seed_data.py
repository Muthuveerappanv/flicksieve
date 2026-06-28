import os
import sqlite3
import json
import glob

def seed_data():
    home = os.path.expanduser("~")
    target_dir = os.path.join(home, ".flicksieve")
    
    # Ensure target directory exists
    os.makedirs(target_dir, exist_ok=True)
    
    # Find all localstorage databases
    patterns = [
        os.path.join(home, "Library/WebKit/com.flicksieve/WebsiteData/Default/**/LocalStorage/localstorage.sqlite3"),
        os.path.join(home, "Library/WebKit/com.flicksieve.app/WebsiteData/Default/**/LocalStorage/localstorage.sqlite3"),
    ]
    
    db_paths = []
    for pattern in patterns:
        db_paths.extend(glob.glob(pattern, recursive=True))
        
    print("Found SQLite DB paths:", db_paths)
    if not db_paths:
        print("No macOS WKWebView local storage found. We will use fallback default seed data if needed.")
        return
        
    # Sort by modification time to get the most recent one first
    db_paths.sort(key=lambda p: os.path.getmtime(p), reverse=True)
    
    db_path = db_paths[0]
    print(f"Using SQLite DB from: {db_path} (last modified: {os.path.getmtime(db_path)})")
    
    conn = sqlite3.connect(db_path)
    c = conn.cursor()
    c.execute("SELECT key, value FROM ItemTable")
    
    keys_map = {
        "flicksieve_shows": "shows.json",
        "flicksieve_reviewers": "reviewers.json",
        "flicksieve_watchlist": "watchlist.json",
        "flicksieve_history": "history.json",
        "flicksieve_theme": "theme.json"
    }
    
    for row in c.fetchall():
        key, val = row[0], row[1]
        if key in keys_map:
            filename = keys_map[key]
            target_path = os.path.join(target_dir, filename)
            
            # Decode WKWebView UTF-16 bytes
            if isinstance(val, bytes):
                try:
                    decoded = val.decode("utf-16")
                except Exception as e:
                    decoded = val.decode("utf-8", errors="ignore")
            else:
                decoded = str(val)
                
            print(f"Seeding {filename} with length {len(decoded)}")
            
            # For JSON files, parse and write pretty printed.
            # theme.json is just a string, we can save it as JSON string or raw
            if filename.endswith(".json"):
                try:
                    # Let us parse it to ensure it is valid JSON
                    parsed = json.loads(decoded)
                    with open(target_path, "w", encoding="utf-8") as f:
                        json.dump(parsed, f, indent=2, ensure_ascii=False)
                except Exception as e:
                    print(f"  Error parsing/saving {filename}: {e}. Writing raw string.")
                    with open(target_path, "w", encoding="utf-8") as f:
                        f.write(decoded)
            else:
                with open(target_path, "w", encoding="utf-8") as f:
                    f.write(decoded)
                    
    conn.close()
    print("Seeding complete. Files stored in:", target_dir)

if __name__ == "__main__":
    seed_data()
