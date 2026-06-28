use std::path::PathBuf;
use std::process::Command;
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

    // 2.5 Try to check the absolute dev workspace path (useful when running the packaged app on the dev machine)
    let dev_workspace_venv =
        PathBuf::from("/Users/muthu/work/utilities/flicksieve/.venv/bin/python3");
    let dev_workspace_script =
        PathBuf::from("/Users/muthu/work/utilities/flicksieve/scripts").join(script_name);
    if dev_workspace_venv.exists() && dev_workspace_script.exists() {
        return Ok((dev_workspace_venv, dev_workspace_script));
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

/// Executes a Python script with the given arguments and returns its stdout.
fn execute_python_script(
    app: tauri::AppHandle,
    script_name: &str,
    args: Vec<&str>,
) -> Result<String, String> {
    let (python_exe, script_path) = resolve_paths(&app, script_name)?;

    if !script_path.exists() {
        return Err(format!(
            "Python script not found at path: {:?}",
            script_path
        ));
    }

    let mut command = Command::new(python_exe);
    command.arg(script_path);
    for arg in args {
        command.arg(arg);
    }

    let output = command
        .output()
        .map_err(|e| format!("Failed to run Python command: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!(
            "Scraper script failed with status code {}.\nStderr: {}",
            output.status, stderr
        ));
    }

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    Ok(stdout)
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
    std::fs::write(&config_path, content).map_err(|e| format!("Failed to write config: {}", e))?;

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
    let file_path = folder.join(filename);
    std::fs::write(&file_path, content).map_err(|e| format!("Failed to write file: {}", e))
}

#[tauri::command]
fn run_letterboxd_scraper(
    app: tauri::AppHandle,
    query: String,
    year: String,
    imdb_id: String,
) -> Result<String, String> {
    execute_python_script(app, "fetch_letterboxd.py", vec![&query, &year, &imdb_id])
}

#[tauri::command]
fn run_rottentomatoes_scraper(
    app: tauri::AppHandle,
    query: String,
    year: String,
    is_tv: bool,
) -> Result<String, String> {
    let is_tv_str = if is_tv { "true" } else { "false" };
    execute_python_script(
        app,
        "fetch_rottentomatoes.py",
        vec![&query, &year, is_tv_str],
    )
}

#[tauri::command]
fn run_91mobiles_scraper(app: tauri::AppHandle) -> Result<String, String> {
    execute_python_script(app, "scrape_91mobiles.py", vec![])
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
}
