r"""
Render one line across a range of decoding settings so you can pick by ear.

Clarity trades against expressiveness, and where the right point sits depends on
the reference clip and the engine — which is why this cannot be settled from the
code. Listen, choose, then write the winner into voices/voices.json.

    .venv\Scripts\python.exe tune.py akira reina
    .venv\Scripts\python.exe tune.py reina --text "Wait, hold on, say that again?"

Presets are chosen for whichever engine is configured, and the model loads once
for every voice you pass. Writes tune_out/<engine>/<voice>/<preset>.wav.
"""

from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from app import config  # noqa: E402
from app.synthesizer import synthesizer  # noqa: E402

# Presets per engine, since the knobs are not the same model to model.
#
# Chatterbox: exaggeration is delivery intensity, cfg_weight is how tightly
# generation is steered. The model card notes that lowering cfg_weight helps
# fast-talking references by loosening the pacing — which is exactly the
# complaint about Reina — so the grid sweeps that axis hardest.
PRESETS_BY_ENGINE: dict[str, list[tuple[str, dict]]] = {
    "chatterbox": [
        ("1-neutral", {"exaggeration": 0.5, "cfg_weight": 0.5}),
        ("2-looser-pacing", {"exaggeration": 0.5, "cfg_weight": 0.35}),
        ("3-loosest-pacing", {"exaggeration": 0.5, "cfg_weight": 0.25}),
        ("4-calmer", {"exaggeration": 0.35, "cfg_weight": 0.45}),
        ("5-more-dramatic", {"exaggeration": 0.7, "cfg_weight": 0.35}),
        ("6-steady-low-temp", {"exaggeration": 0.45, "cfg_weight": 0.5, "temperature": 0.6}),
    ],
    "xtts": [
        ("1-xtts-default", {"temperature": 0.75, "top_p": 0.85, "top_k": 50, "speed": 1.00}),
        ("2-baseline", {"temperature": 0.70, "top_p": 0.85, "top_k": 50, "speed": 1.00}),
        ("3-tighter", {"temperature": 0.60, "top_p": 0.78, "top_k": 35, "speed": 1.00}),
        ("4-tighter-slower", {"temperature": 0.60, "top_p": 0.78, "top_k": 35, "speed": 0.95}),
        ("5-clearest", {"temperature": 0.50, "top_p": 0.72, "top_k": 25, "speed": 0.95}),
        ("6-too-flat", {"temperature": 0.35, "top_p": 0.60, "top_k": 15, "speed": 0.92}),
    ],
}

# Deliberately awkward: a contraction, a question, a number, and a technical
# term. Slurring shows up here long before it shows up in a plain sentence.
DEFAULT_TEXT = (
    "Wait, I don't think I've got this right. The light reactions split water "
    "into oxygen, and that's where the six molecules come from, isn't it?"
)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("voices", nargs="+", help="voice ids, e.g. akira reina")
    parser.add_argument("--text", default=DEFAULT_TEXT, help="line to render")
    args = parser.parse_args()

    missing = [v for v in args.voices if synthesizer.reference_clip(v) is None]
    if missing:
        print(f"no reference clip for {missing} in {config.VOICES_DIR}")
        print(f"available: {synthesizer.available_voices()}")
        return 1

    print(f"voices: {', '.join(args.voices)}")
    print(f"text:   {args.text}\n")
    presets = PRESETS_BY_ENGINE.get(synthesizer.engine_name, [])
    if not presets:
        print(f"no presets defined for engine {synthesizer.engine_name!r}")
        return 1
    print(f"engine: {synthesizer.engine_name}")
    print("loading model (once for every voice)...")
    synthesizer.load()
    if not synthesizer.ready:
        print(f"model failed to load: {synthesizer.load_error}")
        return 1

    # Bypass voices.json for this run: we are comparing presets against each
    # other, not against whatever happens to be configured right now.
    original = synthesizer.settings_for
    for voice in args.voices:
        out_dir = Path(__file__).parent / "tune_out" / synthesizer.engine_name / voice
        out_dir.mkdir(parents=True, exist_ok=True)
        reference = synthesizer.reference_clip(voice)
        print(f"\n{voice} (reference: {reference.name if reference else '?'}):")

        for name, preset in presets:
            merged = {**config.baseline_for(synthesizer.engine_name), **preset}
            synthesizer.settings_for = lambda _v, _m=merged: dict(_m)  # type: ignore[method-assign]
            started = time.time()
            try:
                audio, _ = synthesizer.synthesize(args.text, voice, config.DEFAULT_LANGUAGE)
            except Exception as err:
                print(f"  {name:18s} FAILED: {type(err).__name__}: {err}")
                continue
            (out_dir / f"{name}.wav").write_bytes(audio)
            detail = " ".join(f"{k}={v}" for k, v in preset.items())
            print(f"  {name:18s} {time.time() - started:5.1f}s  {detail}")
    synthesizer.settings_for = original  # type: ignore[method-assign]

    print(f"\nwrote {len(presets)} clips per voice to tune_out/{synthesizer.engine_name}/")
    print("Listen through them. Pick the one that stays clearest while still")
    print("sounding like the character, then copy its settings into")
    print(f"voices/voices.json under that voice's \"{synthesizer.engine_name}\" block.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
