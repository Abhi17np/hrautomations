const fs = require('fs');
const path = require('path');

const OUTPUT_FILE = 'project_export.txt';

// Folders to skip
const SKIP_DIRS = [
  'node_modules', '.git', '.angular', 'dist', 'build',
  '.cache', 'coverage', '.nyc_output', 'tmp', '.tmp',
  '__pycache__', '.pytest_cache', '.venv', 'venv', 'env',
  '.mypy_cache', '.eggs', '*.egg-info'
];

// File types to SKIP (only binaries / assets — everything else is collected)
const SKIP_EXTENSIONS = [
  // Images
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp', '.bmp', '.tiff',
  // Fonts
  '.woff', '.woff2', '.ttf', '.eot', '.otf',
  // Archives / binaries
  '.zip', '.tar', '.gz', '.rar', '.7z',
  '.exe', '.dll', '.so', '.dylib', '.bin',
  // Compiled Python
  '.pyc', '.pyo', '.pyd',
  // Misc
  '.pdf', '.map', '.lock', '.log'
];

// ── No IMPORTANT_EXTENSIONS filter any more ──
// Every file NOT in SKIP_EXTENSIONS will be included.

let output = '';
let fileCount = 0;

function scanDir(dirPath, depth = 0) {
  let items;
  try {
    items = fs.readdirSync(dirPath);
  } catch (e) {
    output += `[Cannot read directory: ${dirPath}]\n`;
    return;
  }

  for (const item of items) {
    const fullPath = path.join(dirPath, item);
    let stat;
    try {
      stat = fs.statSync(fullPath);
    } catch (e) {
      continue;
    }

    if (stat.isDirectory()) {
      // Skip unwanted dirs (support glob-style *.egg-info check)
      if (SKIP_DIRS.some(d => d.startsWith('*') ? item.endsWith(d.slice(1)) : item === d)) continue;

      output += `\n${'='.repeat(70)}\n`;
      output += `📁 FOLDER: ${fullPath}\n`;
      output += `${'='.repeat(70)}\n`;
      scanDir(fullPath, depth + 1);

    } else {
      const ext = path.extname(item).toLowerCase();

      // Skip binary / asset extensions
      if (SKIP_EXTENSIONS.includes(ext)) continue;

      // ── Collect EVERY remaining file ──
      fileCount++;
      output += `\n${'-'.repeat(70)}\n`;
      output += `📄 FILE #${fileCount}: ${fullPath}\n`;
      output += `${'-'.repeat(70)}\n`;

      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        const lines = content.split('\n');
        lines.forEach((line, i) => {
          output += `${String(i + 1).padStart(5)} | ${line}\n`;
        });
      } catch (e) {
        output += `[Could not read file: ${e.message}]\n`;
      }
    }
  }
}

// ── Header ──
output += `${'#'.repeat(70)}\n`;
output += `   FULL PROJECT EXPORT — JS FRONTEND + PYTHON BACKEND\n`;
output += `${'#'.repeat(70)}\n`;
output += `Generated : ${new Date().toISOString()}\n`;
output += `Root Path : ${process.cwd()}\n`;
output += `${'#'.repeat(70)}\n\n`;

// ── Scan ──
scanDir('.');

// ── Footer ──
output += `\n${'#'.repeat(70)}\n`;
output += `   EXPORT COMPLETE — Total Files: ${fileCount}\n`;
output += `${'#'.repeat(70)}\n`;

fs.writeFileSync(OUTPUT_FILE, output, 'utf8');
console.log(`✅ Done! Exported ${fileCount} files to: ${OUTPUT_FILE}`);