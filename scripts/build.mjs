import { mkdir, copyFile, readFile, writeFile } from 'node:fs/promises';
await mkdir('dist/src/chronicles', { recursive: true });
await copyFile('index.html', 'dist/index.html');
for (const path of ['src/main.js','src/chronicles/chroniclesMM3Rules.js','src/chronicles/initiativeCore.js','src/chronicles/chroniclesSavePolicy.js']) {
  await copyFile(path, `dist/${path}`);
}
const html = await readFile('dist/index.html','utf8');
if (!html.includes('/src/main.js')) throw new Error('Entrypoint missing');
console.log('Standalone integration shell built to dist/');
