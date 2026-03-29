# SABDA Cherry Blossom — Scene Manual v1

## Purpose

Complete reference for building, debugging, and extending the Cherry Blossom 360° immersive scene for the SABDA wellness studio. This document captures every lesson learned, every mistake made, and every architectural decision — so the next session can proceed without repeating any of them.

This manual supplements the main SABDA Manual v12. The projection pipeline, room geometry, Watchout integration, and rendering architecture are documented there. This document covers only cherry-blossom-specific content and the new lessons discovered while building it.

---

## Repository

- **Repo:** `github.com/marv0611/sabdablossom` (separate from main `sabda` repo)
- **Scene file:** `sabda_cherryblossom_slim.html` (~770 lines)
- **Assembly:** `python3 assemble_cherryblossom.py` → `sabda_cherryblossom_full.html` (37.6MB)
- **Render:** `node render_cherryblossom.js [full]`
- **Assets:** `assets_cherryblossom/` (skydata_a, skydata_b, treedata, animpetaldata, groundpetaldata)
- **Content calendar slot:** 3–6 PM, soft pink, falling petals

---

## Current State (v6)

### What Works
- Dual-sky crossfade (citrus afternoon + sunflower dramatic clouds)
- Cherry blossom trees in grove layout (2 parallel rows, 11 instances)
- Animated falling petals (rigged GLB, 12.5s loop, 10 instances staggered)
- Ground petal carpet (16m×16m tiles, 7×7 grid)
- Pink fog, god rays, breathing warmth cycle
- 360° room viewer (R key), projector strip views (P key)
- Guide overlays (D key), speed controls (Y=5×, T=30×)

### What Needs Work (Next Session)
- Add mystical-x-tree-ii.glb as second tree type mixed into grove
- Tune tree distances and heights after viewing in room
- Tune fog density — may need adjustment for projector
- Tune sky tint — current pink tint may need warming
- Verify ground petal carpet covers all visible area
- Test loop seam at t=1800→0
- Run full 30-min render

---

## Architecture Decisions

### Why Separate Repo
The cherry blossom scene uses different assets (no planets, Saturn, birds, lanterns) and a fundamentally different scene structure (grove of trees vs open sky with distant objects). A separate repo keeps both scenes independently deployable and avoids 60MB+ combined asset bloat.

### Why Fork from Template, Not Murmuration
The murmuration scene is 1840 lines with 1400+ lines of scene-specific code (balloon house, lanterns, dual-sky crossfade with warmth cycle, birds, planets, shooting stars, Saturn). Ripping all that out would be error-prone. The template (`sabda_template_slim.html`, 452 lines) provides clean infrastructure with placeholder markers. Cherry blossom scene content is ~370 lines on top of that.

### Single Sky vs Dual Sky
Initially built with a single sky (Cape Town sunset HDRI "The Sky Is On Fire"). This failed because:
1. The HDRI had Cape Town buildings and street lamps baked into the lower hemisphere
2. Dense fog couldn't fully hide the buildings at all angles
3. A single sky provides no visual variation over 30 minutes

Switched to dual pure-sky HDRIs (citrus orchard + sunflowers) with the same crossfade architecture as murmuration. Pure-sky HDRIs have no ground features — only sky and blurred reflections below the horizon line, which the fog easily masks.

### InstancedMesh for Petals: Abandoned
Initial approach used `THREE.InstancedMesh` with 500 petals from extracted petal geometries. This was replaced with the user's rigged animated petal GLB (12.5s skeletal animation, 100 bones, 1552 verts) cloned 10 times with `SkeletonUtils.clone()`. The animated GLB provides natural fluttering motion without per-frame physics simulation.

### Ground: Petal Carpet GLB, Not Procedural
The user's ground petal GLB (`not_animated_ground_Cherry_blossom_petals_light.glb`) is a 16m×16m scatter of petals on a flat surface. Tiled in a 7×7 grid with random rotations, it creates a natural-looking petal-covered forest floor. Much better than a solid-color plane.

---

## Assets

| Asset | File | Size (b64) | Verts | Notes |
|-------|------|-----------|-------|-------|
| Sky A (citrus) | skydata_a.b64 | 1.7MB | — | Pure sky, bright afternoon, soft clouds |
| Sky B (sunflower) | skydata_b.b64 | 1.8MB | — | Pure sky, dramatic scattered cumulus |
| Cherry blossom trees | treedata.b64 | 23.0MB | 290,975 | 3 tree models (bark+foliage), 4 textures, 2 materials |
| Animated petals | animpetaldata.b64 | 6.1MB | 1,552 | Rigged skeletal, 100 bones, 12.5s loop, 300 channels |
| Ground petals | groundpetaldata.b64 | 5.0MB | 9,990 | Static 16m×16m scatter, 3 textures |
| Mystical tree | NOT YET ADDED | ~?MB | ? | Second tree type for grove variety — upload next session |

### Assets NOT Used
- `cherry_blossoms.glb` (20MB, 627 static petals, 363K verts) — too heavy, no animation
- `not_animated_ground_cherry_blossom_petals.glb` (3.8MB, 30K verts) — heavier version of the light ground petals
- `the_sky_is_on_fire_4k.hdr` — had Cape Town buildings baked in
- `petaldata.b64` (extracted 3 petal types from cherry_blossoms.glb) — replaced by animated GLB

---

## Tree Placement: Grove Perspective

### The Problem (v1-v4)
Trees were placed at random azimuths at distances of 10-35m from the viewer, creating a scattered look where one tree might block the entire view while others were invisible in the fog. The reference image shows an avenue/grove where trees line both sides of a path.

### The Solution (v6)
Two parallel rows with the viewer standing in the middle:

```
Left row (X = -7m):    Z = -12, -4, +4, +12
Right row (X = +7m):   Z = -8, 0, +8
Distant (fog fade):    Z = ±20, ±22 at X = ±5-8
```

Trees are 8m tall (natural cherry blossom height), 6-8m to the side. The viewer sees trunks on both sides, canopy above, and the avenue stretches into pink fog in both directions. 11 total instances.

### Key Perspective Rules
- Trees MUST be in organized rows, not random scatter
- Side distance 6-8m — close enough to see bark detail, far enough to not block the view
- Front/back distance varies — nearest at 4m Z offset, farthest fading into fog at 20-22m
- Each tree gets a unique Y-rotation so they don't look copy-pasted
- Scale variation ±15% adds natural variety

---

## Lessons Learned — Cherry Blossom Specific

### CB-1: HDRI buildings cannot be hidden with fog alone
Cape Town sunset HDRI had apartment buildings in the lower hemisphere. Even at fog density 0.018, buildings were clearly visible through the fog at certain angles. The sky shader horizon mask (`smoothstep(0.38, 0.46, vUv.y)`) helped but created a visible hard line. **Solution: use pure-sky HDRIs with no ground features.** The "puresky" variants from Poly Haven are specifically designed for this — lower hemisphere is blurred sky reflection, not ground content.

### CB-2: `const` duplicate declarations crash the entire module silently
When splicing infrastructure and scene sections from separate files, constants like `DUST_COUNT`, `CLOUD_LAYERS`, and `DURATION` were declared in both sections. ES module `const` duplication is a hard error — the entire `<script type="module">` fails to execute. No error in the UI, no partial rendering — just a black screen with the loading overlay stuck. **Always grep for duplicate `const` declarations after any file splice operation.**

### CB-3: `fetch()` data URIs fail on `file://` origins in Chrome
The `b64Blob()` function was rewritten to use `fetch('data:application/octet-stream;base64,' + raw)` for non-blocking base64 decode. This works on `http://` but Chrome blocks it on `file://` with "Unsafe attempt to load URL... 'file:' URLs are treated as unique security origins." The error appears in console but assets report as loaded (the GLTFLoader callback fires from the `b64T` texture loads, not the blob loads). **Solution: use synchronous `atob()` + `Uint8Array` loop.** The `for` loop with 32KB chunks doesn't freeze the browser even on 24MB strings — tested and confirmed. Never use `fetch()` for data URI decoding in a file that will be opened from disk.

### CB-4: `atob()` on 24MB strings does NOT freeze the browser
Initial concern was that `atob()` on 24MB (treedata) would freeze Chrome. Testing showed this is wrong — `atob()` is a native browser function that handles large strings fine. The `Uint8Array.from(atob(raw), c => c.charCodeAt(0))` pattern was the problem — `Array.from` with a mapping function creates an intermediate array. A plain `for` loop with pre-allocated `Uint8Array` is fast enough:
```javascript
const binStr = atob(raw);
const bytes = new Uint8Array(binStr.length);
for (let i = 0; i < binStr.length; i++) bytes[i] = binStr.charCodeAt(i);
```

### CB-5: base64 command line wrapping breaks `<script>` tag content
Linux `base64` command wraps output at 76 characters by default (adds newlines). When injected into `<script type="text/plain">`, the newlines are part of `textContent`. While `trim()` handles leading/trailing whitespace, internal newlines in a 39,000-line b64 string caused intermittent load failures. **Always use `base64 -w0`** to produce a single-line output with no wrapping.

### CB-6: `Object.assign` cannot set Three.js `rotation` or `position`
`Object.assign(mesh, {rotation: {x: -Math.PI/2, y: 0, z: 0}})` silently replaces the `Euler` object with a plain object, corrupting the mesh. Three.js uses getter/setter properties on `Object3D` for `rotation`, `position`, `scale`, `quaternion`. **Never use Object.assign on Three.js objects.** Always set properties individually: `mesh.rotation.x = -Math.PI/2`.

### CB-7: `SkeletonUtils.clone()` is required for rigged/skinned models
`model.clone()` does not clone skeleton bindings. The cloned mesh shares the original's skeleton, so all clones animate identically and may render incorrectly. `SkeletonUtils.clone(model)` creates independent skeleton copies. **Always use SkeletonUtils for any model with animations/bones.**

### CB-8: Dust particles at wellness scale look like white balls
The point sprite dust system (200 particles, sizes 1.5-4.0, opacity 0.30) that works beautifully in the murmuration's dark evening sky looks terrible in the bright cherry blossom scene. The bright background makes the soft white circles look like floating ping-pong balls. **Removed entirely in v6.** If dust/motes are needed for cherry blossom, they should be much smaller (size 0.3-0.8), more numerous (500+), nearly transparent (opacity 0.08-0.12), and tinted pink.

### CB-9: Tree placement must respect the viewer's perspective
Random azimuth placement (v1-v4) puts trees at arbitrary positions around a circle. From the viewer's eye level (1.6m), a tree at 10m directly in front blocks half the sky. A tree at 35m is a tiny silhouette in the fog. **Trees must be placed with intention** — like a real grove or avenue, with clear sightlines between trunks. Two parallel rows with the viewer in the avenue creates the classic cherry blossom tunnel look.

### CB-10: Sky saturation must be LOWER for daytime scenes
The murmuration's sky shader uses 1.8× saturation and 1.3× contrast because the evening sky is naturally dark and needs boosting. The cherry blossom scene's afternoon sky is already bright and colorful. Applying 1.55× saturation (v1) produced neon magenta. **Cherry blossom sky: saturation 1.15, contrast 1.06.** The sky should look natural, not painted.

### CB-11: `contentScene.background = null` produces black cubemap on first frames
If `contentScene.background` is null, the cubemap captures pure black until the sky texture finishes async loading (TextureLoader with data URI). This means the first few frames are completely black. In live preview this is a momentary flash, but in the Puppeteer renderer it could produce black frames at the start. **Always set `contentScene.background` to a fallback color** (e.g., the fog color `0xd0a8b8`) so the scene is never fully black.

### CB-12: Loading gate must have error paths AND a timeout
The `checkReady()` pattern (count to TOTAL_ASSETS) works when all assets load. But if any GLB fails (network error, corrupt data, parse failure), `checkReady()` never reaches the threshold and the loading screen stays forever. **Every loader needs an error callback that calls `checkReady()`.** Plus a `setTimeout(() => { ... }, 30000)` safety net that forces the loading screen away after 30 seconds.

### CB-13: Ground petal carpet position must be at y=0.0, not y=-0.05
The ground petal GLB's own geometry spans Y = -0.05 to +0.11. Placing it at y=-0.05 pushes the petals below the camera's visible floor line. At y=0.0, the petals sit naturally on the ground surface. The fallback brown plane goes at y=-0.08 (slightly below the petal layer).

### CB-14: Fog density for grove scene: 0.012 not 0.018
Dense fog (0.018) hides buildings but also hides trees beyond 15m. For a grove where distant trees fading into mist is the desired look, 0.012 provides enough atmospheric haze while keeping trees visible at 20-25m. The fog color should match the sky's horizon band color.

### CB-15: Assembly script must match HTML script tag IDs exactly
When switching from single sky (`skydata`) to dual sky (`skydata_a`, `skydata_b`), the assembly script must be updated simultaneously. A mismatch between `<script id="skydata_a">ASSET_PLACEHOLDER</script>` in HTML and `'skydata': 'skydata.b64'` in the assembly script means the placeholder is never replaced. **After any asset change, verify: (1) HTML script tag IDs, (2) assembly script keys, (3) b64Blob/b64T call arguments all use the same ID strings.**

---

## Relevant Lessons from Main Manual

These existing lessons (from SABDA Manual v12) are directly relevant to cherry blossom development:

- **Lesson 31:** Always visually inspect before delivering
- **Lesson 36:** Below-horizon HDRI content quality varies wildly
- **Lesson 39:** Dual-sphere crossfade is a performance trap — use single sphere with ShaderMaterial
- **Lesson 42:** Fix the root cause, not the symptom
- **Lesson 52:** Large HTML files must never be uploaded as chat chunks — use GitHub
- **Lesson 53:** Single unified HTML for both preview and render
- **Lesson 54:** Always commit working files immediately
- **Lesson 61:** Dual-sky crossfade must use single sphere + ShaderMaterial
- **Lesson 65:** Slim HTML needs a live preview loop gated by `!__SABDA_PUPPETEER__`
- **Lesson 67:** Puppeteer page load: use domcontentloaded, not networkidle0
- **Lesson 68:** Assembly script must handle cross-scene assets
- **Lesson 82:** Projection optimization applied ONCE at output shader only
- **Lesson 84:** Projected content needs ~15% lower brightness than monitor content
- **Lesson 98:** S-curve contrast ≤50% for projectors
- **Lesson 99:** Saturation boost 45% is the sweet spot (for evening scenes — cherry blossom needs less)
- **Lesson 101:** Sky tint channels must stay above 0.85
- **Lesson 102:** Don't bake projector edge blending into content
- **Lesson 110:** Only plain THREE.Mesh renders through CubeCamera (relevant for petal system choice)

---

## Pipeline Reference

### Build & Preview
```bash
cd ~/Documents/GitHub/sabdablossom
git pull
python3 assemble_cherryblossom.py
open sabda_cherryblossom_full.html
```

### Keyboard Controls
| Key | Function |
|-----|----------|
| R | Toggle 360° room view |
| Y | Toggle 5× speed |
| T | Toggle 30× speed |
| D | Toggle guide overlays |
| P | Cycle projector strip views |
| Space/⏸ | Pause/play |
| Slider | Scrub timeline (0–1800s) |

### Render
```bash
node render_cherryblossom.js         # Preview (60s, ~7 min)
node render_cherryblossom.js full    # Full (30min, ~3-5 hrs)
```
Output: `output/sabda_top.mp4` + `output/sabda_bottom.mp4` (H.264 CRF 14)

---

## Next Session Checklist

1. Upload `mystical-x-tree-ii.glb` — analyze, convert to b64, add as second tree type
2. Mix both tree types in the grove rows (alternate or randomize)
3. Preview in Chrome — check perspective, ground coverage, fog, colors
4. Press R for room view — verify it looks right on 4 walls
5. Tune as needed based on visual feedback
6. Verify loop seam (T key for 30× timelapse, watch t=1800→0)
7. Run full render when satisfied

*Standard: 10/10 or nothing.*
