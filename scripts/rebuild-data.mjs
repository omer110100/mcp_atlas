#!/usr/bin/env node
/** Rebuild from the checked-in snapshot in an isolated temporary directory. */
import { createHash } from 'node:crypto';
import { cpSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { isDeepStrictEqual } from 'node:util';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const checkOnly = args.includes('--check');
const builders = ['build_data.py', 'build_hunt_data.py', 'build_drop_data.py'];
const outputs = ['dist/atlas-data.json', 'dist/hunt-data.json', 'dist/drop-data.json'];
const audits = ['source-data/build-audit.json', 'source-data/hunt-build-audit.json'];
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

function findPython() {
  const candidates = process.platform === 'win32'
    ? [['py', ['-3']], ['python', []], ['python3', []]]
    : [['python3', []], ['python', []]];
  for (const [command, prefix] of candidates) {
    const result = spawnSync(command, [...prefix, '-c', 'import sys; print(sys.version.split()[0]); sys.exit(0 if sys.version_info >= (3, 11) else 1)'], {
      encoding: 'utf8', timeout: 15_000, windowsHide: true,
    });
    if (result.status === 0) return { command, prefix, version: result.stdout.trim() };
  }
  throw new Error('Rebuilding data requires Python 3.11 or newer on PATH. Running the website and npm run verify only require Node.js. See docs/SETUP.md.');
}

function main() {
  if (args.some(arg => arg !== '--check')) throw new Error('Usage: node scripts/rebuild-data.mjs [--check]');
  const python = findPython();
  console.log(`Using Python ${python.version}. Rebuilding from local pinned sources; no downloads.`);
  const temporary = mkdtempSync(join(tmpdir(), 'maple-atlas-rebuild-'));
  try {
    cpSync(join(root, 'source-data'), join(temporary, 'source-data'), { recursive: true });
    mkdirSync(join(temporary, 'dist'));
    for (const file of builders) copyFileSync(join(root, file), join(temporary, file));
    for (const file of builders) {
      const result = spawnSync(python.command, [...python.prefix, '-X', 'utf8', join(temporary, file)], {
        cwd: temporary, encoding: 'utf8', windowsHide: true, timeout: 180_000,
        env: { ...process.env, PYTHONUTF8: '1', PYTHONDONTWRITEBYTECODE: '1', PYTHONNOUSERSITE: '1', PYTHONHASHSEED: '0' },
      });
      if (result.error || result.status !== 0) {
        throw new Error(`${file} failed:\n${result.stderr || result.stdout || result.error?.message}`);
      }
      console.log(`  Built ${file}`);
    }
    const changes = [];
    for (const file of [...outputs, ...audits]) {
      const generated = readFileSync(join(temporary, file));
      JSON.parse(generated.toString('utf8'));
      const current = existsSync(join(root, file)) ? readFileSync(join(root, file)) : null;
      const equal = current !== null && isDeepStrictEqual(JSON.parse(current.toString('utf8')), JSON.parse(generated.toString('utf8')));
      if (!equal) changes.push(file);
      const sameBytes = current !== null && generated.equals(current);
      console.log(`  ${equal ? 'MATCH' : 'CHANGED'} ${file} ${sameBytes ? '(identical bytes)' : equal ? '(equivalent JSON)' : ''}`);
      if (outputs.includes(file)) console.log(`    SHA-256 ${sha256(generated)}`);
    }
    if (checkOnly) {
      if (changes.length) throw new Error(`Rebuild drift: ${changes.join(', ')}. Existing files were not changed.`);
      console.log('Reproducibility check passed. Existing source files, data, and assets were not changed.');
    } else {
      for (const file of [...outputs, ...audits]) {
        mkdirSync(dirname(join(root, file)), { recursive: true });
        copyFileSync(join(temporary, file), join(root, file));
      }
      console.log('Updated the three generated JSON datasets and two audit reports. Source snapshots and assets were preserved.');
    }
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
