#!/usr/bin/env python3
"""Reassemble sabda_cherryblossom.html from slim HTML + .b64 assets."""
import os

slim = 'sabda_cherryblossom_slim.html'
output = 'sabda_cherryblossom_full.html'

with open(slim, 'r') as f:
    html = f.read()

assets = {
    'skydata_a':        'assets_cherryblossom/skydata_a.b64',
    'skydata_b':        'assets_cherryblossom/skydata_b.b64',
    'treedata':         'assets_cherryblossom/treedata.b64',
    'mysticaltreedata': 'assets_cherryblossom/mysticaltreedata.b64',
    'animpetaldata':    'assets_cherryblossom/animpetaldata.b64',
    'groundpetaldata':  'assets_cherryblossom/groundpetaldata.b64',
}

for aid, b64_path in assets.items():
    with open(b64_path, 'r') as f:
        b64 = f.read().strip()
    placeholder = f'<script id="{aid}" type="text/plain">ASSET_PLACEHOLDER</script>'
    replacement = f'<script id="{aid}" type="text/plain">{b64}</script>'
    html = html.replace(placeholder, replacement)
    print(f"  Injected {aid}: {len(b64)/1024/1024:.1f}MB")

with open(output, 'w') as f:
    f.write(html)

print(f"\nAssembled: {os.path.getsize(output)/1024/1024:.1f}MB -> {output}")
