# Release Version Management

When requested by the user to prepare a new release, tag a release, or update the version, you must follow these rules to ensure the automated build and release pipeline behaves correctly:

1. **Do not just tag the repository.** You must first update the release version in all relevant configuration files so the automated tauri-action builder publishes to the correct release tag target.
2. **Always use the version bump script** in the project to automatically update the version in `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, and update `Cargo.lock`.
   - Run the following command (replace `<version>` with the target version, e.g., `0.1.2`):
     ```bash
     npm run bump-version <version>
     ```
3. **Commit the changed configuration files** (including `Cargo.lock` if changed) to the repository before creating the Git tag or instructing the user to do so:
   - Command sequence:
     ```bash
     git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml src-tauri/Cargo.lock
     git commit -m "bump version to <version>"
     ```
