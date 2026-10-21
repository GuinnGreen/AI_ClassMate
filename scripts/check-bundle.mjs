import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import assert from 'node:assert/strict';

const dir = resolve(process.argv[2] || 'dist');
const manifest = JSON.parse(readFileSync(resolve(dir, '.vite/manifest.json'), 'utf8'));
const visited = new Set();
function visit(key) {
  if (visited.has(key)) return;
  visited.add(key);
  (manifest[key].imports || []).forEach(visit);
}
Object.keys(manifest).filter(key => manifest[key].isEntry).forEach(visit);
const files = [...visited].map(key => manifest[key].file);
const sizes = files.map(file => readFileSync(resolve(dir, file)));
const bytes = sizes.reduce((sum, code) => sum + code.length, 0);
const gzip = sizes.reduce((sum, code) => sum + gzipSync(code).length, 0);
const allFiles = [...new Set(Object.values(manifest).map(chunk => chunk.file).filter(file => file.endsWith('.js')))];
const total = allFiles.reduce((sum, file) => sum + readFileSync(resolve(dir, file)).length, 0);
console.log(JSON.stringify({ initialJavaScriptBytes: bytes, initialJavaScriptGzipBytes: gzip, totalJavaScriptBytes: total, files }, null, 2));
assert.ok(bytes < 500_000, `Initial JS ${bytes} exceeds 500 kB budget`);
assert.ok(gzip < 160_000, `Initial JS gzip ${gzip} exceeds 160 kB budget`);
assert.ok(total < 1_700_000, `Total JS ${total} exceeds 1.7 MB budget`);
const html = readFileSync(resolve(dir, 'index.html'), 'utf8');
const favicon = html.match(/rel="icon"[^>]*href="([^"]+)"/)?.[1];
assert.ok(favicon && !favicon.includes('vite.svg'), 'App favicon must replace the missing Vite icon');
assert.match(readFileSync(resolve(dir, favicon.replace(/^\//, '')), 'utf8'), /<svg/);
