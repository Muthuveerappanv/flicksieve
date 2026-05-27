import os
import subprocess
import time
import socket
from playwright.sync_api import sync_playwright

def is_port_open(port):
    # Try IPv4
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(0.5)
            if s.connect_ex(('127.0.0.1', port)) == 0:
                return True
    except Exception:
        pass
    # Try IPv6
    try:
        with socket.socket(socket.AF_INET6, socket.SOCK_STREAM) as s:
            s.settimeout(0.5)
            if s.connect_ex(('::1', port)) == 0:
                return True
    except Exception:
        pass
    return False

def run_demo():
    # 1. Start the Vite dev server in the background if not already running
    port_already_open = is_port_open(5173)
    server_process = None
    
    if port_already_open:
        print("Vite dev server is already running on port 5173. Skipping startup.")
    else:
        print("Starting Vite dev server...")
        env = os.environ.copy()
        env["PATH"] = "/Users/muthu/.nvm/versions/node/v24.12.0/bin:" + env.get("PATH", "")
        server_process = subprocess.Popen(
            ["npm", "run", "dev"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            cwd="/Users/muthu/work/utilities/flicksieve",
            env=env
        )
        
        # Wait for the server to start (up to 10 seconds)
        print("Waiting for dev server to start on port 5173...")
        for _ in range(20):
            if is_port_open(5173):
                print("Vite dev server is up!")
                break
            time.sleep(0.5)
        else:
            print("Error: Vite dev server failed to start.")
            # Print subprocess errors if any
            server_process.terminate()
            try:
                stdout_output, stderr_output = server_process.communicate(timeout=5)
                print("Vite stdout:", stdout_output.decode('utf-8'))
                print("Vite stderr:", stderr_output.decode('utf-8'))
            except Exception as e:
                print("Failed to read Vite output:", e)
            return

    # 2. Run Playwright to record the demo
    artifact_dir = "/Users/muthu/.gemini/antigravity-cli/brain/d87e7dd0-889d-4111-a429-b11a2628d7f9"
    os.makedirs(artifact_dir, exist_ok=True)
    video_dir = os.path.join(artifact_dir, "temp_video")
    os.makedirs(video_dir, exist_ok=True)

    print("Launching Playwright browser...")
    with sync_playwright() as p:
        # Launch headed or headless (headed is better if we want full rendering, but headless with chromium works perfectly for video)
        browser = p.chromium.launch(headless=True)
        
        # Set screen size to standard 720p 16:9
        context = browser.new_context(
            viewport={"width": 1280, "height": 720},
            record_video_dir=video_dir,
            record_video_size={"width": 1280, "height": 720}
        )
        
        page = context.new_page()
        
        print("Navigating to FlickSieve...")
        page.goto("http://localhost:5173")
        page.wait_for_load_state("networkidle")
        
        # --- SCENE 1: HOVER OVER RT RATING BOX ---
        print("Scene 1: Hovering over RT rating box...")
        time.sleep(2)
        # Find first show card RT rating item
        rt_selector = ".show-card .rating-item:has-text('RT')"
        page.wait_for_selector(rt_selector)
        # Scroll to view
        page.locator(rt_selector).first.scroll_into_view_if_needed()
        time.sleep(1)
        # Hover to trigger custom CSS tooltip
        page.locator(rt_selector).first.hover()
        print("Hover triggered, waiting 3 seconds for tooltip display...")
        time.sleep(3)
        
        # --- SCENE 2: INTERACT WITH THE SIEVE LIMIT SLIDER ---
        print("Scene 2: Adjusting Sieve Limit slider...")
        page.evaluate("""() => {
            const s = document.getElementById('sieve-slider');
            s.value = 4.2;
            s.dispatchEvent(new Event('input', { bubbles: true }));
            s.dispatchEvent(new Event('change', { bubbles: true }));
        }""")
        print("Sieve Limit raised to 4.2, waiting 3 seconds...")
        time.sleep(3)
        
        # Reset the slider back to 3.0 to show titles again
        page.evaluate("""() => {
            const s = document.getElementById('sieve-slider');
            s.value = 3.0;
            s.dispatchEvent(new Event('input', { bubbles: true }));
            s.dispatchEvent(new Event('change', { bubbles: true }));
        }""")
        time.sleep(2)
        
        # --- SCENE 3: SEARCH BYPASS DEMO ---
        print("Scene 3: Testing Search Sieve Bypass...")
        # Search for Ustaad
        page.fill("#search-main", "Ustaad")
        print("Searched for 'Ustaad', waiting 3 seconds...")
        time.sleep(3)
        # Clear search
        page.fill("#search-main", "")
        time.sleep(1)

        # --- SCENE 4: SMART AUTOFILL WITH RT SCORES ---
        print("Scene 4: Triggering Add Title Modal and Smart Autofill...")
        # Open modal
        page.click("#sidebar-add-title-btn")
        page.wait_for_selector("input[placeholder='e.g. Maharaja, Inception, Breaking Bad...']")
        time.sleep(1)
        
        # Fill search input with 'F1'
        page.fill("input[placeholder='e.g. Maharaja, Inception, Breaking Bad...']", "F1")
        time.sleep(1)
        # Click search
        page.click("button:has-text('Search')")
        print("Searching for 'F1' in modal...")
        time.sleep(2.5) # Wait for search API results
        
        # Select first result 'F1 The Movie'
        result_selector = ".scrape-modal-body button:has-text('F1')"
        page.wait_for_selector(result_selector)
        time.sleep(1)
        page.click(result_selector)
        print("Clicked search result, waiting for full details autofill...")
        time.sleep(4) # Wait for detail API and Rotten Tomatoes scraper to resolve
        
        # Submit the form
        page.click("button[type='submit']:has-text('Add Title')")
        print("Submitted form, waiting for new card to render...")
        time.sleep(3)
        
        # Final pause
        print("Demo complete! Wrapping up...")
        time.sleep(1)
        
        # Close context to finalize video recording
        context.close()
        browser.close()
        
        # Find the recorded video and rename it
        video_files = [f for f in os.listdir(video_dir) if f.endswith(".webm")]
        if video_files:
            recorded_path = os.path.join(video_dir, video_files[0])
            dest_path = os.path.join(artifact_dir, "flicksieve_demo.webm")
            if os.path.exists(dest_path):
                os.remove(dest_path)
            os.rename(recorded_path, dest_path)
            print(f"Video saved successfully to: {dest_path}")
            
            # Clean up temp dir
            os.rmdir(video_dir)
        else:
            print("Error: No video file was recorded.")

    # 3. Clean up Vite server subprocess
    if server_process:
        print("Stopping Vite dev server...")
        server_process.terminate()
        try:
            server_process.wait(timeout=3)
        except subprocess.TimeoutExpired:
            server_process.kill()
    print("Done!")

if __name__ == "__main__":
    run_demo()
