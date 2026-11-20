'use strict';

// Generate responsive WebP variants before the server starts.
// Originals remain untouched and are retained as HTML fallbacks.
const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');

const imageDir = path.join(__dirname, '..', 'assets', 'images');
const outputDir = path.join(imageDir, 'optimized');
const widths = [480, 768, 1200];
const supported = /\\.(?:jpe?g|png|webp)$/i;
const skip = /(?:logo|icon)/i;

async function main() {
  await fs.mkdir(outputDir, { recursive: true });
  const files = await fs.readdir(imageDir, { withFileTypes: true });
  let generated = 0;

  for (const entry of files) {
    if (!entry.isFile() || !supported.test(entry.name) || skip.test(entry.name)) continue;
    const input = path.join(imageDir, entry.name);
    const base = path.parse(entry.name).name;
    const metadata = await sharp(input).metadata();
    if (!metadata.width || !metadata.height) continue;

    for (const width of widths) {
      const output = path.join(outputDir, `${base}-${width}.webp`);
      try {
        await fs.access(output);
        continue;
      } catch {}
      await sharp(input)
        .rotate()
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: 78, effort: 5 })
        .toFile(output);
      generated++;
    }
  }
  console.log(`Responsive image preparation complete; generated ${generated} WebP variants.`);
}

main().catch((error) => {
  console.error('Responsive image preparation failed:', error);
  process.exitCode = 1;
});
