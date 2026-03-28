# SABDA — Next Session Context

## Build & Preview
```bash
cd ~/Documents/GitHub/sabda && git pull && python3 assemble_cherryblossom.py && open sabda_cherryblossom_full.html
```
Controls: R=360° room, Y=5x speed, T=30x speed, D=guides, P=projector strips

## Render (full 30-min loop)
```bash
cd ~/Documents/GitHub/sabda && node render_cherryblossom.js full
```
Output: `output/sabda_top.mp4 + sabda_bottom.mp4` (H.264 CRF 14)

## What Was Done This Session
1. **Cherry Blossom scene created** — new 3-6 PM content calendar slot
2. **Sky HDRI**: "The Sky Is On Fire" 4K equirect (pink/purple/gold sunset)
   - Tinted via shader for cherry blossom warmth, breathing colour cycle
3. **Cherry blossom trees**: 6 instances from GLB (3 tree models, bark+foliage PBR)
   - Placed at varying azimuths/distances (10-25m) for depth
   - Gentle wind sway animation
4. **Falling petals**: 500 instanced mesh petals from 3 petal types (extracted from full GLB)
   - Physics: gravity, lateral drift, wind, spiral motion, updrafts
   - 70% respawn near trees, 30% random sky spawn
   - Per-instance rotation, scale variation (4-8cm realistic size)
5. **Atmosphere**: soft pink fog, 3-layer cloud bank, 300 dust motes, 8 god rays
6. **Lighting**: late afternoon — golden sun, pink rim, lavender fill
7. **Breathing cycle**: subtle warmth shift (pink↔golden) across 30min
8. **Full pipeline**: slim HTML + b64 assets + assembly script + render script
9. **Room viewer**: R key, matched sRGB color pipeline
10. **Loop continuity**: dust homing near t=0/1800 boundary

## Scene: 26.4MB assembled (vs murmuration's 63.9MB)

## Previous Scene (Murmuration)
- Build: `python3 assemble_murmuration.py && open sabda_murmuration_full.html`
- Render: `node render_murmuration.js full`

## Next Steps
- Preview cherry blossom scene in Chrome
- Tune tree positions, petal density, and colour grading
- Verify loop seam at t=1800→0
- Run full 30-min render → load into Watchout

*Standard: 10/10 or nothing.*
