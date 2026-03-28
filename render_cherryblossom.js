#!/usr/bin/env node
/**
 * SABDA Cherry Blossom — Puppeteer Video Renderer
 * Renders 30-minute loop to 4 wall videos, then merges into top/bottom strips.
 * 
 * Usage:
 *   node render_cherryblossom.js              # Preview mode (60s output)
 *   node render_cherryblossom.js full         # Full mode (30min output)
 */

const puppeteer = require('puppeteer');
console.log('SABDA Cherry Blossom render starting...');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// ── CONFIG ──
const MODE = process.argv[2] === 'full' ? 'full' : 'preview';
const FPS = 30;
const DURATION_SEC = 1800;
const PREVIEW_SPEED = 30;
const JPEG_QUALITY = 1.0;
const CRF = '14';
const PRESET_WALLS = 'medium';
const PRESET_MERGE = 'slow';

const TOTAL_FRAMES = MODE === 'full' ? DURATION_SEC * FPS : DURATION_SEC * FPS / PREVIEW_SPEED;
const FRAME_STEP = MODE === 'full' ? 1 / FPS : PREVIEW_SPEED / FPS;

const HTML_FILE = path.resolve(__dirname, 'sabda_cherryblossom_full.html');
const OUTPUT_DIR = path.resolve(__dirname, 'output');

const WALLS = [
  { name: 'left',  w: 5008, h: 1200 },
  { name: 'front', w: 1920, h: 1200 },
  { name: 'right', w: 5008, h: 1200 },
  { name: 'back',  w: 1920, h: 1200 },
];

console.log(`\n═══ SABDA Cherry Blossom Renderer ═══`);
console.log(`Mode: ${MODE}`);
console.log(`Frames: ${TOTAL_FRAMES} (${MODE === 'full' ? '30 min' : '60 sec'} output)`);
console.log(`Frame step: ${FRAME_STEP.toFixed(4)}s per frame`);
console.log(`Output: ${OUTPUT_DIR}\n`);

if (!fs.existsSync(HTML_FILE)) {
  console.error(`ERROR: ${HTML_FILE} not found. Run: python3 assemble_cherryblossom.py`);
  process.exit(1);
}

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

function startFFmpeg(wallName, w, h) {
  const outPath = path.join(OUTPUT_DIR, `wall_${wallName}.mp4`);
  const proc = spawn('ffmpeg', [
    '-y',
    '-f', 'image2pipe',
    '-framerate', String(FPS),
    '-i', 'pipe:0',
    '-c:v', 'libx264',
    '-crf', CRF,
    '-preset', PRESET_WALLS,
    '-tune', 'film',
    '-profile:v', 'high', '-level', '5.1',
    '-g', String(FPS),
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    outPath
  ], { stdio: ['pipe', 'ignore', 'ignore'] });

  proc.on('error', (err) => console.error(`FFmpeg error (${wallName}):`, err));
  return proc;
}

async function main() {
  const ffmpegProcs = {};
  for (const wall of WALLS) {
    ffmpegProcs[wall.name] = startFFmpeg(wall.name, wall.w, wall.h);
  }

  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--use-gl=swiftshader',
      '--enable-webgl',
      `--window-size=6928,2400`,
    ],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 6928, height: 2400 });

  await page.evaluateOnNewDocument(() => {
    window.__SABDA_PUPPETEER__ = true;
  });

  console.log('Loading scene...');
  await page.goto(`file://${HTML_FILE}`, { waitUntil: 'networkidle0', timeout: 120000 });

  // Wait for assets
  await page.waitForFunction('window.SABDA_READY === true', { timeout: 120000 });
  console.log('Scene loaded and ready.\n');

  const startTime = Date.now();

  for (let frame = 0; frame < TOTAL_FRAMES; frame++) {
    const simTime = frame * FRAME_STEP;

    await page.evaluate((t) => {
      window.SABDA_RENDER_FRAME(t, 1);
    }, simTime);

    // Extract each wall
    for (const wall of WALLS) {
      const jpegData = await page.evaluate(({ wallName, w, h, quality }) => {
        const renderer = window.SABDA_RENDERER;
        const rt = window.SABDA_WALLS[wallName];
        const pixels = new Uint8Array(w * h * 4);
        renderer.readRenderTargetPixels(rt, 0, 0, w, h, pixels);

        // Flip Y and convert to canvas
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        const imgData = ctx.createImageData(w, h);
        for (let y = 0; y < h; y++) {
          const srcRow = (h - 1 - y) * w * 4;
          const dstRow = y * w * 4;
          imgData.data.set(pixels.subarray(srcRow, srcRow + w * 4), dstRow);
        }
        ctx.putImageData(imgData, 0, 0);
        return canvas.toDataURL('image/jpeg', quality).split(',')[1];
      }, { wallName: wall.name, w: wall.w, h: wall.h, quality: JPEG_QUALITY });

      const buf = Buffer.from(jpegData, 'base64');
      ffmpegProcs[wall.name].stdin.write(buf);
    }

    // Progress
    if (frame % 30 === 0 || frame === TOTAL_FRAMES - 1) {
      const elapsed = (Date.now() - startTime) / 1000;
      const fps = frame / elapsed;
      const eta = (TOTAL_FRAMES - frame) / fps;
      const pct = ((frame / TOTAL_FRAMES) * 100).toFixed(1);
      const mins = Math.floor(simTime / 60);
      const secs = Math.floor(simTime % 60);
      console.log(`Frame ${frame}/${TOTAL_FRAMES} (${pct}%) t=${mins}:${secs.toString().padStart(2,'0')} | ${fps.toFixed(1)} fps | ETA ${Math.floor(eta/60)}m${Math.floor(eta%60)}s`);
    }
  }

  // Close FFmpeg pipes
  for (const wall of WALLS) {
    ffmpegProcs[wall.name].stdin.end();
  }

  // Wait for all FFmpeg to finish
  await Promise.all(WALLS.map(w => new Promise(resolve => {
    ffmpegProcs[w.name].on('close', resolve);
  })));

  console.log('\nWall videos complete. Merging strips...');

  // Merge into top strip (Left + Front)
  await new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', [
      '-y',
      '-i', path.join(OUTPUT_DIR, 'wall_left.mp4'),
      '-i', path.join(OUTPUT_DIR, 'wall_front.mp4'),
      '-filter_complex', '[0:v][1:v]hstack=inputs=2[v]',
      '-map', '[v]',
      '-c:v', 'libx264', '-crf', CRF, '-preset', PRESET_MERGE,
      '-tune', 'film', '-profile:v', 'high', '-level', '5.1',
      '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
      path.join(OUTPUT_DIR, 'sabda_top.mp4')
    ], { stdio: 'inherit' });
    proc.on('close', resolve);
    proc.on('error', reject);
  });

  // Merge into bottom strip (Right + Back)
  await new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', [
      '-y',
      '-i', path.join(OUTPUT_DIR, 'wall_right.mp4'),
      '-i', path.join(OUTPUT_DIR, 'wall_back.mp4'),
      '-filter_complex', '[0:v][1:v]hstack=inputs=2[v]',
      '-map', '[v]',
      '-c:v', 'libx264', '-crf', CRF, '-preset', PRESET_MERGE,
      '-tune', 'film', '-profile:v', 'high', '-level', '5.1',
      '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
      path.join(OUTPUT_DIR, 'sabda_top.mp4').replace('top', 'bottom')
    ], { stdio: 'inherit' });
    proc.on('close', resolve);
    proc.on('error', reject);
  });

  await browser.close();
  const totalTime = (Date.now() - startTime) / 1000;
  console.log(`\n═══ DONE ═══`);
  console.log(`Total time: ${Math.floor(totalTime/60)}m ${Math.floor(totalTime%60)}s`);
  console.log(`Output: ${OUTPUT_DIR}/sabda_top.mp4 + sabda_bottom.mp4`);
}

main().catch(err => { console.error(err); process.exit(1); });
