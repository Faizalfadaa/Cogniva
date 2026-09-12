r"""
One-shot check that XTTS is installed, sees the GPU, and can clone each voice.

    .venv\Scripts\python.exe smoketest.py

Writes one WAV per character into ./smoketest_out/ so you can listen to them.
Not part of the service; safe to delete.
"""

import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from app import config  # noqa: E402
from app.synthesizer import synthesizer  # noqa: E402

LINES = {
    "yuzuki": "okay. So the oxygen comes from the water, not the carbon dioxide? Sorry, could you say that part again?",
    "reina": "Wait, wait, hold on! The oxygen comes from the water? I had that completely backwards this whole time!",
    "akira": "Hm. So the oxygen comes from the water. Not the carbon dioxide. That's not what I assumed.",
}


def main() -> int:
    import torch

    print(f"torch {torch.__version__}, CUDA available: {torch.cuda.is_available()}")
    if torch.cuda.is_available():
        print(f"GPU: {torch.cuda.get_device_name(0)}")

    print(f"voices on disk: {synthesizer.available_voices()}")

    print("\nloading model (this takes a while the first time)...")
    started = time.time()
    synthesizer.load()
    if not synthesizer.ready:
        print(f"FAILED to load: {synthesizer.load_error}")
        return 1
    print(f"model ready on {synthesizer.device} in {time.time() - started:.1f}s\n")

    out_dir = Path(__file__).parent / "smoketest_out"
    out_dir.mkdir(exist_ok=True)

    failures = 0
    for voice, line in LINES.items():
        clip = synthesizer.reference_clip(voice)
        started = time.time()
        try:
            audio, meta = synthesizer.synthesize(line, voice, config.DEFAULT_LANGUAGE)
        except Exception as err:
            print(f"  {voice:8s} FAILED: {type(err).__name__}: {err}")
            failures += 1
            continue

        path = out_dir / f"{voice}.wav"
        path.write_bytes(audio)
        print(
            f"  {voice:8s} ok  {time.time() - started:5.1f}s  "
            f"{len(audio) / 1024:6.0f} KB  cloned={meta['cloned']}  "
            f"ref={clip.name if clip else 'BUILT-IN'}"
        )

    print(f"\nwrote {len(LINES) - failures} clip(s) to {out_dir}")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
