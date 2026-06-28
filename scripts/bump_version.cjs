const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const newVersion = process.argv[2];
if (!newVersion) {
  console.error('Please specify a version, e.g.: node scripts/bump_version.cjs 0.1.2');
  process.exit(1);
}

// Ensure version format is valid (e.g. 1.2.3 or v1.2.3)
let cleanVersion = newVersion;
if (cleanVersion.startsWith('v')) {
  cleanVersion = cleanVersion.substring(1);
}

if (!/^\d+\.\d+\.\d+$/.test(cleanVersion)) {
  console.error('Invalid version format. Use x.y.z or vx.y.z format (e.g., 0.1.2 or v0.1.2)');
  process.exit(1);
}

const rootDir = path.resolve(__dirname, '..');

// 1. Update package.json
const pkgPath = path.join(rootDir, 'package.json');
if (fs.existsSync(pkgPath)) {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  pkg.version = cleanVersion;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  console.log(`Updated package.json version to ${cleanVersion}`);
}

// 2. Update src-tauri/tauri.conf.json
const tauriConfPath = path.join(rootDir, 'src-tauri', 'tauri.conf.json');
if (fs.existsSync(tauriConfPath)) {
  const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf8'));
  tauriConf.version = cleanVersion;
  fs.writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + '\n');
  console.log(`Updated tauri.conf.json version to ${cleanVersion}`);
}

// 3. Update src-tauri/Cargo.toml
const cargoTomlPath = path.join(rootDir, 'src-tauri', 'Cargo.toml');
if (fs.existsSync(cargoTomlPath)) {
  let cargoToml = fs.readFileSync(cargoTomlPath, 'utf8');
  // Replace version under [package]
  cargoToml = cargoToml.replace(/^version\s*=\s*".*"/m, `version = "${cleanVersion}"`);
  fs.writeFileSync(cargoTomlPath, cargoToml);
  console.log(`Updated Cargo.toml version to ${cleanVersion}`);
}

// 4. Update Cargo.lock by running cargo check in src-tauri
try {
  console.log('Running cargo check to update Cargo.lock...');
  execSync('cargo check', { cwd: path.join(rootDir, 'src-tauri'), stdio: 'inherit' });
  console.log('Successfully updated Cargo.lock');
} catch (error) {
  console.error('Failed to run cargo check:', error.message);
}
