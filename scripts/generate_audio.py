#!/usr/bin/env python3
"""Records the clips listed in audio-manifest.json with the Kokoro voice model.

Usage: python scripts/generate_audio.py audio-manifest.json public/audio [minutes]
Incremental: a clip is only recorded if its text, speed or voice changed (done.json).
Stops starting new clips after the time budget, so a long first run can be resumed.
Writes index.json (the keys the app may play). Runs in CI; needs kokoro-onnx,
soundfile, and the model files kokoro-v1.0.onnx and voices-v1.0.bin in the working directory.
"""
import hashlib
import json
import os
import sys
import time

import soundfile as sf
from kokoro_onnx import Kokoro

manifest_path, out = sys.argv[1], sys.argv[2]
budget = float(sys.argv[3]) * 60 if len(sys.argv) > 3 else 150 * 60
manifest = json.load(open(manifest_path, encoding="utf-8"))
voice = manifest["voice"]
os.makedirs(out, exist_ok=True)
done_path = os.path.join(out, "done.json")
done = json.load(open(done_path)) if os.path.exists(done_path) else {}

kokoro = Kokoro("kokoro-v1.0.onnx", "voices-v1.0.bin")
start = time.time()
made = skipped = failed = left = 0
wanted = set()
for clip in manifest["clips"]:
    key, text, speed = clip["key"], clip["text"], clip["speed"]
    wanted.add(key)
    digest = hashlib.sha1(f"{voice}|{speed}|{text}".encode()).hexdigest()
    path = os.path.join(out, key + ".mp3")
    if done.get(key) == digest and os.path.exists(path):
        skipped += 1
        continue
    if time.time() - start > budget:
        left += 1
        continue
    try:
        samples, rate = kokoro.create(text, voice=voice, speed=speed, lang="en-us")
        os.makedirs(os.path.dirname(path), exist_ok=True)
        sf.write(path, samples, rate, format="MP3")
        done[key] = digest
        made += 1
        if made % 100 == 0:
            print(f"  recorded {made} clips, {int(time.time() - start)}s", flush=True)
            json.dump(done, open(done_path, "w"))
    except Exception as error:  # keep going: one bad clip must not lose the rest
        failed += 1
        print(f"  FAILED {key}: {error}", flush=True)

# Drop recordings for words that no longer exist.
for key in [k for k in done if k not in wanted]:
    try:
        os.remove(os.path.join(out, key + ".mp3"))
    except OSError:
        pass
    del done[key]

json.dump(done, open(done_path, "w"))
ready = sorted(k for k in done if os.path.exists(os.path.join(out, k + ".mp3")))
json.dump(ready, open(os.path.join(out, "index.json"), "w"))
size = sum(os.path.getsize(os.path.join(out, k + ".mp3")) for k in ready)
print(f"recorded {made}, kept {skipped}, failed {failed}, still to do {left}; {len(ready)} clips ready, {size / 1e6:.1f} MB")
if os.environ.get("GITHUB_OUTPUT"):
    with open(os.environ["GITHUB_OUTPUT"], "a") as fh:
        fh.write(f"left={left}\nmade={made}\n")
