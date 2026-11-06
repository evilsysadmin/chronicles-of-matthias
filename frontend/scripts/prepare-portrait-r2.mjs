// Prepare immutable, content-hashed WebP objects for the Chronicles R2 bucket.
// This script does not use credentials, upload, mutate git or flip CDN pointers.
// Run from any directory: node frontend/scripts/prepare-portrait-r2.mjs
// Optional approved eyes-closed originals: --sleep-dir=/absolute/path
import { createHash } from 'node:crypto';
import {
  copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const frontend = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const assets = join(frontend, 'src', 'assets', 'chronicles');
const output = join(frontend, '.portrait-r2-stage');
const host = 'https://assets.chronicles.shadowops.dpdns.org';
const canonical = {
  matthias: 'matthias-chronicles-canonical-v3.webp',
  rook: 'hildegard-canonical-v2.webp',
  bishop: 'aziz-canonical-v2.webp',
  knight: 'faust-canonical-v2.webp',
};
const originals = [
  ...Object.entries(canonical).map(([id, file]) => ({ id, file: join(assets, file) })),
  ...['male', 'female'].flatMap((sex) => Array.from({ length: 10 }, (_, index) => {
    const id = `${sex}-${String(index + 1).padStart(2, '0')}`;
    return { id, file: join(assets, 'portraits', `${id}.webp`) };
  })),
];
const arg = process.argv.slice(2).find(value => value.startsWith('--sleep-dir='));
if (process.argv.slice(2).some(value => !value.startsWith('--sleep-dir='))) {
  throw new Error('Only --sleep-dir=/path/to/approved/sleep-webps is supported');
}
const sleepDir = arg ? resolve(arg.slice('--sleep-dir='.length)) : null;
if (sleepDir && (!existsSync(sleepDir) || !readdirSync(sleepDir).length)) {
  throw new Error('Sleep directory is missing or empty');
}

function verifyWebP(bytes, file) {
  if (bytes.length < 30 || bytes.toString('ascii', 0, 4) !== 'RIFF'
    || bytes.toString('ascii', 8, 12) !== 'WEBP') {
    throw new Error(`Not an actual WebP: ${file}`);
  }
  const fourcc = bytes.toString('ascii', 12, 16);
  let width = 0; let height = 0;
  if (fourcc === 'VP8X') {
    width = 1 + bytes.readUIntLE(24, 3);
    height = 1 + bytes.readUIntLE(27, 3);
  } else if (fourcc === 'VP8L' && bytes[20] === 0x2f) {
    const bits = bytes.readUInt32LE(21);
    width = 1 + (bits & 0x3fff);
    height = 1 + ((bits >>> 14) & 0x3fff);
  } else if (fourcc === 'VP8 ' && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) {
    width = bytes.readUInt16LE(26) & 0x3fff;
    height = bytes.readUInt16LE(28) & 0x3fff;
  }
  if (width < 32 || height < 32 || width > 2048 || height > 2048) {
    throw new Error(`Unusable WebP portrait dimensions: ${file}`);
  }
  return { width, height };
}

const pack = [];
const manifest = { schema: 1, portraits: {} };
for (const { id, file } of originals) {
  const awake = readFileSync(file);
  const dimensions = verifyWebP(awake, file);
  const entry = {};
  const choices = [['awake', file]];
  const sleep = sleepDir ? join(sleepDir, `${id}.webp`) : null;
  if (sleep && existsSync(sleep)) choices.push(['sleep', sleep]);
  for (const [variant, source] of choices) {
    const data = source === file ? awake : readFileSync(source);
    const size = verifyWebP(data, source);
    if (size.width !== dimensions.width || size.height !== dimensions.height) {
      throw new Error(`Sleep portrait must match awake dimensions: ${id}`);
    }
    const hash = createHash('sha256').update(data).digest('hex');
    const key = `portraits/${id}/${variant}-${hash.slice(0, 16)}.webp`;
    pack.push({ key, file: source, size: data.length, sha256: hash });
    entry[variant] = `${host}/${key}`;
  }
  manifest.portraits[id] = entry;
}
// Refuse partial publication: every source has been read and validated first.
rmSync(output, { recursive: true, force: true });
for (const { key, file } of pack) {
  const destination = join(output, key);
  mkdirSync(dirname(destination), { recursive: true });
  copyFileSync(file, destination);
}
writeFileSync(join(output, 'manifest.candidate.json'), JSON.stringify(manifest, null, 2) + '\n');
writeFileSync(join(output, 'sha256sums.json'), JSON.stringify(pack.map(({ key, size, sha256 }) => (
  { key, size, sha256 }
)), null, 2) + '\n');
console.log(`Prepared ${pack.length} immutable WebP objects in ${output}`);
console.log('No R2 upload or manifest activation performed; verify/publicly publish first.');
