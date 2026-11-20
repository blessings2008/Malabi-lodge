'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const ffmpeg = require('ffmpeg-static');

const root = path.join(__dirname, '..');
const sourceDir = path.join(root, 'assets', 'images');
const outputDir = path.join(root, 'assets', 'videos');

const videos = [
  ['PREMIUM.mp4', 'PREMIUM-optimized.mp4'],
  ['Img 8636(1).mp4', 'Img-8636-optimized.mp4'],
  ['Dulex Loom v2.mp4', 'Deluxe-optimized.mp4'],
  ['IMG_8375.mp4', 'Pool-optimized.mp4']
];

function runFfmpeg(input, output) {
  return new Promise((resolve, reject) => {
    const args = [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-i', input,
      '-map', '0:v:0', '-map', '0:a?',
      '-vf', "scale=w='min(1280,iw)':h=-2:flags=lanczos",
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-crf', '27',
      '-maxrate', '1800k',
      '-bufsize', '3600k',
      '-profile:v', 'main',
      '-level', '3.1',
      '-pix_fmt', 'yuv420p',
      '-c:a', 'aac',
      '-b:a', '96k',
      '-ac', '2',
      '-movflags', '+faststart',
      '-threads', '2',
      output
    ];
    const child = spawn(ffmpeg, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', chunk => { stderr += chunk.toString(); });
    child.on('error', reject);
    child.on('close', code => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}: ${stderr.slice(-3000)}`));
    });
  });
}

(async () => {
  if (!ffmpeg || !fs.existsSync(ffmpeg)) {
    throw new Error('The bundled FFmpeg executable is unavailable.');
  }
  fs.mkdirSync(outputDir, { recursive: true });

  for (const [sourceName, outputName] of videos) {
    const source = path.join(sourceDir, sourceName);
    const output = path.join(outputDir, outputName);
    if (!fs.existsSync(source)) throw new Error(`Missing source video: ${sourceName}`);

    console.log(`Optimizing ${sourceName}...`);
    await runFfmpeg(source, output);

    const originalBytes = fs.statSync(source).size;
    const optimizedBytes = fs.statSync(output).size;
    if (!optimizedBytes) throw new Error(`FFmpeg produced an empty file for ${sourceName}`);

    const saved = Math.max(0, Math.round((1 - optimizedBytes / originalBytes) * 100));
    console.log(`Ready: ${outputName} (${(originalBytes / 1048576).toFixed(1)} MB -> ${(optimizedBytes / 1048576).toFixed(1)} MB; ${saved}% smaller)`);
  }

  console.log('Video optimization complete. Originals are preserved.');
})().catch(error => {
  console.error('Video optimization failed:', error);
  process.exitCode = 1;
});
