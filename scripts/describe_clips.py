#!/usr/bin/env python3
"""Prints a loudness picture of a few recordings, for checking them from the CI log.

Usage: python scripts/describe_clips.py public/audio
One character per 20 ms: '.' is silence, 1-9 is loudness. A stray sound before or
after a word shows up as a separate blob. Also records a few test variants of one
word (not saved) so different ways of asking the voice model can be compared.
"""
import sys

import numpy as np
import soundfile as sf


def picture(samples, rate):
    samples = np.asarray(samples, dtype=np.float32).reshape(-1)
    hop = int(rate * 0.02)
    frames = [samples[i : i + hop] for i in range(0, len(samples), hop)]
    rms = np.array([float(np.sqrt(np.mean(f * f))) if len(f) else 0.0 for f in frames])
    peak = rms.max() if len(rms) and rms.max() > 0 else 1.0
    db = 20 * np.log10(np.maximum(rms / peak, 1e-6))
    return f"{len(samples) / rate:5.2f}s " + "".join("." if d < -40 else str(min(9, max(1, int((d + 40) / 4.5) + 1))) for d in db)


out = sys.argv[1]
for key in ["w/practice", "w/gherkin", "w/frighten", "w/niece", "w/knowledge", "s/practice", "l/a", "l/k"]:
    try:
        samples, rate = sf.read(f"{out}/{key}.mp3")
        print(f"{key:14s} {picture(samples, rate)}")
    except Exception as error:
        print(f"{key:14s} unreadable: {error}")

if len(sys.argv) > 2:
    from kokoro_onnx import Kokoro

    kokoro = Kokoro("kokoro-v1.0.onnx", "voices-v1.0.bin")
    for word in ["practice", "niece"]:
        for speed in [0.75, 1.0]:
            for text in [word, word + ".", word.capitalize() + ".", f"The word is {word}."]:
                samples, rate = kokoro.create(text, voice=sys.argv[2], speed=speed, lang="en-us")
                print(f"{text!r:26s} x{speed:<4} {picture(samples, rate)}")
