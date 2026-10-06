use std::io::{Read, Write};
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};
use tauri::Manager;

/// Resolves the paths for the Python executable and the scraper script.
/// Supports both development workspace layout (seeking .venv in the workspace)
/// and standalone packaged app (seeking script inside bundle Resources folder).
fn resolve_paths(app: &tauri::AppHandle, script_name: &str) -> Result<(PathBuf, PathBuf), String> {
    // 1. Try to find .venv and script in current working directory (dev mode)
    if let Ok(cwd) = std::env::current_dir() {
        let dev_venv = cwd.join(".venv").join("bin").join("python3");
        let dev_script = cwd.join("scripts").join(script_name);
        if dev_venv.exists() && dev_script.exists() {
            return Ok((dev_venv, dev_script));
        }

        // 2. Try to find .venv walking up from current directory (in case app was started in a subdirectory)
        let mut dir = cwd;
        while dir.parent().is_some() {
            let venv = dir.join(".venv").join("bin").join("python3");
            let script = dir.join("scripts").join(script_name);
            if venv.exists() && script.exists() {
                return Ok((venv, script));
            }
            dir = dir.parent().unwrap().to_path_buf();
        }
    }

    // 2.5 Dev-only: fall back to the absolute dev workspace path so `tauri dev` /
    // `cargo test` started from any directory still find the workspace venv. This
    // tier is compiled out of release builds (`#[cfg(debug_assertions)]`) so a
    // packaged .app never silently prefers the dev workspace over its own bundle.
    #[cfg(debug_assertions)]
    {
        let dev_workspace_venv =
            PathBuf::from("/Users/muthu/work/utilities/flicksieve/.venv/bin/python3");
        let dev_workspace_script =
            PathBuf::from("/Users/muthu/work/utilities/flicksieve/scripts").join(script_name);
        if dev_workspace_venv.exists() && dev_workspace_script.exists() {
            return Ok((dev_workspace_venv, dev_workspace_script));
        }
    }

    // 3. Fallback: resource directory (bundled scripts for standalone packaged distribution)
    let resource_dir = app.path().resource_dir().map_err(|e| e.to_string())?;
    let bundled_script = resource_dir.join("scripts").join(script_name);

    // In standalone mac distribution, default to system python3 command but search standard paths first
    #[cfg(target_os = "macos")]
    let python_exe = {
        let mut path = PathBuf::from("python3");
        for p in &[
            "/opt/homebrew/bin/python3",
            "/usr/local/bin/python3",
            "/Library/Frameworks/Python.framework/Versions/Current/bin/python3",
        ] {
            let p_buf = PathBuf::from(p);
            if p_buf.exists() {
                path = p_buf;
                break;
            }
        }
        path
    };

    #[cfg(not(target_os = "macos"))]
    let python_exe = PathBuf::from("python3");

    Ok((python_exe, bundled_script))
}

/// Single-title lookups (Letterboxd / RT) should answer quickly.
const LOOKUP_TIMEOUT: Duration = Duration::from_secs(45);
/// Discovery crawls fan out across many pages; match the dev server's 300s cap.
const DISCOVERY_TIMEOUT: Duration = Duration::from_secs(300);

/// Executes a Python script with the given arguments and returns its stdout.
/// The child is killed if it has not exited within `timeout`.
fn execute_python_script(
    app: &tauri::AppHandle,
    script_name: &str,
    args: &[&str],
    timeout: Duration,
) -> Result<String, String> {
    let (python_exe, script_path) = resolve_paths(app, script_name)?;

    if !script_path.exists() {
        return Err(format!(
            "Python script not found at path: {:?}",
            script_path
        ));
    }

    let mut child = Command::new(python_exe)
        .arg(script_path)
        .args(args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to run Python command: {}", e))?;

    // Drain both pipes on their own threads so a chatty child can't block on a full pipe.
    let mut stdout_pipe = child.stdout.take().ok_or("Failed to capture stdout")?;
    let mut stderr_pipe = child.stderr.take().ok_or("Failed to capture stderr")?;
    let out_thread = std::thread::spawn(move || {
        let mut buf = Vec::new();
        let _ = stdout_pipe.read_to_end(&mut buf);
        buf
    });
    let err_thread = std::thread::spawn(move || {
        let mut buf = Vec::new();
        let _ = stderr_pipe.read_to_end(&mut buf);
        buf
    });

    let deadline = Instant::now() + timeout;
    let status = loop {
        match child.try_wait().map_err(|e| format!("Failed to wait on Python command: {}", e))? {
            Some(status) => break Some(status),
            None if Instant::now() >= deadline => {
                let _ = child.kill();
                let _ = child.wait();
                break None;
            }
            None => std::thread::sleep(Duration::from_millis(50)),
        }
    };

    let stdout = out_thread.join().unwrap_or_default();
    let stderr = err_thread.join().unwrap_or_default();

    match status {
        None => Err(format!(
            "Scraper {} timed out after {}s",
            script_name,
            timeout.as_secs()
        )),
        Some(status) if !status.success() => Err(format!(
            "Scraper script failed with status code {}.\nStderr: {}",
            status,
            String::from_utf8_lossy(&stderr)
        )),
        Some(_) => Ok(String::from_utf8_lossy(&stdout).to_string()),
    }
}

/// Runs a scraper on the blocking thread pool so a slow crawl never stalls the
/// main thread (sync Tauri commands run there and would freeze the window).
async fn run_scraper(
    app: tauri::AppHandle,
    script_name: &'static str,
    args: Vec<String>,
    timeout: Duration,
) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let refs: Vec<&str> = args.iter().map(String::as_str).collect();
        execute_python_script(&app, script_name, &refs, timeout)
    })
    .await
    .map_err(|e| format!("Scraper task failed: {}", e))?
}

fn get_home_dir(app: Option<&tauri::AppHandle>) -> PathBuf {
    if let Some(app_handle) = app {
        app_handle
            .path()
            .home_dir()
            .unwrap_or_else(|_| PathBuf::from(std::env::var("HOME").unwrap_or_default()))
    } else {
        PathBuf::from(std::env::var("HOME").unwrap_or_default())
    }
}

fn expand_tilde(path_str: &str, home: &PathBuf) -> PathBuf {
    if path_str.starts_with("~/") {
        home.join(&path_str[2..])
    } else if path_str == "~" {
        home.clone()
    } else {
        PathBuf::from(path_str)
    }
}

fn resolve_config_path(app: Option<&tauri::AppHandle>) -> PathBuf {
    if let Ok(test_dir) = std::env::var("FLICKSIEVE_TEST_DIR") {
        return PathBuf::from(test_dir).join("config.json");
    }
    let home = get_home_dir(app);
    home.join(".flicksieve").join("config.json")
}

fn resolve_data_folder(app: Option<&tauri::AppHandle>) -> PathBuf {
    if let Ok(test_dir) = std::env::var("FLICKSIEVE_TEST_DIR") {
        return PathBuf::from(test_dir);
    }
    let home = get_home_dir(app);
    let config_path = resolve_config_path(app);
    if config_path.exists() {
        if let Ok(content) = std::fs::read_to_string(&config_path) {
            if let Ok(val) = serde_json::from_str::<serde_json::Value>(&content) {
                if let Some(folder) = val.get("dataFolder").and_then(|v| v.as_str()) {
                    return expand_tilde(folder, &home);
                }
            }
        }
    }
    home.join(".flicksieve")
}

/// Writes `bytes` to `path` without ever leaving a truncated file behind:
/// write + fsync a sibling temp file, keep the previous version as `<name>.bak`,
/// then rename the temp file into place (atomic on the same filesystem).
fn atomic_write(path: &std::path::Path, bytes: &[u8]) -> std::io::Result<()> {
    let name = path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();
    let tmp = path.with_file_name(format!("{}.tmp", name));
    {
        let mut f = std::fs::File::create(&tmp)?;
        f.write_all(bytes)?;
        f.sync_all()?;
    }
    if path.exists() {
        // Best effort: a failed backup must not block saving the new data.
        let _ = std::fs::copy(path, path.with_file_name(format!("{}.bak", name)));
    }
    std::fs::rename(&tmp, path)
}

#[tauri::command]
fn get_data_folder(app: tauri::AppHandle) -> String {
    let folder = resolve_data_folder(Some(&app));
    folder.to_string_lossy().to_string()
}

#[tauri::command]
fn set_data_folder(app: tauri::AppHandle, path: String) -> Result<(), String> {
    let home = get_home_dir(Some(&app));
    let expanded_path = expand_tilde(&path, &home);

    // Ensure target folder directory exists (or create it)
    std::fs::create_dir_all(&expanded_path)
        .map_err(|e| format!("Failed to create directory: {}", e))?;

    let config_path = resolve_config_path(Some(&app));
    // Ensure config directory exists
    if let Some(parent) = config_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create config directory: {}", e))?;
    }

    let mut config_val = serde_json::Map::new();
    config_val.insert("dataFolder".to_string(), serde_json::Value::String(path));

    let config_json = serde_json::Value::Object(config_val);
    let content = serde_json::to_string_pretty(&config_json).map_err(|e| e.to_string())?;
    atomic_write(&config_path, content.as_bytes()).map_err(|e| format!("Failed to write config: {}", e))?;

    Ok(())
}

#[tauri::command]
fn load_data_file(app: tauri::AppHandle, filename: String) -> Result<String, String> {
    if filename.contains('/') || filename.contains('\\') || filename.contains("..") {
        return Err("Invalid filename".to_string());
    }
    let folder = resolve_data_folder(Some(&app));
    let file_path = folder.join(filename);
    if !file_path.exists() {
        return Err("NOT_FOUND".to_string());
    }
    std::fs::read_to_string(&file_path).map_err(|e| format!("Failed to read file: {}", e))
}

#[tauri::command]
fn save_data_file(app: tauri::AppHandle, filename: String, content: String) -> Result<(), String> {
    if filename.contains('/') || filename.contains('\\') || filename.contains("..") {
        return Err("Invalid filename".to_string());
    }
    let folder = resolve_data_folder(Some(&app));
    std::fs::create_dir_all(&folder)
        .map_err(|e| format!("Failed to create data directory: {}", e))?;
    atomic_write(&folder.join(filename), content.as_bytes())
        .map_err(|e| format!("Failed to write file: {}", e))
}

#[tauri::command]
async fn run_letterboxd_scraper(
    app: tauri::AppHandle,
    query: String,
    year: String,
    imdb_id: String,
    is_tv: Option<bool>,
) -> Result<String, String> {
    let is_tv_str = if is_tv.unwrap_or(false) { "true" } else { "false" }.to_string();
    run_scraper(app, "fetch_letterboxd.py", vec![query, year, imdb_id, is_tv_str], LOOKUP_TIMEOUT).await
}

#[tauri::command]
async fn run_rottentomatoes_scraper(
    app: tauri::AppHandle,
    query: String,
    year: String,
    is_tv: Option<bool>,
) -> Result<String, String> {
    let is_tv_str = if is_tv.unwrap_or(false) { "true" } else { "false" }.to_string();
    run_scraper(app, "fetch_rottentomatoes.py", vec![query, year, is_tv_str], LOOKUP_TIMEOUT).await
}

#[tauri::command]
async fn run_91mobiles_scraper(app: tauri::AppHandle) -> Result<String, String> {
    run_scraper(app, "scrape_91mobiles.py", vec![], LOOKUP_TIMEOUT).await
}

#[tauri::command]
async fn run_discover_at_home(
    app: tauri::AppHandle,
    days: String,
    min_audience: String,
    sort: String,
    media_type: Option<String>,
) -> Result<String, String> {
    let media_str = media_type.unwrap_or_else(|| "movie".to_string());
    run_scraper(app, "discover_at_home.py", vec![days, min_audience, sort, media_str], DISCOVERY_TIMEOUT).await
}

#[tauri::command]
async fn run_discover_indian(
    app: tauri::AppHandle,
    window_days: String,
    languages: String,
    min_rating: String,
    min_critics: String,
    include_youtube: String,
) -> Result<String, String> {
    run_scraper(
        app,
        "discover_indian.py",
        vec![window_days, languages, min_rating, min_critics, include_youtube],
        DISCOVERY_TIMEOUT,
    )
    .await
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            run_letterboxd_scraper,
            run_rottentomatoes_scraper,
            run_91mobiles_scraper,
            run_discover_at_home,
            run_discover_indian,
            get_data_folder,
            set_data_folder,
            load_data_file,
            save_data_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {

    #[test]
    fn test_scraper_run() {
        let cwd = std::env::current_dir().unwrap();
        println!("Current dir: {:?}", cwd);

        let mut resolved = None;
        let dev_venv = cwd.join(".venv").join("bin").join("python3");
        let dev_script = cwd.join("scripts").join("scrape_91mobiles.py");
        if dev_venv.exists() && dev_script.exists() {
            resolved = Some((dev_venv, dev_script));
        } else {
            let mut dir = cwd.clone();
            while dir.parent().is_some() {
                let venv = dir.join(".venv").join("bin").join("python3");
                let script = dir.join("scripts").join("scrape_91mobiles.py");
                if venv.exists() && script.exists() {
                    resolved = Some((venv, script));
                    break;
                }
                dir = dir.parent().unwrap().to_path_buf();
            }
        }

        let (python_exe, script_path) = resolved.expect("Could not find .venv or script");
        let mut command = std::process::Command::new(python_exe);
        command.arg(script_path);
        let output = command.output().expect("Failed to execute command");
        assert!(output.status.success());
    }

    #[test]
    fn test_letterboxd_run() {
        let cwd = std::env::current_dir().unwrap();
        let dev_venv = cwd
            .parent()
            .unwrap()
            .join(".venv")
            .join("bin")
            .join("python3");
        let dev_script = cwd
            .parent()
            .unwrap()
            .join("scripts")
            .join("fetch_letterboxd.py");
        let mut command = std::process::Command::new(dev_venv);
        command.arg(dev_script);
        command.arg("Inception");
        command.arg("2010");
        command.arg("tt1375666");
        let output = command.output().expect("Failed to execute command");
        println!("Letterboxd Status: {:?}", output.status);
        println!(
            "Letterboxd Stdout: {}",
            String::from_utf8_lossy(&output.stdout)
        );
        println!(
            "Letterboxd Stderr: {}",
            String::from_utf8_lossy(&output.stderr)
        );
        assert!(output.status.success());
    }

    #[test]
    fn test_rottentomatoes_run() {
        let cwd = std::env::current_dir().unwrap();
        let dev_venv = cwd
            .parent()
            .unwrap()
            .join(".venv")
            .join("bin")
            .join("python3");
        let dev_script = cwd
            .parent()
            .unwrap()
            .join("scripts")
            .join("fetch_rottentomatoes.py");
        let mut command = std::process::Command::new(dev_venv);
        command.arg(dev_script);
        command.arg("Inception");
        command.arg("2010");
        command.arg("false");
        let output = command.output().expect("Failed to execute command");
        println!("RT Status: {:?}", output.status);
        println!("RT Stdout: {}", String::from_utf8_lossy(&output.stdout));
        println!("RT Stderr: {}", String::from_utf8_lossy(&output.stderr));
        assert!(output.status.success());
    }

    #[test]
    fn test_config_and_data_file_ops() {
        let temp_dir = std::env::temp_dir().join("flicksieve_test_run");
        if temp_dir.exists() {
            let _ = std::fs::remove_dir_all(&temp_dir);
        }
        std::fs::create_dir_all(&temp_dir).unwrap();

        // Set environment variable so the functions use this test directory
        std::env::set_var("FLICKSIEVE_TEST_DIR", temp_dir.to_str().unwrap());

        let home = std::path::PathBuf::from(std::env::var("HOME").unwrap_or_default());

        // Test expand_tilde
        assert_eq!(super::expand_tilde("~", &home), home);
        assert_eq!(super::expand_tilde("~/movies", &home), home.join("movies"));
        assert_eq!(
            super::expand_tilde("/abc/def", &home),
            std::path::PathBuf::from("/abc/def")
        );

        // Resolve path check (should point to test_dir)
        let data_folder = super::resolve_data_folder(None);
        assert_eq!(data_folder, temp_dir);

        // Write data
        let content = "{\"test\": true}";
        let res_write = std::fs::write(temp_dir.join("test.json"), content);
        assert!(res_write.is_ok());

        // Read data using standard read
        let read_content = std::fs::read_to_string(temp_dir.join("test.json")).unwrap();
        assert_eq!(read_content, content);

        // Clean up env var
        std::env::remove_var("FLICKSIEVE_TEST_DIR");
    }

    #[test]
    fn test_atomic_write_keeps_backup_and_no_tmp() {
        let dir = std::env::temp_dir().join(format!("flicksieve_atomic_{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let file = dir.join("shows.json");

        atomic_write(&file, b"[1]").unwrap();
        atomic_write(&file, b"[1,2]").unwrap();

        assert_eq!(std::fs::read_to_string(&file).unwrap(), "[1,2]");
        assert_eq!(std::fs::read_to_string(dir.join("shows.json.bak")).unwrap(), "[1]");
        assert!(!dir.join("shows.json.tmp").exists());
        let _ = std::fs::remove_dir_all(&dir);
    }
}
