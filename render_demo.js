#!/usr/bin/env node
/**
 * SABDA Cherry Blossom — 2-Minute Demo Renderer
 * Renders 120s at 30fps → top strip + bottom strip MP4s
 * 
 * Usage:
 *   node render_demo.js
 * 
 * Output:
 *   output/demo_top.mp4    (Left 5008×1200 + Front 1920×1200 = 6928×1200)
 *   output/demo_bottom.mp4 (Right 5008×1200 + Back 1920×1200 = 6928×1200)
 */

const puppeteer = require('puppeteer');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// ── CONFIG ──
const FPS = 30;
const DEMO_DURATION = 120; // 2 minutes
const TOTAL_FRAMES = DEMO_DURATION * FPS; // 3600 frames
const FRAME_STEP = 1 / FPS;
const CRF = '16';

const HTML_FILE = path.resolve(__dirname, 'sabda_cherryblossom_full.html');
const OUTPUT_DIR = path.resolve(__dirname, 'output');

const WALLS = [
  { name: 'left',  w: 5008, h: 1200 },
  { name: 'front', w: 1920, h: 1200 },
  { name: 'right', w: 5008, h: 1200 },
  { name: 'back',  w: 1920, h: 1200 },
];

console.log(`\n═══ SABDA Cherry Blossom — 2-Min Demo ═══`);
console.log(`Frames: ${TOTAL_FRAMES} (${DEMO_DURATION}s at ${FPS}fps)`);
console.log(`Output: ${OUTPUT_DIR}\n`);

if (!fs.existsSync(HTML_FILE)) {
  console.error(`ERROR: ${HTML_FILE} not found. Run: python3 assemble_cherryblossom.py`);
  process.exit(1);
}

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// Create frame dirs
for (const w of WALLS) {
  const d = path.join(OUTPUT_DIR, `frames_${w.name}`);
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}

async function renderFrames() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu',
           '--use-gl=swiftshader', '--window-size=7000,2500'],
  });
  const page = await browser.newPage();
  
  // Set viewport to match the full strip
  await page.setViewport({ width: 6928, height: 2400, deviceScaleFactor: 1 });

  // Load HTML
  console.log('Loading scene...');
  await page.goto('file://' + HTML_FILE, { waitUntil: 'domcontentloaded', timeout: 120000 });
  
  // Set puppeteer flag
  await page.evaluate(() => { window.__SABDA_PUPPETEER__ = true; });
  
  // Wait for scene to be ready
  await page.waitForFunction('window.SABDA_READY === true', { timeout: 60000 });
  console.log('Scene ready. Rendering...\n');

  const startTime = Date.now();
  
  for (let frame = 0; frame < TOTAL_FRAMES; frame++) {
    const simTime = frame * FRAME_STEP;
    
    // Render frame
    await page.evaluate((t) => { window.SABDA_RENDER_FRAME(t, 1); }, simTime);
    
    // Capture each wall
    for (const wall of WALLS) {
      const rt = await page.evaluate((name) => {
        const walls = window.SABDA_WALLS;
        const renderer = window.SABDA_RENDERER;
        const rt = walls[name];
        const w = rt.width, h = rt.height;
        const buf = new Uint8Array(w * h * 4);
        renderer.readRenderTargetPixels(rt, 0, 0, w, h, buf);
        
        // Create canvas and flip vertically (WebGL reads bottom-up)
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        const imgData = ctx.createImageData(w, h);
        for (let y = 0; y < h; y++) {
          const srcRow = (h - 1 - y) * w * 4;
          const dstRow = y * w * 4;
          imgData.data.set(buf.subarray(srcRow, srcRow + w * 4), dstRow);
        }
        ctx.putImageData(imgData, 0, 0);
        return canvas.toDataURL('image/jpeg', 0.95);
      }, wall.name);
      
      // Save frame
      const frameNum = String(frame).padStart(6, '0');
      const framePath = path.join(OUTPUT_DIR, `frames_${wall.name}`, `frame_${frameNum}.jpg`);
      const base64Data = rt.replace(/^data:image\/jpeg;base64,/, '');
      fs.writeFileSync(framePath, Buffer.from(base64Data, 'base64'));
    }
    
    // Progress
    if (frame % 30 === 0) {
      const elapsed = (Date.now() - startTime) / 1000;
      const fps = frame / elapsed || 0;
      const eta = ((TOTAL_FRAMES - frame) / fps) || 0;
      const pct = ((frame / TOTAL_FRAMES) * 100).toFixed(1);
      console.log(`Frame ${frame}/${TOTAL_FRAMES} (${pct}%) | ${fps.toFixed(1)} fps | ETA: ${(eta/60).toFixed(1)}min | t=${(frame*FRAME_STEP).toFixed(1)}s`);
    }
  }
  
  await browser.close();
  console.log('\nFrames rendered. Encoding videos...\n');
}

function ffmpeg(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', args, { stdio: 'inherit' });
    proc.on('close', code => code === 0 ? resolve() : reject(new Error(`ffmpeg exit ${code}`)));
  });
}

async function encodeVideos() {
  // Encode each wall
  for (const wall of WALLS) {
    const framesDir = path.join(OUTPUT_DIR, `frames_${wall.name}`);
    const outFile = path.join(OUTPUT_DIR, `demo_${wall.name}.mp4`);
    console.log(`Encoding ${wall.name} (${wall.w}×${wall.h})...`);
    await ffmpeg([
      '-y', '-framerate', String(FPS),
      '-i', path.join(framesDir, 'frame_%06d.jpg'),
      '-c:v', 'libx264', '-crf', CRF, '-preset', 'medium',
      '-pix_fmt', 'yuv420p', '-s', `${wall.w}x${wall.h}`,
      outFile
    ]);
  }
  
  // Merge into top strip (Left + Front) and bottom strip (Right + Back)
  console.log('\nMerging top strip (Left + Front)...');
  await ffmpeg([
    '-y',
    '-i', path.join(OUTPUT_DIR, 'demo_left.mp4'),
    '-i', path.join(OUTPUT_DIR, 'demo_front.mp4'),
    '-filter_complex', '[0:v][1:v]hstack=inputs=2[v]',
    '-map', '[v]', '-c:v', 'libx264', '-crf', CRF, '-preset', 'slow',
    path.join(OUTPUT_DIR, 'demo_top.mp4')
  ]);
  
  console.log('Merging bottom strip (Right + Back)...');
  await ffmpeg([
    '-y',
    '-i', path.join(OUTPUT_DIR, 'demo_right.mp4'),
    '-i', path.join(OUTPUT_DIR, 'demo_back.mp4'),
    '-filter_complex', '[0:v][1:v]hstack=inputs=2[v]',
    '-map', '[v]', '-c:v', 'libx264', '-crf', CRF, '-preset', 'slow',
    path.join(OUTPUT_DIR, 'demo_bottom.mp4')
  ]);
  
  console.log('\n═══ DONE ═══');
  console.log(`Top:    ${path.join(OUTPUT_DIR, 'demo_top.mp4')}    (6928×1200)`);
  console.log(`Bottom: ${path.join(OUTPUT_DIR, 'demo_bottom.mp4')} (6928×1200)`);
}

(async () => {
  await renderFrames();
  await encodeVideos();
})().catch(err => { console.error(err); process.exit(1); });
