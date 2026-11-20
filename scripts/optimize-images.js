'use strict';

// Generate optional responsive WebP variants before the server starts.
// Original assets are never modified. A bad/unsupported source image must
// never prevent the website from starting.
const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');

const imageDir = path.join(__dirname, '..', 'assets', 'images');
const outputDir = path.join(imageDir, 'optimized');
const widths = [480, 768, 1200];
const supported = /\.(?:jpe?g|png|webp)$/i;
const skip = /(?:logo|icon)/i;

async function main() {
  await fs.mkdir(outputDir, { recursive: true });
  const files = await fs.readdir(imageDir, { withFileTypes: true });
  let generated = 0;
  let skipped = 0;

  for (const entry of files) {
    if (!entry.isFile() || !supported.test(entry.name) || skip.test(entry.name)) continue;

    const input = path.join(imageDir, entry.name);
    const base = path.parse(entry.name).name;

    try {
      const metadata = await sharp(input).metadata();
      if (!metadata.width || !metadata.height) {
        skipped++;
        console.warn(`Skipping image without dimensions: ${entry.name}`);
        continue;
      }

      for (const width of widths) {
        const output = path.join(outputDir, `${base}-${width}.webp`);
        try {
          await fs.access(output);
          continue;
        } catch {}

        try {
          await sharp(input)
            .rotate()
            .resize({ width, withoutEnlargement: true })
            .webp({ quality: 78, effort: 5 })
            .toFile(output);
          generated++;
        } catch (error) {
          skipped++;
          console.warn(`Skipping unsupported image variant ${entry.name} (${width}px): ${error.message}`);
        }
      }
    } catch (error) {
      skipped++;
      console.warn(`Skipping unreadable image ${entry.name}: ${error.message}`);
    }
  }

  console.log(`Responsive image preparation complete; generated ${generated} WebP variants; skipped ${skipped} unsupported items.`);
}

main().catch((error) => {
  // This is an optional performance enhancement, not a server prerequisite.
  console.error('Responsive image preparation could not complete; continuing startup:', error);
});
